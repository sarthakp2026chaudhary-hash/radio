/**
 * Import a "music map" knowledge-graph HTML export into the radio DB.
 *
 * Parses the `const FOLDERS = [...]` block (Folder -> Playlist -> Song{ t, a[] }),
 * dedupes artists (by slug) and songs (by title + sorted artist slugs), and creates:
 *   folders (nestable, under one genre root) -> playlists -> tracks <- track_artists
 *   + playlist_tracks links.
 * Songs/artists shared across playlists become a single row linked many times.
 * Songs are audio-less (text-first): default duration, no file_url.
 *
 * Usage:
 *   node scripts/import/import-graph.mjs "<path-to.html>" --genre "Mellow" [--dry-run] [--force]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_TRACK_DURATION_MS = 180_000;

const args = process.argv.slice(2);
const htmlPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const genreIdx = args.indexOf("--genre");
const genreName = genreIdx >= 0 ? args[genreIdx + 1] : "Mellow";

if (!htmlPath) {
  console.error('Usage: node scripts/import/import-graph.mjs "<path.html>" --genre "Mellow" [--dry-run] [--force]');
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const slugify = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── Extract the FOLDERS array literal via bracket matching (string-aware) ──
function extractFolders(html) {
  const start = html.indexOf("const FOLDERS");
  if (start < 0) throw new Error("`const FOLDERS` not found in HTML");
  const arrStart = html.indexOf("[", start);
  let depth = 0, str = null, end = -1;
  for (let i = arrStart; i < html.length; i++) {
    const ch = html[i];
    if (str) {
      if (ch === "\\") { i++; continue; }
      if (ch === str) str = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { str = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error("Could not find end of FOLDERS array");
  // eslint-disable-next-line no-new-func
  return new Function("return " + html.slice(arrStart, end + 1))();
}

const counts = { folders: 0, playlists: 0, tracksUnique: 0, artistsUnique: 0, links: 0, songSeen: 0 };
const artistCache = new Map(); // slug -> id
const trackCache = new Map();  // key  -> id

async function resolveArtist(name) {
  const clean = String(name || "").trim() || "Unknown";
  const slug = slugify(clean) || "unknown";
  if (artistCache.has(slug)) return artistCache.get(slug);
  let id;
  if (dryRun) {
    id = `dryA:${artistCache.size}`;
  } else {
    const ex = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
    if (ex.data) {
      id = ex.data.id;
    } else {
      const cr = await supabase.from("artists").insert({ name: clean, slug }).select("id").single();
      if (cr.error) {
        const again = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
        if (!again.data) throw cr.error;
        id = again.data.id;
      } else {
        id = cr.data.id;
      }
    }
  }
  artistCache.set(slug, id);
  counts.artistsUnique++;
  return id;
}

async function resolveTrack(title, artistNames) {
  const t = String(title || "").trim() || "Unknown";
  const names = (artistNames && artistNames.length ? artistNames : ["Unknown"]).map(
    (n) => String(n || "").trim() || "Unknown"
  );
  const key = slugify(t) + "|" + names.map(slugify).sort().join(",");
  if (trackCache.has(key)) return trackCache.get(key);

  const artistIds = [];
  for (const n of names) artistIds.push(await resolveArtist(n));
  const primaryId = artistIds[0] ?? null;

  let id;
  if (dryRun) {
    id = `dryT:${trackCache.size}`;
  } else {
    const ex = await supabase.from("tracks").select("id").eq("title", t).eq("artist_id", primaryId).maybeSingle();
    if (ex.data) {
      id = ex.data.id;
    } else {
      const cr = await supabase
        .from("tracks")
        .insert({ title: t, artist_id: primaryId, duration_ms: DEFAULT_TRACK_DURATION_MS, mime_type: "audio/mpeg" })
        .select("id")
        .single();
      if (cr.error) throw cr.error;
      id = cr.data.id;
      if (artistIds.length) {
        const rows = artistIds.map((aid, i) => ({
          track_id: id, artist_id: aid, role: i === 0 ? "primary" : "featured", position: i,
        }));
        await supabase.from("track_artists").insert(rows);
      }
    }
  }
  trackCache.set(key, id);
  counts.tracksUnique++;
  return id;
}

async function createFolder(name, parentId, position) {
  counts.folders++;
  if (dryRun) return `dryF:${counts.folders}`;
  let q = supabase.from("folders").select("id").eq("name", name);
  q = parentId == null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
  const ex = await q.maybeSingle();
  if (ex.data) return ex.data.id;
  const cr = await supabase.from("folders").insert({ name, parent_id: parentId, position }).select("id").single();
  if (cr.error) throw cr.error;
  return cr.data.id;
}

async function createPlaylist(name, desc, folderId, position) {
  counts.playlists++;
  if (dryRun) return `dryP:${counts.playlists}`;
  const cr = await supabase
    .from("playlists")
    .insert({ name, description: desc || null, is_public: true, folder_id: folderId })
    .select("id")
    .single();
  if (cr.error) throw cr.error;
  // position is informational; playlist order within folder uses created order for now
  return cr.data.id;
}

async function linkTrack(playlistId, trackId, position) {
  counts.links++;
  if (dryRun) return;
  const { error } = await supabase.from("playlist_tracks").insert({ playlist_id: playlistId, track_id: trackId, position });
  // ignore duplicate-in-playlist (unique violation)
  if (error && error.code !== "23505") throw error;
}

async function walk(node, parentFolderId, index) {
  if (node.songs) {
    const plId = await createPlaylist(node.name, node.desc, parentFolderId, index);
    let pos = 0;
    for (const s of node.songs) {
      counts.songSeen++;
      const trackId = await resolveTrack(s.t, s.a);
      await linkTrack(plId, trackId, pos++);
    }
  } else if (node.children) {
    const fId = await createFolder(node.name, parentFolderId, index);
    let i = 0;
    for (const child of node.children) await walk(child, fId, i++);
  }
}

async function main() {
  console.log(`=== Import graph (${dryRun ? "DRY RUN" : "LIVE"}) → genre "${genreName}" ===\n`);
  const html = readFileSync(htmlPath, "utf8");
  const FOLDERS = extractFolders(html);
  console.log(`Parsed top-level folders: ${FOLDERS.length}`);

  if (!dryRun) {
    const existingRoot = await supabase.from("folders").select("id").eq("name", genreName).is("parent_id", null).maybeSingle();
    if (existingRoot.data && !force) {
      console.error(`\nGenre folder "${genreName}" already exists (id ${existingRoot.data.id}). Re-running would duplicate playlists.`);
      console.error(`Pass --force to import anyway.`);
      process.exit(1);
    }
  }

  const rootId = await createFolder(genreName, null, 0);
  let i = 0;
  for (const top of FOLDERS) await walk(top, rootId, i++);

  console.log(`
--- Summary (${dryRun ? "would create" : "created/linked"}) ---
Genre root folder : "${genreName}"
Folders           : ${counts.folders}
Playlists         : ${counts.playlists}
Songs (occurrences): ${counts.songSeen}
Unique tracks     : ${counts.tracksUnique}   (deduped ${counts.songSeen - counts.tracksUnique} repeats)
Unique artists    : ${counts.artistsUnique}
Playlist links    : ${counts.links}
${dryRun ? "\n(no rows written — re-run without --dry-run to import)" : "\nDone."}
`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
