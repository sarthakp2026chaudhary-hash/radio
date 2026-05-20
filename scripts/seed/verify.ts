// Verify seeded data integrity

import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import type { VerificationResult } from "./types";

// Load environment variables
import "dotenv/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Check {
  name: string;
  run: () => Promise<{ passed: boolean; message: string }>;
}

const checks: Check[] = [
  {
    name: "All tracks have at least one identifier",
    run: async () => {
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("id, title, isrc, musicbrainz_recording_id, spotify_id")
        .is("isrc", null)
        .is("musicbrainz_recording_id", null)
        .is("spotify_id", null);

      if (error) throw error;

      if (tracks && tracks.length > 0) {
        return {
          passed: false,
          message: `${tracks.length} tracks without identifiers: ${tracks.slice(0, 3).map((t) => t.title).join(", ")}${tracks.length > 3 ? "..." : ""}`,
        };
      }

      return { passed: true, message: "All tracks have at least one identifier" };
    },
  },
  {
    name: "All tracks with file_url have accessible files",
    run: async () => {
      const { data: tracks, error } = await supabase
        .from("tracks")
        .select("id, title, file_url")
        .not("file_url", "is", null)
        .limit(10); // Sample check

      if (error) throw error;

      if (!tracks || tracks.length === 0) {
        return { passed: true, message: "No tracks with file_url to verify" };
      }

      const inaccessible: string[] = [];
      for (const track of tracks) {
        try {
          const response = await fetch(track.file_url!, { method: "HEAD" });
          if (!response.ok) {
            inaccessible.push(track.title);
          }
        } catch {
          inaccessible.push(track.title);
        }
      }

      if (inaccessible.length > 0) {
        return {
          passed: false,
          message: `${inaccessible.length} inaccessible files: ${inaccessible.join(", ")}`,
        };
      }

      return { passed: true, message: `Verified ${tracks.length} file URLs` };
    },
  },
  {
    name: "All playlist tracks exist",
    run: async () => {
      const { data: playlistTracks, error } = await supabase
        .from("playlist_tracks")
        .select(`
          id,
          track_id,
          tracks (id)
        `);

      if (error) throw error;

      const orphans = (playlistTracks || []).filter(
        (pt: any) => !pt.tracks
      );

      if (orphans.length > 0) {
        return {
          passed: false,
          message: `${orphans.length} playlist_tracks reference non-existent tracks`,
        };
      }

      return { passed: true, message: "All playlist tracks exist" };
    },
  },
  {
    name: "All track_artists have valid references",
    run: async () => {
      const { data: trackArtists, error } = await supabase
        .from("track_artists")
        .select(`
          id,
          track_id,
          artist_id,
          tracks (id),
          artists (id)
        `);

      if (error) throw error;

      const orphans = (trackArtists || []).filter(
        (ta: any) => !ta.tracks || !ta.artists
      );

      if (orphans.length > 0) {
        return {
          passed: false,
          message: `${orphans.length} track_artists have invalid references`,
        };
      }

      return { passed: true, message: "All track_artists are valid" };
    },
  },
  {
    name: "No orphan artists (artists with no tracks)",
    run: async () => {
      const { data: artists, error } = await supabase
        .from("artists")
        .select(`
          id,
          name,
          track_artists (id)
        `);

      if (error) throw error;

      const orphans = (artists || []).filter(
        (a: any) => !a.track_artists || a.track_artists.length === 0
      );

      if (orphans.length > 0) {
        return {
          passed: false,
          message: `${orphans.length} orphan artists: ${orphans.slice(0, 3).map((a: any) => a.name).join(", ")}`,
        };
      }

      return { passed: true, message: "No orphan artists" };
    },
  },
  {
    name: "Playlist track counts are reasonable",
    run: async () => {
      const { data: playlists, error } = await supabase
        .from("playlists")
        .select(`
          id,
          name,
          playlist_tracks (id)
        `);

      if (error) throw error;

      const empty = (playlists || []).filter(
        (p: any) => !p.playlist_tracks || p.playlist_tracks.length === 0
      );

      if (empty.length > 0) {
        return {
          passed: false,
          message: `${empty.length} empty playlists: ${empty.map((p: any) => p.name).join(", ")}`,
        };
      }

      return { passed: true, message: "All playlists have tracks" };
    },
  },
];

export async function runVerification(): Promise<VerificationResult> {
  const results: VerificationResult["checks"] = [];
  let allPassed = true;

  for (const check of checks) {
    try {
      const result = await check.run();
      results.push({
        name: check.name,
        passed: result.passed,
        message: result.message,
      });
      if (!result.passed) allPassed = false;
    } catch (err) {
      results.push({
        name: check.name,
        passed: false,
        message: `Error: ${err}`,
      });
      allPassed = false;
    }
  }

  return { passed: allPassed, checks: results };
}

// CLI entry point
if (require.main === module) {
  console.log("Data Verification");
  console.log("=================\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Error: Missing Supabase environment variables.");
    process.exit(1);
  }

  runVerification()
    .then((result) => {
      for (const check of result.checks) {
        const icon = check.passed ? "✓" : "✗";
        console.log(`${icon} ${check.name}`);
        console.log(`  ${check.message}\n`);
      }

      console.log("─".repeat(40));
      if (result.passed) {
        console.log("✓ All verification checks passed!");
      } else {
        console.log("✗ Some verification checks failed");
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
