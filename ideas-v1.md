# Ideas v1 — Radio as a Text-First DJ & Knowledge-Graph Platform

Date: 2026-05-22 · Status: product brief (extends feedback-v1.md)

## The one-liner
A private, late-night "radio in a friend's room" that is **text-first**: the unit of value is a *curated song, in a playlist, in a genre* — not an audio file. Audio is optional. The owner curates like a DJ; friends just tune in.

## Principles
1. **Text-first, audio-optional.** A song needs only a title. Artist, album, and audio are optional. A missing artist/album is a real, first-class value: **"Unknown."** A missing audio file just means the channel advances on a timer (silent) — it never breaks.
2. **Curation over files.** The owner's taste — *which songs, in which playlists, in which genres, and how they connect* — is the product. (~7 genres of playlists, handed off as knowledge graphs.)
3. **Friends-first, minimal for listeners.** A listener opening a channel should see almost nothing: how many songs are on loop, when the channel was last updated, and what's next. Not even the current song's name/artist (it can stay "unknown").
4. **The library is a graph ("the brain").** Songs, artists, playlists and genres form one connected map. A song exists **once** and links to every playlist it's in; artists are shared; genres overlap (a rock song with a sad lyric belongs to both). Eventually: one interactive graph of the whole brain.

## The data model (normalized "brain")
**Folder (nestable) → Playlist → Song ← Artist**, many-to-many where it matters:

- **Folder** — a genre/vibe grouping; can nest (e.g. "Beam me up, jesus." › "SARTHAKJAZZ"). `{ id, name, parent_id, position, color }`.
- **Playlist** — belongs to a folder. `{ id, name, description, folder_id, created/updated }`.
- **Song (track)** — exists **once**, linked to every playlist it appears in (many-to-many via `playlist_tracks`). `{ id, title, duration?, audio?, identifiers? }`. Title is the only requirement.
- **Artist** — shared across songs/playlists (many-to-many via `track_artists`, with roles). `{ id, name, slug }`. **"Unknown"** is a seeded canonical artist.
- **Cross-genre / cross-playlist sharing is the point:** the same song or artist node connects across playlists and genres. Importing a second genre's graph automatically reveals shared nodes.

This mirrors the handed-off graph (`knowledge_graph_v9`): 4 node types (Folder, Playlist, Song, Artist), songs deduped and linked to many playlists, multi-artist common, and "Unknown (unavailable)" already present in the data.

## Import schema (how a genre is handed off)
```yaml
folders:                      # nestable
  - name: "Beam me up, jesus."
    color: null
    playlists:
      - name: "Beamed"
        description: "it is over Lenny, I'm sorry"
        songs:
          - title: "Summer Rain"
            artists: ["Quarters"]      # optional; [] or ["Unknown"] → Unknown artist
    folders:                  # sub-folders nest the same way
      - name: "SARTHAKJAZZ"
        playlists: [ ... ]
```
On import: find-or-create artists by name (Unknown when absent); find-or-create songs (dedupe by title+artists now; by ISRC/Spotify later); link songs↔playlists; nest folders. Re-running with another genre **merges** shared songs/artists.

### First genre handed off: "mellow / slow" (Sarthak's Music Map)
Structure only (songs/artists are stored as nodes, not enumerated here):
- Folder **"Beam me up, jesus."** → playlist **"Beamed"** (~48 songs) + sub-folder **"SARTHAKJAZZ"** with **Car17 (jazz in my pants)** (18), **jazzjizz** (16), **Rn28 (I cant)** (13), **Rn27** (83), …
- Heavily multi-artist; English + Hindi; includes deliberate "Unknown (unavailable)" entries.
- This is 1 of ~7 genres; the rest arrive the same way and merge into one brain.

## How the owner (DJ) builds
- **Left sidebar:** folders (collapse/toggle) → playlists, Spotify-style — quick to scan and rearrange.
- Building a channel = either **add a song straight to the queue** or **play a whole playlist** — each in ≤2 clicks, no modal walls.
- Adding songs is **inline text**: type a title (+ optional artists), done.

## What a listener sees (deliberately minimal)
Only: **(1) # songs on loop, (2) channel updated-at, (3) next song.** No current title/artist. The channel "plays" by advancing a timer through its loop; a song with audio plays, otherwise it's silent and still advances.

## The orchestrator dashboard (the main pain → goal)
Rebuilt as a compact DJ console: folder/playlist tree on the left; the active channel in the center (now-playing + reorderable queue + quick-add); a channel switcher + small transport on top; collapsible side rails for schedule/journal. Small, categorized, things kept aside — usable, not overwhelming.

## Roadmap (phased)
0. This doc + import schema.
1. **Data foundation** — Unknown artist, default duration, audio-optional, folders + playlist↔folder. *(in progress)*
2. Import the mellow genre.
3. Timer-based channel playhead (audio-optional).
4. Minimal listener view (count / updated-at / next).
5. DJ content-building UX (folder tree + quick actions).
6. Orchestrator dashboard redesign.
7. (Later) In-app interactive knowledge-graph view of the whole brain.

## Future (not now)
- Search across the library.
- Lightweight playlist analytics (playlists are just things people make).
- **Data streaming / an API** to expose this brain to other apps — likely a separate product later.
