// Types for the music identity seeding system

export type ArtistRole = "primary" | "featured" | "producer" | "remixer";

export interface ArtistIdentifiers {
  musicbrainz_id?: string;
  spotify_id?: string;
  apple_music_id?: string;
}

export interface TrackIdentifiers {
  isrc?: string;
  musicbrainz_id?: string;
  spotify_uri?: string;
  spotify_id?: string;
  apple_music_id?: string;
  youtube_id?: string;
  acoustid?: string;
}

export interface TrackSources {
  local?: string;
  spotify?: string;
  youtube?: string;
  apple_music?: string;
}

export interface ArtistCredit {
  name: string;
  role: ArtistRole;
  credit_name?: string;
}

// YAML Data Types (what we read from files)

export interface YamlArtist {
  name: string;
  slug?: string;
  identifiers?: ArtistIdentifiers;
  bio?: string;
  image_url?: string;
  genres?: string[];
}

export interface YamlTrack {
  title: string;
  identifiers?: TrackIdentifiers;
  artists: ArtistCredit[];
  album?: string;
  track_number?: number;
  disc_number?: number;
  release_date?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  explicit?: boolean;
  sources?: TrackSources;
}

export interface YamlPlaylistTrackRef {
  isrc?: string;
  spotify_uri?: string;
  musicbrainz_id?: string;
  title?: string;
  artist?: string;
}

export interface YamlPlaylist {
  name: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
  tracks: YamlPlaylistTrackRef[];
}

export interface YamlChannel {
  name: string;
  slug: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
  default_playlist?: string;
  schedule?: YamlScheduleEntry[];
}

export interface YamlScheduleEntry {
  name: string;
  playlist: string;
  days?: number[];
  start_time: string;
  end_time: string;
}

export interface YamlSchema {
  version: string;
  format: string;
  description: string;
  identity_priority: string[];
}

// Parsed Data Types (after validation and enrichment)

export interface ParsedArtist extends YamlArtist {
  slug: string;
}

export interface ParsedTrack extends YamlTrack {
  // Added from MP3 metadata extraction
  duration_ms?: number;
  file_size?: number;
  sample_rate?: number;
  bitrate?: number;
  // Added from R2 upload
  file_key?: string;
  file_url?: string;
}

export interface ResolvedTrackRef {
  original: YamlPlaylistTrackRef;
  resolved?: ParsedTrack;
  resolution_method?: "isrc" | "spotify_uri" | "musicbrainz_id" | "fuzzy";
  confidence?: number;
  warning?: string;
}

export interface ParsedPlaylist extends Omit<YamlPlaylist, "tracks"> {
  tracks: ResolvedTrackRef[];
}

// Database Insert Types

export interface DbArtistInsert {
  name: string;
  slug: string;
  bio?: string;
  image_url?: string;
  musicbrainz_id?: string;
  spotify_id?: string;
  apple_music_id?: string;
}

export interface DbTrackInsert {
  title: string;
  artist_id?: number;
  duration_ms: number;
  genre?: string;
  bpm?: number;
  track_number?: number;
  disc_number?: number;
  cover_url?: string;
  file_key?: string;
  file_url?: string;
  file_size_bytes?: number;
  isrc?: string;
  musicbrainz_recording_id?: string;
  musicbrainz_release_id?: string;
  spotify_id?: string;
  spotify_uri?: string;
  apple_music_id?: string;
  youtube_id?: string;
  acoustid?: string;
  album_name?: string;
  release_date?: string;
  key?: string;
  explicit?: boolean;
}

export interface DbTrackArtistInsert {
  track_id: number;
  artist_id: number;
  role: ArtistRole;
  position: number;
  credit_name?: string;
  is_main?: boolean;
}

export interface DbPlaylistInsert {
  name: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
}

export interface DbPlaylistTrackInsert {
  playlist_id: number;
  track_id: number;
  position: number;
}

// Seeding Result Types

export interface SeedResult {
  artists: {
    created: number;
    updated: number;
    failed: number;
  };
  tracks: {
    created: number;
    updated: number;
    failed: number;
  };
  playlists: {
    created: number;
    updated: number;
    failed: number;
  };
  warnings: string[];
  errors: string[];
}

export interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

// File index types

export interface ArtistsFile {
  artists: YamlArtist[];
}

export interface TracksFile {
  tracks: YamlTrack[];
}

export interface ParsedData {
  schema: YamlSchema;
  artists: ParsedArtist[];
  tracks: ParsedTrack[];
  playlists: ParsedPlaylist[];
  channels: YamlChannel[];
}
