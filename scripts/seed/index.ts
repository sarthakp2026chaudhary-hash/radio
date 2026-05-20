// Main seeding entry point
// Full pipeline: parse → resolve → extract → upload → seed → verify

import * as path from "path";
import * as fs from "fs";
import { parseDataDirectory, ParseError } from "./parse-yaml";
import { resolveAllTrackRefs } from "./resolve-entities";
import { extractAllMetadata } from "./extract-metadata";
import type { ParsedData, SeedResult } from "./types";

interface SeedOptions {
  dataDir: string;
  musicDir: string;
  dryRun: boolean;
  skipUpload: boolean;
  only?: "artists" | "tracks" | "playlists";
}

async function seed(options: SeedOptions): Promise<SeedResult> {
  const result: SeedResult = {
    artists: { created: 0, updated: 0, failed: 0 },
    tracks: { created: 0, updated: 0, failed: 0 },
    playlists: { created: 0, updated: 0, failed: 0 },
    warnings: [],
    errors: [],
  };

  console.log("╔════════════════════════════════════════╗");
  console.log("║        MUSIC LIBRARY SEEDER            ║");
  console.log("╚════════════════════════════════════════╝\n");

  if (options.dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Step 1: Parse YAML files
  console.log("Step 1: Parsing YAML files...");
  console.log("-".repeat(40));

  let data: ParsedData;
  try {
    data = parseDataDirectory(options.dataDir);
    console.log(`  ✓ Schema version: ${data.schema.version}`);
    console.log(`  ✓ Artists: ${data.artists.length}`);
    console.log(`  ✓ Tracks: ${data.tracks.length}`);
    console.log(`  ✓ Playlists: ${data.playlists.length}`);
    console.log(`  ✓ Channels: ${data.channels.length}`);
  } catch (err) {
    if (err instanceof ParseError) {
      result.errors.push(`Parse error: ${err.message}`);
      return result;
    }
    throw err;
  }

  // Step 2: Resolve track references
  console.log("\nStep 2: Resolving track references...");
  console.log("-".repeat(40));

  const resolution = resolveAllTrackRefs(data);
  result.warnings.push(...resolution.warnings);
  result.errors.push(...resolution.errors);

  const resolvedCount = data.playlists.reduce(
    (sum, p) => sum + p.tracks.filter((t) => t.resolved).length,
    0
  );
  const totalRefs = data.playlists.reduce((sum, p) => sum + p.tracks.length, 0);
  console.log(`  ✓ Resolved ${resolvedCount}/${totalRefs} track references`);

  if (resolution.warnings.length > 0) {
    console.log(`  ⚠ ${resolution.warnings.length} warnings`);
  }

  // Step 3: Extract metadata from local files
  console.log("\nStep 3: Extracting MP3 metadata...");
  console.log("-".repeat(40));

  const extraction = await extractAllMetadata(data, options.musicDir);
  result.warnings.push(...extraction.warnings);
  result.errors.push(...extraction.errors);

  const tracksWithLocal = data.tracks.filter((t) => t.sources?.local).length;
  console.log(`  ✓ Found ${tracksWithLocal} tracks with local files`);
  console.log(`  ✓ Extracted metadata from ${extraction.extracted.size} files`);

  if (extraction.warnings.length > 0) {
    console.log(`  ⚠ ${extraction.warnings.length} missing files`);
  }

  // Step 4: Upload to R2 (skip in dry run or if --skip-upload)
  if (!options.skipUpload && !options.dryRun) {
    console.log("\nStep 4: Uploading to R2...");
    console.log("-".repeat(40));
    try {
      const { uploadAllTracks } = await import("./upload-r2");
      const uploadResult = await uploadAllTracks(data, options.musicDir, {
        dryRun: options.dryRun,
      });
      console.log(`  ✓ Uploaded: ${uploadResult.uploaded}`);
      console.log(`  ✓ Skipped (exists): ${uploadResult.skipped}`);
      if (uploadResult.failed > 0) {
        console.log(`  ✗ Failed: ${uploadResult.failed}`);
      }
      result.warnings.push(...uploadResult.warnings);
      result.errors.push(...uploadResult.errors);
    } catch (err) {
      console.log("  ⚠ Upload skipped (R2 not configured)");
      result.warnings.push(`R2 upload skipped: ${err}`);
    }
  } else {
    console.log("\nStep 4: Upload to R2 [SKIPPED]");
    console.log("-".repeat(40));
    console.log(
      options.dryRun ? "  (dry run mode)" : "  (--skip-upload flag)"
    );
  }

  // Step 5: Seed database (skip in dry run)
  if (!options.dryRun) {
    console.log("\nStep 5: Seeding database...");
    console.log("-".repeat(40));
    try {
      const { seedDatabase } = await import("./seed-db");
      const seedResult = await seedDatabase(data, { dryRun: options.dryRun });
      result.artists = seedResult.artists;
      result.tracks = seedResult.tracks;
      result.playlists = seedResult.playlists;
      result.warnings.push(...seedResult.warnings);
      result.errors.push(...seedResult.errors);
    } catch (err) {
      console.log("  ⚠ Database seed skipped (Supabase not configured)");
      result.warnings.push(`Database seed skipped: ${err}`);
    }
  } else {
    console.log("\nStep 5: Seed database [SKIPPED]");
    console.log("-".repeat(40));
    console.log("  (dry run mode)");
  }

  // Summary
  console.log("\n" + "═".repeat(40));
  console.log("SUMMARY");
  console.log("═".repeat(40));

  console.log(`\nData parsed:`);
  console.log(`  Artists:   ${data.artists.length}`);
  console.log(`  Tracks:    ${data.tracks.length}`);
  console.log(`  Playlists: ${data.playlists.length}`);
  console.log(`  Channels:  ${data.channels.length}`);

  if (result.warnings.length > 0) {
    console.log(`\n⚠ Warnings: ${result.warnings.length}`);
    for (const warning of result.warnings.slice(0, 5)) {
      console.log(`  - ${warning}`);
    }
    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n✗ Errors: ${result.errors.length}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (options.dryRun) {
    console.log("\n🔍 Dry run complete. No changes were made.");
  } else if (result.errors.length === 0) {
    console.log("\n✓ Seeding complete!");
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  const options: SeedOptions = {
    dataDir: path.join(process.cwd(), "data"),
    musicDir: path.join(process.cwd(), "music"),
    dryRun: args.includes("--dry-run"),
    skipUpload: args.includes("--skip-upload"),
  };

  // Parse --only flag
  const onlyIndex = args.indexOf("--only");
  if (onlyIndex !== -1 && args[onlyIndex + 1]) {
    const value = args[onlyIndex + 1] as "artists" | "tracks" | "playlists";
    if (["artists", "tracks", "playlists"].includes(value)) {
      options.only = value;
    }
  }

  seed(options)
    .then((result) => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
