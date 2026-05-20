// Entity resolution for matching track references to actual tracks

import * as path from "path";
import { parseDataDirectory, ParseError } from "./parse-yaml";
import {
  fuzzyMatchTrack,
  getMatchConfidence,
  shouldAcceptMatch,
  shouldWarnMatch,
} from "../utils/fuzzy";
import type {
  ParsedData,
  ParsedTrack,
  ParsedPlaylist,
  YamlPlaylistTrackRef,
  ResolvedTrackRef,
} from "./types";

export interface ResolutionResult {
  data: ParsedData;
  warnings: string[];
  errors: string[];
}

export function resolveAllTrackRefs(data: ParsedData): ResolutionResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Build lookup indexes
  const trackByIsrc = new Map<string, ParsedTrack>();
  const trackBySpotifyUri = new Map<string, ParsedTrack>();
  const trackByMusicBrainzId = new Map<string, ParsedTrack>();

  for (const track of data.tracks) {
    if (track.identifiers?.isrc) {
      trackByIsrc.set(track.identifiers.isrc.toLowerCase(), track);
    }
    if (track.identifiers?.spotify_uri) {
      trackBySpotifyUri.set(track.identifiers.spotify_uri.toLowerCase(), track);
    }
    if (track.identifiers?.musicbrainz_id) {
      trackByMusicBrainzId.set(
        track.identifiers.musicbrainz_id.toLowerCase(),
        track
      );
    }
  }

  // Resolve references in each playlist
  for (const playlist of data.playlists) {
    for (let i = 0; i < playlist.tracks.length; i++) {
      const ref = playlist.tracks[i];
      const resolved = resolveTrackRef(
        ref.original,
        data.tracks,
        trackByIsrc,
        trackBySpotifyUri,
        trackByMusicBrainzId
      );

      playlist.tracks[i] = resolved;

      if (resolved.warning) {
        warnings.push(
          `Playlist "${playlist.name}" track ${i + 1}: ${resolved.warning}`
        );
      }

      if (!resolved.resolved) {
        errors.push(
          `Playlist "${playlist.name}" track ${i + 1}: Could not resolve reference ${JSON.stringify(ref.original)}`
        );
      }
    }
  }

  return { data, warnings, errors };
}

function resolveTrackRef(
  ref: YamlPlaylistTrackRef,
  allTracks: ParsedTrack[],
  byIsrc: Map<string, ParsedTrack>,
  bySpotifyUri: Map<string, ParsedTrack>,
  byMusicBrainzId: Map<string, ParsedTrack>
): ResolvedTrackRef {
  // Try ISRC first (most authoritative)
  if (ref.isrc) {
    const track = byIsrc.get(ref.isrc.toLowerCase());
    if (track) {
      return {
        original: ref,
        resolved: track,
        resolution_method: "isrc",
        confidence: 100,
      };
    }
  }

  // Try Spotify URI
  if (ref.spotify_uri) {
    const track = bySpotifyUri.get(ref.spotify_uri.toLowerCase());
    if (track) {
      return {
        original: ref,
        resolved: track,
        resolution_method: "spotify_uri",
        confidence: 100,
      };
    }
  }

  // Try MusicBrainz ID
  if (ref.musicbrainz_id) {
    const track = byMusicBrainzId.get(ref.musicbrainz_id.toLowerCase());
    if (track) {
      return {
        original: ref,
        resolved: track,
        resolution_method: "musicbrainz_id",
        confidence: 100,
      };
    }
  }

  // Fallback to fuzzy matching by title + artist
  if (ref.title && ref.artist) {
    const candidates = allTracks.map((track) => {
      const primaryArtist = track.artists.find((a) => a.role === "primary");
      return {
        track,
        primaryArtist: primaryArtist?.name || "",
      };
    });

    let bestMatch: { track: ParsedTrack; score: number } | null = null;

    for (const candidate of candidates) {
      const result = fuzzyMatchTrack(
        { title: candidate.track.title, primaryArtist: candidate.primaryArtist },
        { title: ref.title, artist: ref.artist }
      );

      if (result.score > (bestMatch?.score || 0)) {
        bestMatch = { track: candidate.track, score: result.score };
      }
    }

    if (bestMatch && shouldAcceptMatch(bestMatch.score)) {
      const confidence = getMatchConfidence(bestMatch.score);
      const result: ResolvedTrackRef = {
        original: ref,
        resolved: bestMatch.track,
        resolution_method: "fuzzy",
        confidence: bestMatch.score,
      };

      if (shouldWarnMatch(bestMatch.score)) {
        result.warning = `Fuzzy match with ${bestMatch.score}% confidence: "${ref.title}" by "${ref.artist}" → "${bestMatch.track.title}"`;
      }

      return result;
    }
  }

  // Could not resolve
  return {
    original: ref,
    warning: `No match found for reference`,
  };
}

// CLI entry point
if (require.main === module) {
  const dataDir = process.argv[2] || path.join(process.cwd(), "data");

  console.log(`Resolving track references from: ${dataDir}\n`);

  try {
    const data = parseDataDirectory(dataDir);
    const result = resolveAllTrackRefs(data);

    console.log("Resolution Results:");
    console.log("==================\n");

    for (const playlist of result.data.playlists) {
      console.log(`Playlist: ${playlist.name}`);
      console.log("-".repeat(40));

      for (let i = 0; i < playlist.tracks.length; i++) {
        const ref = playlist.tracks[i];
        const status = ref.resolved
          ? `✓ ${ref.resolution_method} (${ref.confidence}%)`
          : "✗ UNRESOLVED";

        const trackInfo = ref.resolved
          ? `"${ref.resolved.title}"`
          : JSON.stringify(ref.original);

        console.log(`  ${i + 1}. ${trackInfo} ${status}`);
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

    console.log("\n✓ All track references resolved successfully!");
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`\n✗ Parse error: ${err.message}`);
      if (err.file) console.error(`  File: ${err.file}`);
      process.exit(1);
    }
    throw err;
  }
}
