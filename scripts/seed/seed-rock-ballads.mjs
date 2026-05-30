/**
 * 2026-05-26 — attach audio for 2 existing text-only tracks (The Reason, Need You Now)
 * and create the "Rock Ballads" channel that loops them. Idempotent.
 *
 *   node scripts/seed/seed-rock-ballads.mjs
 *
 * Both songs were already in the DB as text-only (Hoobastank #544, Lady A #409); this
 * script attaches their MP3s to the existing rows (no duplicates) and binds them to a
 * new public channel + backing playlist.
 */
import { readFileSync, existsSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const D = "C:\\Users\\lenovo\\Downloads\\";
const DEFAULT_DURATION_MS = 180000;

// Artist names match what's already in the DB (Need You Now is filed under "Lady A",
// the band's current name, not "Lady Antebellum").
const TARGETS = [
  { file: D + "Hoobastank - The Reason (Lyrics) - AweLyrics.mp3", title: "The Reason", artists: ["Hoobastank"] },
  { file: D + "Lady Antebellum - Need You Now - LadyAVEVO.mp3", title: "Need You Now", artists: ["Lady A"] },
];

const CHANNEL = {
  name: "Rock Ballads",
  slug: "rock-ballads",
  description: null,
  isPublic: true,
  tracks: [
    { title: "The Reason", artist: "Hoobastank" },
    { title: "Need You Now", artist: "Lady A" },
  ],
};

const env = (k) => { if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); } return process.env[k]; };
const SUPA_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SUPA_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const R2_ACCOUNT_ID = env("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = env("R2_BUCKET_NAME");
const R2_PUBLIC_URL = env("R2_PUBLIC_URL");

const supabase = createClient(SUPA_URL, SUPA_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\bfeat\.?\b.*$/g, " ").replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

async function fetchAll(table, columns) {
  const PAGE = 1000; let from = 0; const out = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if ((data?.length ?? 0) < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function buildIndex() {
  const [tracks, artists, ta] = await Promise.all([
    fetchAll("tracks", "id, title, artist_id, artist, file_url"),
    fetchAll("artists", "id, name"),
    fetchAll("track_artists", "track_id, artist_id"),
  ]);
  const artistName = new Map(artists.map((a) => [a.id, a.name]));
  const byTrack = new Map();
  for (const r of ta) { if (!byTrack.has(r.track_id)) byTrack.set(r.track_id, new Set()); byTrack.get(r.track_id).add(r.artist_id); }
  return tracks.map((t) => {
    const names = new Set();
    for (const aid of byTrack.get(t.id) || []) if (artistName.has(aid)) names.add(norm(artistName.get(aid)));
    if (t.artist_id && artistName.has(t.artist_id)) names.add(norm(artistName.get(t.artist_id)));
    if (t.artist) names.add(norm(t.artist));
    return { id: t.id, nTitle: norm(t.title), artistNames: names, hasAudio: !!t.file_url };
  });
}

function matchTrack(index, title, artist) {
  const nt = norm(title), na = norm(artist);
  return index.find((t) => t.nTitle === nt && t.artistNames.has(na)) || null;
}

async function findOrCreateArtist(name) {
  const clean = name.trim();
  const slug = slugify(clean) || "unknown";
  const { data: ex } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from("artists").insert({ name: clean, slug }).select("id").single();
  if (error) {
    const { data: again } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
    if (again) return again.id;
    throw error;
  }
  return data.id;
}

async function attachAudio(index, target) {
  console.log(`\n── ${target.title} — ${target.artists.join(", ")} ──`);
  if (!existsSync(target.file)) { console.error("  SKIP: file not found:", target.file); return null; }

  const existing = matchTrack(index, target.title, target.artists[0]);
  if (existing?.hasAudio) { console.log(`  already has audio (#${existing.id}); skip.`); return existing.id; }

  const buffer = readFileSync(target.file);
  if (buffer.length === 0) { console.error("  SKIP: source file is 0 bytes (E006)."); return null; }
  let durationMs = DEFAULT_DURATION_MS;
  try {
    const meta = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
    if (meta.format.duration) durationMs = Math.round(meta.format.duration * 1000);
  } catch { /* duration optional */ }

  const primarySlug = slugify(target.artists[0] || "unknown") || "unknown";
  const key = `music/${primarySlug}/${slugify(target.title)}.mp3`;
  const fileUrl = `${R2_PUBLIC_URL}/${key}`;
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: "audio/mpeg" }));
  console.log(`  uploaded → ${fileUrl} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${(durationMs / 1000).toFixed(0)}s)`);

  const audio = { file_key: key, file_url: fileUrl, file_size_bytes: buffer.length, mime_type: "audio/mpeg", duration_ms: durationMs };

  if (existing) {
    const { error } = await supabase.from("tracks").update(audio).eq("id", existing.id);
    if (error) throw error;
    console.log(`  attached to existing track #${existing.id}`);
    return existing.id;
  }
  const artistIds = [];
  for (const n of target.artists) artistIds.push(await findOrCreateArtist(n));
  const { data: track, error } = await supabase.from("tracks").insert({ title: target.title, artist_id: artistIds[0] ?? null, ...audio }).select("id").single();
  if (error) throw error;
  const rows = artistIds.map((aid, i) => ({ track_id: track.id, artist_id: aid, role: i === 0 ? "primary" : "featured", position: i }));
  await supabase.from("track_artists").insert(rows);
  console.log(`  created track #${track.id}`);
  return track.id;
}

async function findOrCreateChannel(def) {
  const { data: ex } = await supabase.from("channels").select("id, name").eq("slug", def.slug).maybeSingle();
  if (ex) {
    await supabase.from("channels").update({ is_public: def.isPublic ?? true }).eq("id", ex.id);
    return { id: ex.id, created: false };
  }
  const { data, error } = await supabase.from("channels")
    .insert({ name: def.name, slug: def.slug, description: def.description ?? null, is_public: def.isPublic ?? true })
    .select("id").single();
  if (error) throw error;
  return { id: data.id, created: true };
}

async function setBackingPlaylist(def, channelId, trackIds) {
  const { data: st } = await supabase.from("channel_state").select("source_type, source_id").eq("channel_id", channelId).maybeSingle();
  let playlistId = st?.source_type === "playlist" && st?.source_id ? st.source_id : null;
  if (!playlistId) {
    const plName = `${def.name} — loop`;
    const { data: ex } = await supabase.from("playlists").select("id").eq("name", plName).maybeSingle();
    if (ex) playlistId = ex.id;
    else {
      const { data, error } = await supabase.from("playlists")
        .insert({ name: plName, description: `Backing loop for the "${def.name}" channel.`, is_public: true })
        .select("id").single();
      if (error) throw error;
      playlistId = data.id;
    }
  }
  await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
  const rows = trackIds.map((track_id, i) => ({ playlist_id: playlistId, track_id, position: i }));
  const { error } = await supabase.from("playlist_tracks").insert(rows);
  if (error) throw error;
  return playlistId;
}

async function upsertState(channelId, state) {
  const { data: ex } = await supabase.from("channel_state").select("id").eq("channel_id", channelId).maybeSingle();
  if (ex) { const { error } = await supabase.from("channel_state").update(state).eq("id", ex.id); if (error) throw error; }
  else { const { error } = await supabase.from("channel_state").insert({ channel_id: channelId, ...state }); if (error) throw error; }
}

async function main() {
  console.log("=== Rock Ballads seed ===");

  let index = await buildIndex();
  for (const t of TARGETS) await attachAudio(index, t);
  index = await buildIndex(); // refresh in case any new rows were created

  console.log(`\n── ${CHANNEL.name} (/radio/${CHANNEL.slug}) ──`);
  const trackIds = CHANNEL.tracks.map((t) => {
    const hit = matchTrack(index, t.title, t.artist);
    if (!hit) throw new Error(`Track not found after attach: "${t.title}" by ${t.artist}`);
    if (!hit.hasAudio) console.warn(`  ! "${t.title}" (#${hit.id}) has NO audio`);
    return hit.id;
  });
  const { id: channelId, created } = await findOrCreateChannel(CHANNEL);
  console.log(`  channel #${channelId} ${created ? "created" : "updated"} · tracks: ${trackIds.join(", ")}`);
  const playlistId = await setBackingPlaylist(CHANNEL, channelId, trackIds);
  await upsertState(channelId, {
    current_track_id: trackIds[0], source_type: "playlist", source_id: playlistId, source_position: 0,
    is_playing: true, playback_started_at: new Date().toISOString(), position_ms: 0,
    repeat_mode: "all", broadcast_mode: "automated",
  });
  console.log(`  state: playlist #${playlistId} loop (${trackIds.length} tracks)`);
  console.log("\nDone.");
}

main().catch((e) => { console.error("seed-rock-ballads failed:", e); process.exit(1); });
