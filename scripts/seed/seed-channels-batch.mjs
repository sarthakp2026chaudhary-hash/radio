/**
 * Create the four requested channels (idempotent — find-or-create by slug).
 *
 *   node scripts/seed/seed-channels-batch.mjs
 *
 * Single-song channels loop via channel_state.current_track_id (repeat one).
 * Multi-song channels need a backing playlist (the /loop endpoint reads the
 * channel's source playlist) — created/refreshed here, named "<Channel> — loop"
 * so it's clearly channel machinery, not a personal playlist.
 *
 * Tracks are resolved by normalized title + artist, so the two "Lie to Me" and
 * two "Zombie" tracks each bind to the correct version.
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
  { name: "Die Trying", slug: "die-trying", description: "Die Trying, on loop.", mode: "single",
    tracks: [{ title: "Die Trying", artist: "PARTYNEXTDOOR" }] },
  { name: "Call Me When You Land", slug: "call-me-when-you-land", description: "Call Me When You Land · Sit Next to Me · Lie To Me.", mode: "playlist",
    tracks: [
      { title: "Call Me When You Land", artist: "Old Sea Brigade" },
      { title: "Sit Next to Me", artist: "Foster the People" },
      { title: "Lie to Me", artist: "5 Seconds of Summer" },
    ] },
  { name: "Grace Kelly", slug: "grace-kelly", description: "Grace Kelly, on loop.", mode: "single",
    tracks: [{ title: "Grace Kelly", artist: "MIKA" }] },
  { name: "Nobodies", slug: "nobodies", description: "The Nobodies · For I Am Death / Life Evermore Pt.2 · Zombie (The Cranberries) · Zombie (YUNGBLUD). One more coming.", mode: "playlist",
    tracks: [
      { title: "The Nobodies", artist: "Marilyn Manson" },
      { title: "For I Am Death / Life Evermore Pt.2", artist: "The Pretty Reckless" },
      { title: "Zombie", artist: "The Cranberries" },
      { title: "Zombie", artist: "YUNGBLUD" },
    ] },
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
    fetchAll("tracks", "id, title, artist_id, artist"),
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
    return { id: t.id, nTitle: norm(t.title), artistNames: names };
  });
}

function resolveTrack(index, { title, artist }) {
  const nt = norm(title), na = norm(artist);
  const hit = index.find((t) => t.nTitle === nt && t.artistNames.has(na));
  if (!hit) throw new Error(`Track not found: "${title}" by ${artist}`);
  return hit.id;
}

async function findOrCreateChannel(def) {
  const { data: ex } = await supabase.from("channels").select("id").eq("slug", def.slug).maybeSingle();
  if (ex) {
    await supabase.from("channels").update({ name: def.name, description: def.description, is_public: true }).eq("id", ex.id);
    return { id: ex.id, created: false };
  }
  const { data, error } = await supabase.from("channels").insert({ name: def.name, slug: def.slug, description: def.description, is_public: true }).select("id").single();
  if (error) throw error;
  return { id: data.id, created: true };
}

async function setBackingPlaylist(def, trackIds) {
  const plName = `${def.name} — loop`;
  let playlistId;
  const { data: ex } = await supabase.from("playlists").select("id").eq("name", plName).maybeSingle();
  if (ex) {
    playlistId = ex.id;
    await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
  } else {
    const { data, error } = await supabase.from("playlists").insert({ name: plName, description: `Backing loop for the "${def.name}" channel.`, is_public: true }).select("id").single();
    if (error) throw error;
    playlistId = data.id;
  }
  const rows = trackIds.map((track_id, i) => ({ playlist_id: playlistId, track_id, position: i }));
  const { error: e2 } = await supabase.from("playlist_tracks").insert(rows);
  if (e2) throw e2;
  return playlistId;
}

async function upsertState(channelId, state) {
  const { data: ex } = await supabase.from("channel_state").select("id").eq("channel_id", channelId).maybeSingle();
  if (ex) { const { error } = await supabase.from("channel_state").update(state).eq("id", ex.id); if (error) throw error; }
  else { const { error } = await supabase.from("channel_state").insert({ channel_id: channelId, ...state }); if (error) throw error; }
}

async function main() {
  console.log("=== Seed channels ===");
  const index = await buildIndex();
  const now = new Date().toISOString();

  for (const def of CHANNELS) {
    console.log(`\n── ${def.name} (/radio/${def.slug}) ──`);
    const trackIds = def.tracks.map((t) => resolveTrack(index, t));
    console.log(`  tracks: ${trackIds.join(", ")}`);

    const { id: channelId, created } = await findOrCreateChannel(def);
    console.log(`  channel #${channelId} ${created ? "created" : "updated"}`);

    if (def.mode === "single") {
      await upsertState(channelId, {
        current_track_id: trackIds[0], source_type: null, source_id: null,
        is_playing: true, playback_started_at: now, position_ms: 0,
        repeat_mode: "one", broadcast_mode: "automated",
      });
      console.log(`  state: single track on loop (repeat one)`);
    } else {
      const playlistId = await setBackingPlaylist(def, trackIds);
      await upsertState(channelId, {
        current_track_id: trackIds[0], source_type: "playlist", source_id: playlistId, source_position: 0,
        is_playing: true, playback_started_at: now, position_ms: 0,
        repeat_mode: "all", broadcast_mode: "automated",
      });
      console.log(`  state: playlist #${playlistId} loop (repeat all, ${trackIds.length} tracks)`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("seed-channels failed:", e); process.exit(1); });
