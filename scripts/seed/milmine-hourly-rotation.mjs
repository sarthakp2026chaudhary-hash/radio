/**
 * Milmine — each song plays for ~1 hour before rotating to the next, indefinitely.
 *
 * Uses `channel_state.rotation_seconds` (migration 016): the /loop endpoint computes
 * the playhead as floor(elapsed/rotation_seconds) % loop_count, and the listener
 * sets `audio.loop=true` so the current track repeats within the window. Polling
 * detects the rotation tick and switches to the next track.
 *
 *   node scripts/seed/milmine-hourly-rotation.mjs
 *
 * Idempotent: re-running just resets the playlist contents + restarts the rotation.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CHANNEL_SLUG = "milmine";
const TRACK_IDS = [765, 766]; // Vieil Amour, Altered State of Mind (rotation order)
const ROTATION_SECONDS = 3600; // 1 hour

async function main() {
  console.log("=== Milmine hourly rotation ===");

  const { data: ch } = await supabase.from("channels").select("id").eq("slug", CHANNEL_SLUG).single();
  if (!ch) throw new Error(`channel ${CHANNEL_SLUG} not found`);
  const { data: st } = await supabase.from("channel_state").select("source_type, source_id").eq("channel_id", ch.id).single();
  if (st?.source_type !== "playlist" || !st?.source_id) throw new Error("channel not in playlist mode");
  const playlistId = st.source_id;

  // Reset playlist to clean 2-track state (repairs any earlier failed expansion).
  await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);
  const rows = TRACK_IDS.map((track_id, i) => ({ playlist_id: playlistId, track_id, position: i }));
  const { error: e1 } = await supabase.from("playlist_tracks").insert(rows);
  if (e1) throw e1;
  console.log(`  playlist #${playlistId} reset to ${TRACK_IDS.length} tracks: ${TRACK_IDS.join(", ")}`);

  // Turn on rotation + restart the clock.
  const { error: e2 } = await supabase.from("channel_state").update({
    rotation_seconds: ROTATION_SECONDS,
    current_track_id: TRACK_IDS[0],
    source_position: 0,
    position_ms: 0,
    playback_started_at: new Date().toISOString(),
    is_playing: true,
    repeat_mode: "all",
  }).eq("channel_id", ch.id);
  if (e2) throw e2;
  console.log(`  channel_state.rotation_seconds = ${ROTATION_SECONDS}s (${ROTATION_SECONDS / 60} min) per track`);
  console.log("Done.");
}

main().catch((e) => { console.error("failed:", e); process.exit(1); });
