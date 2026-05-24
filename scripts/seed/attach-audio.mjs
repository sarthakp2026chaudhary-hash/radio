/**
 * Attach audio files to songs (upload to R2 + set file_url/file_key/duration).
 *
 * The "give me audio for <song>" workflow: edit CONFIG below (file path + title
 * + artist names), then run:
 *     node scripts/seed/attach-audio.mjs
 *
 * For each entry it: uploads the MP3 to R2, reads its real duration, finds the
 * existing track by title + artist (or creates the track + artist if missing),
 * and updates its audio fields. Idempotent-ish: re-running just re-points the
 * same R2 key and updates the row.
 */
import { readFileSync, existsSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

// ── Edit this list to attach more audio ──────────────────────────────────────
const CONFIG = [
  {
    file: "C:\\Users\\lenovo\\Downloads\\Lewis Capaldi - Before You Go (Official Video) - LewisCapaldiVEVO.mp3",
    title: "Before You Go",
    artists: ["Lewis Capaldi"],
  },
  {
    file: "C:\\Users\\lenovo\\Downloads\\Charlie Puth - One Call Away [Official Video] - Charlie Puth.mp3",
    title: "One Call Away",
    artists: ["Charlie Puth"],
  },
];

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]) {
  if (!process.env[k]) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function findOrCreateArtist(name) {
  const clean = name.trim();
  const slug = slugify(clean) || "unknown";
  const { data: ex } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from("artists").insert({ name: clean, slug }).select("id").single();
  if (error) { const { data: again } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle(); if (again) return again.id; throw error; }
  return data.id;
}

async function findTrack(title, primaryArtistId) {
  const { data: candidates } = await supabase.from("tracks").select("id").eq("title", title);
  for (const c of candidates || []) {
    const { data: link } = await supabase.from("track_artists").select("track_id").eq("track_id", c.id).eq("artist_id", primaryArtistId).maybeSingle();
    if (link) return c.id;
  }
  return null;
}

async function main() {
  for (const entry of CONFIG) {
    console.log(`\n── ${entry.title} — ${entry.artists.join(", ")} ──`);
    if (!existsSync(entry.file)) { console.error(`  SKIP: file not found: ${entry.file}`); continue; }

    const buffer = readFileSync(entry.file);
    let durationMs = 0;
    try {
      const meta = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
      durationMs = Math.round((meta.format.duration || 0) * 1000);
    } catch { /* duration optional */ }

    const artistIds = [];
    for (const n of entry.artists) artistIds.push(await findOrCreateArtist(n));
    const primaryId = artistIds[0] ?? null;
    const primarySlug = slugify(entry.artists[0] || "unknown") || "unknown";

    const key = `music/${primarySlug}/${slugify(entry.title)}.mp3`;
    const fileUrl = `${R2_PUBLIC_URL}/${key}`;
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: "audio/mpeg" }));
    console.log(`  uploaded → ${fileUrl} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${(durationMs / 1000).toFixed(0)}s)`);

    const audio = { file_key: key, file_url: fileUrl, file_size_bytes: buffer.length, mime_type: "audio/mpeg", ...(durationMs ? { duration_ms: durationMs } : {}) };

    let trackId = await findTrack(entry.title, primaryId);
    if (trackId) {
      const { error } = await supabase.from("tracks").update(audio).eq("id", trackId);
      if (error) { console.error(`  track update failed: ${error.message}`); continue; }
      console.log(`  attached to existing track #${trackId}`);
    } else {
      const { data: track, error } = await supabase.from("tracks").insert({ title: entry.title, artist_id: primaryId, ...audio }).select("id").single();
      if (error) { console.error(`  track create failed: ${error.message}`); continue; }
      trackId = track.id;
      const rows = artistIds.map((aid, i) => ({ track_id: trackId, artist_id: aid, role: i === 0 ? "primary" : "featured", position: i }));
      await supabase.from("track_artists").insert(rows);
      console.log(`  created track #${trackId} (not in any playlist yet)`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("attach-audio failed:", e); process.exit(1); });
