// Database seeding - upsert all entities to Supabase

import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseDataDirectory, ParseError } from "./parse-yaml";
import { resolveAllTrackRefs } from "./resolve-entities";
import { extractAllMetadata } from "./extract-metadata";
import { uploadAllTracks } from "./upload-r2";
import { slugify } from "../utils/slug";
import type {
  ParsedData,
  ParsedArtist,
  ParsedTrack,
  ParsedPlaylist,
  SeedResult,
} from "./types";

// Load environment variables
import "dotenv/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client that bypasses RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface UpsertedArtist {
  yaml: ParsedArtist;
  dbId: number;
}

interface UpsertedTrack {
  yaml: ParsedTrack;
  dbId: number;
}

export async function seedDatabase(
  data: ParsedData,
  options: { dryRun?: boolean } = {}
): Promise<SeedResult> {
  const result: SeedResult = {
    artists: { created: 0, updated: 0, failed: 0 },
    tracks: { created: 0, updated: 0, failed: 0 },
    playlists: { created: 0, updated: 0, failed: 0 },
    warnings: [],
    errors: [],
  };

  if (options.dryRun) {
    console.log("  [DRY RUN] Would seed database with:");
    console.log(`    - ${data.artists.length} artists`);
    console.log(`    - ${data.tracks.length} tracks`);
    console.log(`    - ${data.playlists.length} playlists`);
    return result;
  }

  // Step 1: Upsert artists
  console.log("\n  Upserting artists...");
  const artistMap = new Map<string, UpsertedArtist>();

  for (const artist of data.artists) {
    try {
      const dbArtist = await upsertArtist(artist);
      artistMap.set(artist.name.toLowerCase(), { yaml: artist, dbId: dbArtist.id });
      if (dbArtist.isNew) {
        result.artists.created++;
      } else {
        result.artists.updated++;
      }
    } catch (err) {
      result.errors.push(`Artist "${artist.name}": ${err}`);
      result.artists.failed++;
    }
  }
  console.log(
    `    ✓ ${result.artists.created} created, ${result.artists.updated} updated`
  );

  // Step 2: Upsert tracks
  console.log("\n  Upserting tracks...");
  const trackMap = new Map<string, UpsertedTrack>();

  for (const track of data.tracks) {
    try {
      // Get primary artist ID
      const primaryArtist = track.artists.find((a) => a.role === "primary");
      const artistEntry = primaryArtist
        ? artistMap.get(primaryArtist.name.toLowerCase())
        : null;

      const dbTrack = await upsertTrack(track, artistEntry?.dbId);
      trackMap.set(getTrackKey(track), { yaml: track, dbId: dbTrack.id });

      if (dbTrack.isNew) {
        result.tracks.created++;
      } else {
        result.tracks.updated++;
      }

      // Upsert track_artists junction
      await upsertTrackArtists(dbTrack.id, track.artists, artistMap);
    } catch (err) {
      result.errors.push(`Track "${track.title}": ${err}`);
      result.tracks.failed++;
    }
  }
  console.log(
    `    ✓ ${result.tracks.created} created, ${result.tracks.updated} updated`
  );

  // Step 3: Upsert playlists
  console.log("\n  Upserting playlists...");

  for (const playlist of data.playlists) {
    try {
      const dbPlaylist = await upsertPlaylist(playlist);

      // Upsert playlist_tracks junction
      await upsertPlaylistTracks(dbPlaylist.id, playlist, trackMap);

      if (dbPlaylist.isNew) {
        result.playlists.created++;
      } else {
        result.playlists.updated++;
      }
    } catch (err) {
      result.errors.push(`Playlist "${playlist.name}": ${err}`);
      result.playlists.failed++;
    }
  }
  console.log(
    `    ✓ ${result.playlists.created} created, ${result.playlists.updated} updated`
  );

  return result;
}

async function upsertArtist(
  artist: ParsedArtist
): Promise<{ id: number; isNew: boolean }> {
  // Try to find existing by identifiers first
  let existing = null;

  if (artist.identifiers?.musicbrainz_id) {
    const { data } = await supabase
      .from("artists")
      .select("id")
      .eq("musicbrainz_id", artist.identifiers.musicbrainz_id)
      .single();
    if (data) existing = data;
  }

  if (!existing && artist.identifiers?.spotify_id) {
    const { data } = await supabase
      .from("artists")
      .select("id")
      .eq("spotify_id", artist.identifiers.spotify_id)
      .single();
    if (data) existing = data;
  }

  if (!existing) {
    const { data } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", artist.slug)
      .single();
    if (data) existing = data;
  }

  const artistData = {
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio || null,
    image_url: artist.image_url || null,
    musicbrainz_id: artist.identifiers?.musicbrainz_id || null,
    spotify_id: artist.identifiers?.spotify_id || null,
    apple_music_id: artist.identifiers?.apple_music_id || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("artists")
      .update(artistData)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, isNew: false };
  }

  const { data, error } = await supabase
    .from("artists")
    .insert(artistData)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, isNew: true };
}

async function upsertTrack(
  track: ParsedTrack,
  primaryArtistId?: number
): Promise<{ id: number; isNew: boolean }> {
  // Try to find existing by identifiers
  let existing = null;

  if (track.identifiers?.isrc) {
    const { data } = await supabase
      .from("tracks")
      .select("id")
      .eq("isrc", track.identifiers.isrc)
      .single();
    if (data) existing = data;
  }

  if (!existing && track.identifiers?.spotify_id) {
    const { data } = await supabase
      .from("tracks")
      .select("id")
      .eq("spotify_id", track.identifiers.spotify_id)
      .single();
    if (data) existing = data;
  }

  if (!existing && track.identifiers?.musicbrainz_id) {
    const { data } = await supabase
      .from("tracks")
      .select("id")
      .eq("musicbrainz_recording_id", track.identifiers.musicbrainz_id)
      .single();
    if (data) existing = data;
  }

  const trackData = {
    title: track.title,
    artist_id: primaryArtistId || null,
    duration_ms: track.duration_ms || 0,
    genre: track.genre || null,
    bpm: track.bpm || null,
    track_number: track.track_number || null,
    disc_number: track.disc_number || 1,
    file_key: track.file_key || null,
    file_url: track.file_url || null,
    isrc: track.identifiers?.isrc || null,
    musicbrainz_recording_id: track.identifiers?.musicbrainz_id || null,
    spotify_id: track.identifiers?.spotify_id || null,
    spotify_uri: track.identifiers?.spotify_uri || null,
    apple_music_id: track.identifiers?.apple_music_id || null,
    youtube_id: track.identifiers?.youtube_id || null,
    acoustid: track.identifiers?.acoustid || null,
    album_name: track.album || null,
    release_date: track.release_date || null,
    key: track.key || null,
    explicit: track.explicit || false,
  };

  if (existing) {
    const { error } = await supabase
      .from("tracks")
      .update(trackData)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, isNew: false };
  }

  const { data, error } = await supabase
    .from("tracks")
    .insert(trackData)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, isNew: true };
}

async function upsertTrackArtists(
  trackId: number,
  artists: ParsedTrack["artists"],
  artistMap: Map<string, UpsertedArtist>
): Promise<void> {
  // Delete existing track_artists for this track
  await supabase.from("track_artists").delete().eq("track_id", trackId);

  // Insert new ones
  for (let i = 0; i < artists.length; i++) {
    const artistCredit = artists[i];
    const artistEntry = artistMap.get(artistCredit.name.toLowerCase());

    if (!artistEntry) {
      console.warn(`    Warning: Artist "${artistCredit.name}" not found in map`);
      continue;
    }

    const { error } = await supabase.from("track_artists").insert({
      track_id: trackId,
      artist_id: artistEntry.dbId,
      role: artistCredit.role,
      position: i,
      credit_name: artistCredit.credit_name || null,
      is_main: artistCredit.role === "primary",
    });

    if (error) {
      console.warn(`    Warning: Failed to insert track_artist: ${error.message}`);
    }
  }
}

async function upsertPlaylist(
  playlist: ParsedPlaylist
): Promise<{ id: number; isNew: boolean }> {
  const slug = slugify(playlist.name);

  // Try to find existing by slug
  const { data: existing } = await supabase
    .from("playlists")
    .select("id")
    .eq("name", playlist.name)
    .single();

  const playlistData = {
    name: playlist.name,
    description: playlist.description || null,
    cover_url: playlist.cover_url || null,
    is_public: playlist.is_public ?? true,
  };

  if (existing) {
    const { error } = await supabase
      .from("playlists")
      .update(playlistData)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, isNew: false };
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert(playlistData)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, isNew: true };
}

async function upsertPlaylistTracks(
  playlistId: number,
  playlist: ParsedPlaylist,
  trackMap: Map<string, UpsertedTrack>
): Promise<void> {
  // Delete existing playlist_tracks
  await supabase.from("playlist_tracks").delete().eq("playlist_id", playlistId);

  // Insert new ones
  for (let i = 0; i < playlist.tracks.length; i++) {
    const ref = playlist.tracks[i];
    if (!ref.resolved) continue;

    const trackEntry = trackMap.get(getTrackKey(ref.resolved));
    if (!trackEntry) {
      console.warn(
        `    Warning: Track "${ref.resolved.title}" not found in map`
      );
      continue;
    }

    const { error } = await supabase.from("playlist_tracks").insert({
      playlist_id: playlistId,
      track_id: trackEntry.dbId,
      position: i,
    });

    if (error) {
      console.warn(`    Warning: Failed to insert playlist_track: ${error.message}`);
    }
  }
}

function getTrackKey(track: ParsedTrack): string {
  // Use ISRC if available, otherwise title + primary artist
  if (track.identifiers?.isrc) return `isrc:${track.identifiers.isrc}`;
  const primary = track.artists.find((a) => a.role === "primary");
  return `title:${track.title}:${primary?.name || ""}`.toLowerCase();
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dataDir = path.join(process.cwd(), "data");
  const musicDir = path.join(process.cwd(), "music");
  const dryRun = args.includes("--dry-run");
  const skipUpload = args.includes("--skip-upload");

  console.log("Database Seeding Script");
  console.log("=======================\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Error: Missing Supabase environment variables.");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  (async () => {
    try {
      // Parse data
      console.log("Step 1: Parsing data files...");
      const data = parseDataDirectory(dataDir);
      console.log(`  ✓ Parsed ${data.artists.length} artists, ${data.tracks.length} tracks\n`);

      // Resolve references
      console.log("Step 2: Resolving track references...");
      const resolution = resolveAllTrackRefs(data);
      console.log(`  ✓ Resolved all references\n`);

      // Extract metadata
      console.log("Step 3: Extracting metadata...");
      await extractAllMetadata(data, musicDir);
      console.log(`  ✓ Metadata extracted\n`);

      // Upload (optional)
      if (!skipUpload && !dryRun) {
        console.log("Step 4: Uploading to R2...");
        const uploadResult = await uploadAllTracks(data, musicDir, { dryRun });
        console.log(
          `  ✓ ${uploadResult.uploaded} uploaded, ${uploadResult.skipped} skipped\n`
        );
      } else {
        console.log("Step 4: Upload to R2 [SKIPPED]\n");
      }

      // Seed database
      console.log("Step 5: Seeding database...");
      const result = await seedDatabase(data, { dryRun });

      // Summary
      console.log("\n" + "=".repeat(40));
      console.log("SEEDING SUMMARY");
      console.log("=".repeat(40));
      console.log(`Artists:   ${result.artists.created} created, ${result.artists.updated} updated, ${result.artists.failed} failed`);
      console.log(`Tracks:    ${result.tracks.created} created, ${result.tracks.updated} updated, ${result.tracks.failed} failed`);
      console.log(`Playlists: ${result.playlists.created} created, ${result.playlists.updated} updated, ${result.playlists.failed} failed`);

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

      console.log("\n✓ Database seeding complete!");
    } catch (err) {
      if (err instanceof ParseError) {
        console.error(`\n✗ Parse error: ${err.message}`);
        process.exit(1);
      }
      console.error("Fatal error:", err);
      process.exit(1);
    }
  })();
}
