// Parse and validate YAML data files

import * as path from "path";
import {
  readYamlFile,
  readYamlFileIfExists,
  listYamlFiles,
} from "../utils/yaml-io";
import { slugify } from "../utils/slug";
import type {
  YamlSchema,
  YamlArtist,
  YamlTrack,
  YamlPlaylist,
  YamlChannel,
  ParsedArtist,
  ParsedTrack,
  ParsedPlaylist,
  ParsedData,
  ArtistsFile,
  TracksFile,
  ResolvedTrackRef,
} from "./types";

const EXPECTED_SCHEMA_VERSION = "2.0";

export class ParseError extends Error {
  constructor(
    message: string,
    public file?: string,
    public line?: number
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseDataDirectory(dataDir: string): ParsedData {
  const schemaPath = path.join(dataDir, "schema.yaml");
  const artistsPath = path.join(dataDir, "artists", "_index.yaml");
  const tracksPath = path.join(dataDir, "tracks", "_index.yaml");
  const playlistsDir = path.join(dataDir, "playlists");
  const channelsDir = path.join(dataDir, "channels");

  // Parse schema
  const schema = readYamlFile<YamlSchema>(schemaPath);
  if (schema.version !== EXPECTED_SCHEMA_VERSION) {
    throw new ParseError(
      `Schema version mismatch: expected ${EXPECTED_SCHEMA_VERSION}, got ${schema.version}`,
      schemaPath
    );
  }

  // Parse artists
  const artistsFile = readYamlFileIfExists<ArtistsFile>(artistsPath, {
    artists: [],
  });
  const artists = parseArtists(artistsFile.artists, artistsPath);

  // Build artist name lookup
  const artistByName = new Map<string, ParsedArtist>();
  for (const artist of artists) {
    artistByName.set(artist.name.toLowerCase(), artist);
  }

  // Parse tracks
  const tracksFile = readYamlFileIfExists<TracksFile>(tracksPath, {
    tracks: [],
  });
  const tracks = parseTracks(tracksFile.tracks, artistByName, tracksPath);

  // Parse playlists
  const playlistFiles = listYamlFiles(playlistsDir);
  const playlists: ParsedPlaylist[] = [];
  for (const file of playlistFiles) {
    if (path.basename(file).startsWith("_")) continue; // Skip index files
    const playlist = readYamlFile<YamlPlaylist>(file);
    playlists.push(parsePlaylist(playlist, tracks, file));
  }

  // Parse channels
  const channelFiles = listYamlFiles(channelsDir);
  const channels: YamlChannel[] = [];
  for (const file of channelFiles) {
    if (path.basename(file).startsWith("_")) continue;
    const channel = readYamlFile<YamlChannel>(file);
    channels.push(channel);
  }

  return {
    schema,
    artists,
    tracks,
    playlists,
    channels,
  };
}

function parseArtists(
  artists: YamlArtist[],
  filePath: string
): ParsedArtist[] {
  const result: ParsedArtist[] = [];
  const slugs = new Set<string>();

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];

    if (!artist.name) {
      throw new ParseError(
        `Artist at index ${i} missing required field: name`,
        filePath
      );
    }

    const slug = artist.slug || slugify(artist.name);

    if (slugs.has(slug)) {
      throw new ParseError(
        `Duplicate artist slug: ${slug} (from "${artist.name}")`,
        filePath
      );
    }
    slugs.add(slug);

    result.push({
      ...artist,
      slug,
    });
  }

  return result;
}

function parseTracks(
  tracks: YamlTrack[],
  artistByName: Map<string, ParsedArtist>,
  filePath: string
): ParsedTrack[] {
  const result: ParsedTrack[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];

    if (!track.title) {
      throw new ParseError(
        `Track at index ${i} missing required field: title`,
        filePath
      );
    }

    if (!track.artists || track.artists.length === 0) {
      throw new ParseError(
        `Track "${track.title}" missing required field: artists`,
        filePath
      );
    }

    // Validate artist references
    for (const artistRef of track.artists) {
      if (!artistRef.name) {
        throw new ParseError(
          `Track "${track.title}" has artist entry without name`,
          filePath
        );
      }

      const artistExists = artistByName.has(artistRef.name.toLowerCase());
      if (!artistExists) {
        throw new ParseError(
          `Track "${track.title}" references unknown artist: "${artistRef.name}"`,
          filePath
        );
      }
    }

    result.push(track);
  }

  return result;
}

function parsePlaylist(
  playlist: YamlPlaylist,
  tracks: ParsedTrack[],
  filePath: string
): ParsedPlaylist {
  if (!playlist.name) {
    throw new ParseError(`Playlist missing required field: name`, filePath);
  }

  if (!playlist.tracks || !Array.isArray(playlist.tracks)) {
    throw new ParseError(
      `Playlist "${playlist.name}" missing required field: tracks`,
      filePath
    );
  }

  // Resolve track references (preliminary - full resolution in resolve-entities.ts)
  const resolvedTracks: ResolvedTrackRef[] = playlist.tracks.map((ref) => ({
    original: ref,
    // Resolution will be done later
  }));

  return {
    name: playlist.name,
    description: playlist.description,
    cover_url: playlist.cover_url,
    is_public: playlist.is_public ?? true,
    tracks: resolvedTracks,
  };
}

// CLI entry point
if (require.main === module) {
  const dataDir = process.argv[2] || path.join(process.cwd(), "data");

  console.log(`Parsing data from: ${dataDir}\n`);

  try {
    const data = parseDataDirectory(dataDir);

    console.log(`✓ Schema version: ${data.schema.version}`);
    console.log(`✓ Artists: ${data.artists.length}`);
    console.log(`✓ Tracks: ${data.tracks.length}`);
    console.log(`✓ Playlists: ${data.playlists.length}`);
    console.log(`✓ Channels: ${data.channels.length}`);

    console.log("\nArtists:");
    for (const artist of data.artists) {
      const ids = [];
      if (artist.identifiers?.musicbrainz_id) ids.push("MB");
      if (artist.identifiers?.spotify_id) ids.push("Spotify");
      console.log(`  - ${artist.name} [${ids.join(", ") || "no IDs"}]`);
    }

    console.log("\nTracks:");
    for (const track of data.tracks) {
      const ids = [];
      if (track.identifiers?.isrc) ids.push("ISRC");
      if (track.identifiers?.spotify_uri) ids.push("Spotify");
      if (track.identifiers?.musicbrainz_id) ids.push("MB");
      const primaryArtist = track.artists.find((a) => a.role === "primary");
      console.log(
        `  - ${track.title} by ${primaryArtist?.name || "Unknown"} [${ids.join(", ") || "no IDs"}]`
      );
    }

    console.log("\nPlaylists:");
    for (const playlist of data.playlists) {
      console.log(`  - ${playlist.name} (${playlist.tracks.length} tracks)`);
    }

    console.log("\n✓ Parsing complete!");
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`\n✗ Parse error: ${err.message}`);
      if (err.file) console.error(`  File: ${err.file}`);
      process.exit(1);
    }
    throw err;
  }
}
