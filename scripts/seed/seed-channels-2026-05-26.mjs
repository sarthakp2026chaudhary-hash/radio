/**
 * Channel ops 2026-05-26 (idempotent). Run: node scripts/seed/seed-channels-2026-05-26.mjs
 *
 *  - Rakesh (NEW, PRIVATE): Before You Go · I Think They Call This Love · Jaiye Sajana
 *  - This is me, Sarthak (existing #9, was empty): Main Aisa Kyun Hoon
 *  - Call Me When You Land (existing #6): full 10-song loop (3 existing + 7 added)
 *  - 90s (NEW): Hips Don't Lie
 *
 * Single-song loop = channel_state.current_track_id (repeat one). Multi-song loop =
 * a backing playlist (reuses the channel's existing source playlist if it has one, so
 * it's safe even after the owner renames the channel). Tracks resolved by title+artist;
 * every track is expected to have audio (warns if not).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\bfeat\.?\b.*$/g, " ").replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const CHANNELS = [
  { name: "Rakesh", slug: "rakesh", isPublic: false, description: "Private.", mode: "playlist",
    tracks: [
      { title: "Before You Go", artist: "Lewis Capaldi" },
      { title: "I Think They Call This Love", artist: "Matthew Ifield" },
      { title: "Jaiye Sajana", artist: "Jasmine Sandlas" },
    ] },
  { name: "This is me, Sarthak", slug: "this-is-me-sarthak", isPublic: true, mode: "single",
    tracks: [{ title: "Main Aisa Kyun Hoon", artist: "Shaan" }] },
  { name: "Call Me When You Land", slug: "call-me-when-you-land", isPublic: true, mode: "playlist",
    tracks: [
      { title: "Call Me When You Land", artist: "Old Sea Brigade" },
      { title: "Sit Next to Me", artist: "Foster the People" },
      { title: "Lie to Me", artist: "5 Seconds of Summer" },
      { title: "One Call Away", artist: "Charlie Puth" },
      { title: "Without You", artist: "Avicii" },
      { title: "Without Me", artist: "Halsey" },
      { title: "Mystery of Love", artist: "Sufjan Stevens" },
      { title: "Silence", artist: "Marshmello" },
      { title: "Nothing Breaks Like a Heart", artist: "Mark Ronson" },
      { title: "Let's Fall in Love for the Night", artist: "FINNEAS" },
    ] },
  { name: "90s", slug: "90s", isPublic: true, mode: "single",
    tracks: [{ title: "Hips Don't Lie", artist: "Shakira" }] },
];

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

function resolveTrack(index, { title, artist }) {
  const nt = norm(title), na = norm(artist);
  const hit = index.find((t) => t.nTitle === nt && t.artistNames.has(na));
  if (!hit) throw new Error(`Track not found: "${title}" by ${artist}`);
  if (!hit.hasAudio) console.warn(`  ! "${title}" (#${hit.id}) has NO audio`);
  return hit.id;
}

async function findOrCreateChannel(def) {
  const { data: ex } = await supabase.from("channels").select("id, name").eq("slug", def.slug).maybeSingle();
  if (ex) {
    // Don't clobber a name the owner may have changed — just ensure visibility.
    await supabase.from("channels").update({ is_public: def.isPublic ?? true }).eq("id", ex.id);
    return { id: ex.id, created: false, name: ex.name };
  }
  const { data, error } = await supabase.from("channels")
    .insert({ name: def.name, slug: def.slug, description: def.description ?? null, is_public: def.isPublic ?? true })
    .select("id").single();
  if (error) throw error;
  return { id: data.id, created: true, name: def.name };
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
        .insert({ name: plName, description: `Backing loop for the "${def.name}" channel.`, is_public: !def.isPublic ? false : true })
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
  console.log("=== Channel ops 2026-05-26 ===");
  const index = await buildIndex();
  const now = new Date().toISOString();

  for (const def of CHANNELS) {
    console.log(`\n── ${def.name} (/radio/${def.slug})${def.isPublic ? "" : " [PRIVATE]"} ──`);
    const trackIds = def.tracks.map((t) => resolveTrack(index, t));
    const { id: channelId, created } = await findOrCreateChannel(def);
    console.log(`  channel #${channelId} ${created ? "created" : "updated"} · tracks: ${trackIds.join(", ")}`);

    if (def.mode === "single") {
      await upsertState(channelId, {
        current_track_id: trackIds[0], source_type: null, source_id: null,
        is_playing: true, playback_started_at: now, position_ms: 0,
        repeat_mode: "one", broadcast_mode: "automated",
      });
      console.log(`  state: single track on loop`);
    } else {
      const playlistId = await setBackingPlaylist(def, channelId, trackIds);
      await upsertState(channelId, {
        current_track_id: trackIds[0], source_type: "playlist", source_id: playlistId, source_position: 0,
        is_playing: true, playback_started_at: now, position_ms: 0,
        repeat_mode: "all", broadcast_mode: "automated",
      });
      console.log(`  state: playlist #${playlistId} loop (${trackIds.length} tracks)`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("seed failed:", e); process.exit(1); });
