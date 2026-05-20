// Upload audio files to R2 with deduplication

import * as path from "path";
import * as fs from "fs";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { parseDataDirectory, ParseError } from "./parse-yaml";
import { resolveAllTrackRefs } from "./resolve-entities";
import { extractAllMetadata } from "./extract-metadata";
import { slugify } from "../utils/slug";
import type { ParsedData, ParsedTrack } from "./types";

// Load environment variables for standalone script execution
import "dotenv/config";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "radio-music";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadResult {
  track: ParsedTrack;
  key: string;
  url: string;
  uploaded: boolean;
  skipped: boolean;
  error?: string;
}

export interface UploadSummary {
  data: ParsedData;
  results: UploadResult[];
  uploaded: number;
  skipped: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

function generateKey(track: ParsedTrack): string {
  const primaryArtist = track.artists.find((a) => a.role === "primary");
  const artistSlug = primaryArtist ? slugify(primaryArtist.name) : "unknown";
  const titleSlug = slugify(track.title);
  return `music/${artistSlug}/${titleSlug}.mp3`;
}

async function checkExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(
  filePath: string,
  key: string,
  contentType: string = "audio/mpeg"
): Promise<{ url: string; size: number }> {
  const fileBuffer = fs.readFileSync(filePath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  return {
    url: `${R2_PUBLIC_URL}/${key}`,
    size: fileBuffer.length,
  };
}

export async function uploadAllTracks(
  data: ParsedData,
  musicDir: string,
  options: { skipExisting?: boolean; dryRun?: boolean } = {}
): Promise<UploadSummary> {
  const results: UploadResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const track of data.tracks) {
    // Skip tracks without local files
    if (!track.sources?.local) {
      continue;
    }

    const localPath = path.join(musicDir, track.sources.local);
    const key = generateKey(track);

    // Check if file exists locally
    if (!fs.existsSync(localPath)) {
      warnings.push(`Track "${track.title}": local file not found`);
      continue;
    }

    // Check if already uploaded
    if (options.skipExisting !== false) {
      const exists = await checkExists(key);
      if (exists) {
        results.push({
          track,
          key,
          url: `${R2_PUBLIC_URL}/${key}`,
          uploaded: false,
          skipped: true,
        });
        skipped++;

        // Update track with URL
        track.file_key = key;
        track.file_url = `${R2_PUBLIC_URL}/${key}`;
        continue;
      }
    }

    // Upload
    if (options.dryRun) {
      console.log(`  [DRY RUN] Would upload: ${localPath} → ${key}`);
      results.push({
        track,
        key,
        url: `${R2_PUBLIC_URL}/${key}`,
        uploaded: false,
        skipped: true,
      });
      skipped++;
      continue;
    }

    try {
      const result = await uploadFile(localPath, key);
      results.push({
        track,
        key,
        url: result.url,
        uploaded: true,
        skipped: false,
      });
      uploaded++;

      // Update track with URL
      track.file_key = key;
      track.file_url = result.url;

      console.log(`  ✓ Uploaded: ${track.title} (${formatSize(result.size)})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        track,
        key,
        url: "",
        uploaded: false,
        skipped: false,
        error: errorMsg,
      });
      errors.push(`Track "${track.title}": upload failed - ${errorMsg}`);
      failed++;
    }
  }

  return {
    data,
    results,
    uploaded,
    skipped,
    failed,
    warnings,
    errors,
  };
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dataDir = path.join(process.cwd(), "data");
  const musicDir = path.join(process.cwd(), "music");
  const dryRun = args.includes("--dry-run");

  console.log("R2 Upload Script");
  console.log("================\n");

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
    console.error("Error: Missing R2 environment variables.");
    console.error("Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL");
    process.exit(1);
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be uploaded\n");
  }

  (async () => {
    try {
      // Parse data
      console.log("Parsing data files...");
      const data = parseDataDirectory(dataDir);
      console.log(`  Found ${data.tracks.length} tracks\n`);

      // Resolve references
      console.log("Resolving track references...");
      resolveAllTrackRefs(data);

      // Extract metadata
      console.log("Extracting metadata...");
      await extractAllMetadata(data, musicDir);

      // Upload
      console.log("\nUploading to R2...");
      console.log("-".repeat(40));

      const result = await uploadAllTracks(data, musicDir, { dryRun });

      console.log("\n" + "=".repeat(40));
      console.log("UPLOAD SUMMARY");
      console.log("=".repeat(40));
      console.log(`  Uploaded: ${result.uploaded}`);
      console.log(`  Skipped (already exists): ${result.skipped}`);
      console.log(`  Failed: ${result.failed}`);

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const w of result.warnings) {
          console.log(`  ⚠ ${w}`);
        }
      }

      if (result.errors.length > 0) {
        console.log("\nErrors:");
        for (const e of result.errors) {
          console.log(`  ✗ ${e}`);
        }
        process.exit(1);
      }

      console.log("\n✓ Upload complete!");
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(`\n✗ Parse error: ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  })();
}
