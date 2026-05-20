# Music Library Data Format

This directory contains the portable, text-based source of truth for the Radio app's music library.

## Core Principle

**Text is the source of truth.** The YAML files in this directory capture track identity completely - even if you delete all MP3 files, the data structure survives. A track's identity is NOT its filename or database ID; it's a constellation of identifiers across multiple systems.

## Identity Layers

### Layer 1: Global Identifiers
- **ISRC** (International Standard Recording Code) - `USUG12000420`
- **MusicBrainz Recording ID** - UUID from the open music database
- **ISWC** (for compositions) - Not currently used

### Layer 2: Platform Identifiers
- **Spotify URI** - `spotify:track:0VjIjW6FFFbBbNlL`
- **Apple Music ID**
- **YouTube Video ID**

### Layer 3: Audio Identifiers
- **AcoustID** - Audio fingerprint (future)
- **Local file path** - `music/the-weeknd/blinding-lights.mp3`

## Directory Structure

```
data/
├── schema.yaml           # Format specification (v2.0)
├── README.md             # This file
├── artists/
│   └── _index.yaml       # All artists
├── tracks/
│   └── _index.yaml       # All tracks
├── playlists/
│   └── *.yaml            # One file per playlist
└── channels/
    └── *.yaml            # One file per channel
```

## Quick Start

### Adding an Artist

Edit `artists/_index.yaml`:

```yaml
artists:
  - name: "Daft Punk"
    slug: daft-punk
    identifiers:
      musicbrainz_id: 056e4f3e-d505-4dad-8ec1-d04f521cbb56
      spotify_id: 4tZwfgrHOc3mvqYlEYSvVi
    genres: [french house, electronic]
```

### Adding a Track

Edit `tracks/_index.yaml`:

```yaml
tracks:
  - title: "Get Lucky"
    identifiers:
      isrc: USUG11300948
      spotify_uri: spotify:track:69kOkLUCkxIZYexIgSG8rq
    artists:
      - name: Daft Punk
        role: primary
      - name: Pharrell Williams
        role: featured
    album: Random Access Memories
    release_date: 2013-05-17
    genre: disco
    bpm: 116
    sources:
      local: music/daft-punk/get-lucky.mp3
      spotify: spotify:track:69kOkLUCkxIZYexIgSG8rq
```

### Creating a Playlist

Create `playlists/late-night-vibes.yaml`:

```yaml
name: Late Night Vibes
description: Chill tracks for late night sessions
is_public: true

tracks:
  - isrc: USUG12000420         # Reference by ISRC (preferred)
  - spotify_uri: spotify:track:69kOkLU...  # Or by Spotify URI
  - title: Starboy             # Fallback: title + artist
    artist: The Weeknd
```

## Resolution Priority

When seeding, tracks are matched in this order:

1. **ISRC** - Most authoritative, globally unique
2. **MusicBrainz ID** - Open database, stable
3. **Spotify URI** - Platform-specific but widely available
4. **Title + Artist** - Fallback with fuzzy matching

## Commands

```bash
# Parse and validate data files
npm run seed:parse

# Full seed to database
npm run seed

# Dry run (validate without inserting)
npm run seed -- --dry-run

# Export database to YAML
npm run export

# Verify seeded data
npm run seed:verify
```

## FAQ

### Why YAML instead of JSON?
- Human-readable and easy to edit
- Supports comments for documentation
- Cleaner syntax for nested structures

### Why not store duration in YAML?
Duration is extracted from the audio file at seed time. This ensures:
- YAML stays clean and focused on identity
- Duration is always accurate to the actual file
- No manual entry errors

### Can a track exist without an audio file?
Yes! A track with identifiers but no `sources.local` will be created in the database with `file_url: null`. This allows:
- Planning playlists before acquiring files
- Referencing Spotify-only tracks
- Migrating to streaming services later

### How do I handle remixes?
Different recordings of the same song should have:
- Different ISRCs (they're different recordings)
- Clear title distinction ("Track Name (Artist Remix)")
- Remixer credited with `role: remixer`

```yaml
- title: "Get Lucky (Daft Punk Remix)"
  identifiers:
    isrc: DIFFERENT_ISRC
  artists:
    - name: Original Artist
      role: primary
    - name: Daft Punk
      role: remixer
```

## Schema Version

Current: **2.0**

See `schema.yaml` for the full specification.
