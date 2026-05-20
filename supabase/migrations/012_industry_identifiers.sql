-- Migration 012: Industry Identifiers for Music Identity System
-- Adds ISRC, MusicBrainz, Spotify, and other platform identifiers

-- ============================================
-- PART 1: Artist Identifiers
-- ============================================

ALTER TABLE artists ADD COLUMN IF NOT EXISTS
  musicbrainz_id uuid;

ALTER TABLE artists ADD COLUMN IF NOT EXISTS
  spotify_id text;

ALTER TABLE artists ADD COLUMN IF NOT EXISTS
  apple_music_id text;

ALTER TABLE artists ADD COLUMN IF NOT EXISTS
  image_url text;

-- Partial unique indexes (only enforce uniqueness when value exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_musicbrainz_id
  ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_spotify_id
  ON artists(spotify_id) WHERE spotify_id IS NOT NULL;

-- ============================================
-- PART 2: Track Identifiers
-- ============================================

-- Global identifiers
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  isrc text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  musicbrainz_recording_id uuid;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  musicbrainz_release_id uuid;

-- Platform identifiers
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  spotify_id text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  spotify_uri text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  apple_music_id text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  youtube_id text;

-- Audio fingerprint
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  acoustid text;

-- Album/release metadata
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  album_name text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  track_number int;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  disc_number int DEFAULT 1;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  release_date date;

-- Track metadata
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  genre text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  bpm int;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  key text;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS
  explicit boolean DEFAULT false;

-- Partial unique indexes for track identifiers
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_isrc
  ON tracks(isrc) WHERE isrc IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_musicbrainz_recording_id
  ON tracks(musicbrainz_recording_id) WHERE musicbrainz_recording_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_spotify_id
  ON tracks(spotify_id) WHERE spotify_id IS NOT NULL;

-- Additional indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_tracks_album_name
  ON tracks(album_name) WHERE album_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_genre
  ON tracks(genre) WHERE genre IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_release_date
  ON tracks(release_date) WHERE release_date IS NOT NULL;

-- ============================================
-- PART 3: Albums Table - Add identifier columns to existing table
-- (Albums table already exists from earlier migrations)
-- ============================================

-- Add new columns to existing albums table (idempotent)
ALTER TABLE albums ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS musicbrainz_id uuid;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS spotify_id text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS apple_music_id text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS total_tracks int;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS upc text;

-- Backfill name from existing title column if name is null
UPDATE albums SET name = title WHERE name IS NULL AND title IS NOT NULL;

-- Add unique indexes for identifiers (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_musicbrainz_id
  ON albums(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_spotify_id
  ON albums(spotify_id) WHERE spotify_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_slug
  ON albums(slug) WHERE slug IS NOT NULL;
