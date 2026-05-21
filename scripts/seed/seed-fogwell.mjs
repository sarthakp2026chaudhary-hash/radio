/**
 * Seed script: Upload "Fogwell's Gym - John Paesano.mp3" to R2,
 * then create all required DB records for the getFatpls channel.
 *
 * Run: node scripts/seed/seed-fogwell.mjs
 */

import { readFileSync, existsSync } from "fs";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load env from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

// Validate required env vars
const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const MP3_PATH = "C:\\Users\\lenovo\\Downloads\\Fogwell's Gym - John Paesano.mp3";
const TRACK_TITLE = "Fogwell's Gym";
const ARTIST_NAME = "John Paesano";
const ARTIST_SLUG = "john-paesano";
const CHANNEL_NAME = "getFatpls";
const CHANNEL_SLUG = "getfatpls";
const CHANNEL_DESCRIPTION = "Motivational channel. Get in there.";
const R2_KEY = `music/${ARTIST_SLUG}/fogwells-gym-john-paesano.mp3`;

async function main() {
  console.log("=== Radio Seed: getFatpls channel ===\n");

  // ── Step 1: Upload MP3 to R2 ──────────────────────────────────────────────
  console.log("1. Checking R2 for existing file...");
  let fileUrl = `${R2_PUBLIC_URL}/${R2_KEY}`;
  let fileSizeBytes = 0;

  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: R2_KEY }));
    console.log("   Already exists in R2, skipping upload.");
    // Try to get size from local file if available
    if (existsSync(MP3_PATH)) {
      fileSizeBytes = readFileSync(MP3_PATH).length;
    }
  } catch {
    // File doesn't exist, upload it
    if (!existsSync(MP3_PATH)) {
      console.error(`   MP3 not found at: ${MP3_PATH}`);
      console.log("   Will create track record without audio file.");
      fileUrl = null;
    } else {
      console.log(`   Uploading from ${MP3_PATH}...`);
      const buffer = readFileSync(MP3_PATH);
      fileSizeBytes = buffer.length;

      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: R2_KEY,
        Body: buffer,
        ContentType: "audio/mpeg",
      }));
      console.log(`   Uploaded → ${fileUrl} (${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
    }
  }

  // ── Step 2: Create or find artist ────────────────────────────────────────
  console.log(`\n2. Creating artist: ${ARTIST_NAME}...`);
  let artistId;

  const { data: existingArtist } = await supabase
    .from("artists")
    .select("id")
    .eq("slug", ARTIST_SLUG)
    .maybeSingle();

  if (existingArtist) {
    artistId = existingArtist.id;
    console.log(`   Already exists (id: ${artistId})`);
  } else {
    const { data: artist, error } = await supabase
      .from("artists")
      .insert({ name: ARTIST_NAME, slug: ARTIST_SLUG, bio: "Composer known for Daredevil OST and other soundtracks." })
      .select("id")
      .single();

    if (error) { console.error("   Artist insert failed:", error.message); process.exit(1); }
    artistId = artist.id;
    console.log(`   Created (id: ${artistId})`);
  }

  // ── Step 3: Create or find track ──────────────────────────────────────────
  console.log(`\n3. Creating track: ${TRACK_TITLE}...`);
  let trackId;

  const { data: existingTrack } = await supabase
    .from("tracks")
    .select("id")
    .eq("title", TRACK_TITLE)
    .eq("artist_id", artistId)
    .maybeSingle();

  if (existingTrack) {
    trackId = existingTrack.id;
    console.log(`   Already exists (id: ${trackId})`);

    // Update file info if we have it and it's missing
    if (fileUrl) {
      await supabase.from("tracks").update({ file_key: R2_KEY, file_url: fileUrl, file_size_bytes: fileSizeBytes || null }).eq("id", trackId).is("file_key", null);
    }
  } else {
    const trackData = {
      title: TRACK_TITLE,
      artist_id: artistId,
      duration_ms: 118000, // ~1:58 — will be corrected once metadata parsed
      genre: "Motivational",
      mime_type: "audio/mpeg",
      ...(fileUrl ? { file_key: R2_KEY, file_url: fileUrl, file_size_bytes: fileSizeBytes || null } : {}),
    };

    const { data: track, error } = await supabase
      .from("tracks")
      .insert(trackData)
      .select("id")
      .single();

    if (error) { console.error("   Track insert failed:", error.message); process.exit(1); }
    trackId = track.id;
    console.log(`   Created (id: ${trackId})`);
  }

  // ── Step 4: Create or find channel ────────────────────────────────────────
  console.log(`\n4. Creating channel: ${CHANNEL_NAME}...`);
  let channelId;

  const { data: existingChannel } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", CHANNEL_SLUG)
    .maybeSingle();

  if (existingChannel) {
    channelId = existingChannel.id;
    console.log(`   Already exists (id: ${channelId})`);
  } else {
    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        name: CHANNEL_NAME,
        slug: CHANNEL_SLUG,
        description: CHANNEL_DESCRIPTION,
        is_public: true,
      })
      .select("id")
      .single();

    if (error) { console.error("   Channel insert failed:", error.message); process.exit(1); }
    channelId = channel.id;
    console.log(`   Created (id: ${channelId})`);
  }

  // ── Step 5: Create or update channel_state ────────────────────────────────
  console.log(`\n5. Setting up channel_state (repeat one, playing)...`);

  const { data: existingState } = await supabase
    .from("channel_state")
    .select("id")
    .eq("channel_id", channelId)
    .maybeSingle();

  const stateData = {
    channel_id: channelId,
    current_track_id: trackId,
    is_playing: true,
    playback_started_at: new Date().toISOString(),
    position_ms: 0,
    repeat_mode: "one",    // Repeat this track forever until changed
    shuffle_enabled: false,
    priority_queue: [],
    user_queue: [],
    broadcast_mode: "automated",
  };

  if (existingState) {
    const { error } = await supabase.from("channel_state").update(stateData).eq("id", existingState.id);
    if (error) { console.error("   State update failed:", error.message); process.exit(1); }
    console.log(`   Updated existing state`);
  } else {
    const { error } = await supabase.from("channel_state").insert(stateData);
    if (error) { console.error("   State insert failed:", error.message); process.exit(1); }
    console.log(`   Created`);
  }

  // ── Step 6: Create schedule (Tuesday 9 PM) ────────────────────────────────
  console.log(`\n6. Creating schedule: Tuesday 21:00...`);

  const { data: existingSchedule } = await supabase
    .from("channel_schedules")
    .select("id")
    .eq("channel_id", channelId)
    .eq("day_of_week", 2)
    .maybeSingle();

  if (existingSchedule) {
    console.log(`   Schedule already exists`);
  } else {
    const { error } = await supabase
      .from("channel_schedules")
      .insert({
        channel_id: channelId,
        name: "Tuesday Night Motivation",
        day_of_week: 2,  // 0=Sun, 1=Mon, 2=Tue
        start_time: "21:00:00",
        end_time: "22:00:00",
        is_active: true,
      });

    if (error) { console.error("   Schedule insert failed:", error.message); process.exit(1); }
    console.log(`   Created (Tuesday 21:00–22:00)`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
=== Seed complete! ===

Channel:  ${CHANNEL_NAME}  →  /radio/${CHANNEL_SLUG}
Track:    ${TRACK_TITLE} by ${ARTIST_NAME}  (id: ${trackId})
Audio:    ${fileUrl || "NO AUDIO — upload later via /admin/library"}
Mode:     Repeat One (plays forever)
Schedule: Tuesday 21:00–22:00

Visit:    https://radio-one-topaz.vercel.app/radio/${CHANNEL_SLUG}
`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
