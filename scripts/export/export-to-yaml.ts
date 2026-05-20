// Export database to YAML files

import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { writeYamlFile, ensureDir } from "../utils/yaml-io";
import { slugify } from "../utils/slug";
import type {
  YamlArtist,
  YamlTrack,
  YamlPlaylist,
  ArtistCredit,
  TrackSources,
} from "../seed/types";

// Load environment variables
import "dotenv/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ExportResult {
  artists: number;
  tracks: number;
  playlists: number;
}

export async function exportToYaml(outputDir: string): Promise<ExportResult> {
  const result: ExportResult = { artists: 0, tracks: 0, playlists: 0 };

  // Ensure directories exist
  ensureDir(path.join(outputDir, "artists"));
  ensureDir(path.join(outputDir, "tracks"));
  ensureDir(path.join(outputDir, "playlists"));

  // Export artists
  console.log("Exporting artists...");
  const { data: dbArtists, error: artistError } = await supabase
    .from("artists")
    .select("*")
    .order("name");

  if (artistError) throw artistError;

  const artists: YamlArtist[] = (dbArtists || []).map((a) => {
    const artist: YamlArtist = {
      name: a.name,
      slug: a.slug,
    };

    if (a.musicbrainz_id || a.spotify_id || a.apple_music_id) {
      artist.identifiers = {};
      if (a.musicbrainz_id) artist.identifiers.musicbrainz_id = a.musicbrainz_id;
      if (a.spotify_id) artist.identifiers.spotify_id = a.spotify_id;
      if (a.apple_music_id) artist.identifiers.apple_music_id = a.apple_music_id;
    }

    if (a.bio) artist.bio = a.bio;
    if (a.image_url) artist.image_url = a.image_url;

    return artist;
  });

  writeYamlFile(path.join(outputDir, "artists", "_index.yaml"), { artists });
  result.artists = artists.length;
  console.log(`  ✓ Exported ${artists.length} artists`);

  // Build artist name lookup
  const artistById = new Map<number, string>();
  for (const a of dbArtists || []) {
    artistById.set(a.id, a.name);
  }

  // Export tracks with track_artists
  console.log("Exporting tracks...");
  const { data: dbTracks, error: trackError } = await supabase
    .from("tracks")
    .select(`
      *,
      track_artists (
        artist_id,
        role,
        position,
        credit_name
      )
    `)
    .order("title");

  if (trackError) throw trackError;

  const tracks: YamlTrack[] = (dbTracks || []).map((t) => {
    // Build artists array
    const trackArtists = (t.track_artists || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((ta: any): ArtistCredit => {
        const credit: ArtistCredit = {
          name: artistById.get(ta.artist_id) || "Unknown",
          role: ta.role,
        };
        if (ta.credit_name) credit.credit_name = ta.credit_name;
        return credit;
      });

    const track: YamlTrack = {
      title: t.title,
      artists: trackArtists.length > 0 ? trackArtists : [{ name: "Unknown", role: "primary" }],
    };

    // Add identifiers
    if (t.isrc || t.musicbrainz_recording_id || t.spotify_uri || t.spotify_id) {
      track.identifiers = {};
      if (t.isrc) track.identifiers.isrc = t.isrc;
      if (t.musicbrainz_recording_id) track.identifiers.musicbrainz_id = t.musicbrainz_recording_id;
      if (t.spotify_uri) track.identifiers.spotify_uri = t.spotify_uri;
      if (t.spotify_id) track.identifiers.spotify_id = t.spotify_id;
      if (t.apple_music_id) track.identifiers.apple_music_id = t.apple_music_id;
      if (t.youtube_id) track.identifiers.youtube_id = t.youtube_id;
      if (t.acoustid) track.identifiers.acoustid = t.acoustid;
    }

    // Add metadata
    if (t.album_name) track.album = t.album_name;
    if (t.track_number) track.track_number = t.track_number;
    if (t.disc_number && t.disc_number !== 1) track.disc_number = t.disc_number;
    if (t.release_date) track.release_date = t.release_date;
    if (t.genre) track.genre = t.genre;
    if (t.bpm) track.bpm = t.bpm;
    if (t.key) track.key = t.key;
    if (t.explicit) track.explicit = t.explicit;

    // Add sources
    if (t.file_key || t.spotify_uri || t.youtube_id) {
      track.sources = {};
      if (t.file_key) track.sources.local = t.file_key;
      if (t.spotify_uri) track.sources.spotify = t.spotify_uri;
      if (t.youtube_id) track.sources.youtube = t.youtube_id;
    }

    return track;
  });

  writeYamlFile(path.join(outputDir, "tracks", "_index.yaml"), { tracks });
  result.tracks = tracks.length;
  console.log(`  ✓ Exported ${tracks.length} tracks`);

  // Build track lookup by ID
  const trackById = new Map<number, YamlTrack>();
  for (let i = 0; i < (dbTracks || []).length; i++) {
    trackById.set(dbTracks![i].id, tracks[i]);
  }

  // Export playlists
  console.log("Exporting playlists...");
  const { data: dbPlaylists, error: playlistError } = await supabase
    .from("playlists")
    .select(`
      *,
      playlist_tracks (
        track_id,
        position
      )
    `)
    .order("name");

  if (playlistError) throw playlistError;

  for (const p of dbPlaylists || []) {
    const playlistTracks = (p.playlist_tracks || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((pt: any) => {
        const track = trackById.get(pt.track_id);
        if (!track) return { title: "Unknown Track" };

        // Use the strongest available identifier
        if (track.identifiers?.isrc) {
          return { isrc: track.identifiers.isrc };
        }
        if (track.identifiers?.spotify_uri) {
          return { spotify_uri: track.identifiers.spotify_uri };
        }
        if (track.identifiers?.musicbrainz_id) {
          return { musicbrainz_id: track.identifiers.musicbrainz_id };
        }

        // Fallback to title + artist
        const primary = track.artists.find((a) => a.role === "primary");
        return {
          title: track.title,
          artist: primary?.name || "Unknown",
        };
      });

    const playlist: YamlPlaylist = {
      name: p.name,
      tracks: playlistTracks,
    };

    if (p.description) playlist.description = p.description;
    if (p.cover_url) playlist.cover_url = p.cover_url;
    if (p.is_public !== undefined) playlist.is_public = p.is_public;

    const filename = slugify(p.name) + ".yaml";
    writeYamlFile(path.join(outputDir, "playlists", filename), playlist);
    result.playlists++;
  }

  console.log(`  ✓ Exported ${result.playlists} playlists`);

  return result;
}

// CLI entry point
if (require.main === module) {
  const outputDir = process.argv[2] || path.join(process.cwd(), "data");

  console.log("Database Export to YAML");
  console.log("=======================\n");
  console.log(`Output directory: ${outputDir}\n`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Error: Missing Supabase environment variables.");
    process.exit(1);
  }

  exportToYaml(outputDir)
    .then((result) => {
      console.log("\n" + "─".repeat(40));
      console.log("Export Summary:");
      console.log(`  Artists:   ${result.artists}`);
      console.log(`  Tracks:    ${result.tracks}`);
      console.log(`  Playlists: ${result.playlists}`);
      console.log("\n✓ Export complete!");
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
