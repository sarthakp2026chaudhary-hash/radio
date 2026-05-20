// Extract metadata from MP3 files

import * as path from "path";
import * as fs from "fs";
import { parseFile } from "music-metadata";
import { parseDataDirectory, ParseError } from "./parse-yaml";
import type { ParsedData, ParsedTrack } from "./types";

export interface ExtractedMetadata {
  duration_ms: number;
  file_size: number;
  sample_rate?: number;
  bitrate?: number;
  isrc?: string;
  album?: string;
  track_number?: number;
  disc_number?: number;
}

export interface ExtractionResult {
  data: ParsedData;
  extracted: Map<ParsedTrack, ExtractedMetadata>;
  warnings: string[];
  errors: string[];
}

export async function extractAllMetadata(
  data: ParsedData,
  musicDir: string
): Promise<ExtractionResult> {
  const extracted = new Map<ParsedTrack, ExtractedMetadata>();
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const track of data.tracks) {
    // Check if track has a local source
    if (!track.sources?.local) {
      continue; // Track is streaming-only, no local file
    }

    const filePath = path.join(musicDir, track.sources.local);

    if (!fs.existsSync(filePath)) {
      warnings.push(
        `Track "${track.title}": local file not found at ${track.sources.local}`
      );
      continue;
    }

    try {
      const metadata = await extractMetadataFromFile(filePath);
      extracted.set(track, metadata);

      // Update track with extracted data
      track.duration_ms = metadata.duration_ms;
      track.file_size = metadata.file_size;

      // Use extracted ISRC if not already set
      if (metadata.isrc && !track.identifiers?.isrc) {
        track.identifiers = track.identifiers || {};
        track.identifiers.isrc = metadata.isrc;
        console.log(`  Extracted ISRC ${metadata.isrc} from "${track.title}"`);
      }
    } catch (err) {
      errors.push(
        `Track "${track.title}": Failed to extract metadata from ${track.sources.local}: ${err}`
      );
    }
  }

  return { data, extracted, warnings, errors };
}

export async function extractMetadataFromFile(
  filePath: string
): Promise<ExtractedMetadata> {
  const stats = fs.statSync(filePath);
  const metadata = await parseFile(filePath);

  const duration_ms = Math.round((metadata.format.duration || 0) * 1000);

  // Try to extract ISRC from ID3 tags
  let isrc: string | undefined;
  if (metadata.common.isrc && metadata.common.isrc.length > 0) {
    isrc = metadata.common.isrc[0];
  }

  return {
    duration_ms,
    file_size: stats.size,
    sample_rate: metadata.format.sampleRate,
    bitrate: metadata.format.bitrate,
    isrc,
    album: metadata.common.album,
    track_number: metadata.common.track.no || undefined,
    disc_number: metadata.common.disk.no || undefined,
  };
}

// Helper to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Helper to format file size
function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// CLI entry point
if (require.main === module) {
  const dataDir = process.argv[2] || path.join(process.cwd(), "data");
  const musicDir = process.argv[3] || path.join(process.cwd(), "music");

  console.log(`Extracting metadata from: ${musicDir}\n`);

  (async () => {
    try {
      const data = parseDataDirectory(dataDir);

      console.log(`Found ${data.tracks.length} tracks in data files.\n`);

      if (!fs.existsSync(musicDir)) {
        console.log(
          `Music directory not found at ${musicDir}. Creating it...\n`
        );
        fs.mkdirSync(musicDir, { recursive: true });
      }

      const result = await extractAllMetadata(data, musicDir);

      console.log("\nExtraction Results:");
      console.log("===================\n");

      const tracksWithLocal = data.tracks.filter((t) => t.sources?.local);
      const tracksExtracted = result.extracted.size;
      const tracksStreamOnly = data.tracks.length - tracksWithLocal.length;

      console.log(`Total tracks: ${data.tracks.length}`);
      console.log(`  - With local files: ${tracksWithLocal.length}`);
      console.log(`  - Streaming only: ${tracksStreamOnly}`);
      console.log(`  - Successfully extracted: ${tracksExtracted}`);
      console.log();

      if (result.extracted.size > 0) {
        console.log("Extracted Metadata:");
        console.log("-".repeat(60));

        for (const [track, meta] of result.extracted) {
          console.log(
            `  ${track.title}: ${formatDuration(meta.duration_ms)} (${formatSize(meta.file_size)})`
          );
          if (meta.isrc) {
            console.log(`    ISRC: ${meta.isrc}`);
          }
        }
        console.log();
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of result.warnings) {
          console.log(`  ⚠ ${warning}`);
        }
      }

      if (result.errors.length > 0) {
        console.log("\nErrors:");
        for (const error of result.errors) {
          console.log(`  ✗ ${error}`);
        }
        process.exit(1);
      }

      console.log("\n✓ Metadata extraction complete!");
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(`\n✗ Parse error: ${err.message}`);
        if (err.file) console.error(`  File: ${err.file}`);
        process.exit(1);
      }
      throw err;
    }
  })();
}
