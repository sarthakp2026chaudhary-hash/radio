# Ideas v2 — Audio at scale, channels, and genre-encoded "brains"

Created: 2026-05-26 · Status: product brief (extends [ideas-v1.md](ideas-v1.md), [feedback-v3.md](feedback-v3.md))

This version captures the direction set while bulk-adding songs, building real radio
channels, and evolving the "brains" into a **genre-membership visualization** — plus the
backend thinking behind playlists vs channels vs genres, and where ML fits.

## The raw ask that kicked this off
> can you see the project that im working on, basically i have put some part of data into it and i just wanted to maybe put some audio files for new or old songs, also make a radio channel with a few song … i will provide you a few songs, I want you to add these on the backend … add these songs in the backend for now **without genre** … i have made some brains and lookups and artists songs, so i can also review them, when eventually i upload other songs from genre like **rock and faithless** … add these, and make a channel with **die trying** on loop / **call me when you land + sit next to me + lie to me** / **grace kelly** on loop / **nobodies + for i am death/life evermore + zombie + zombie + (one pending)** … also … make a plan on how should the backend be — i was thinking to make channels directly from playlists, but i feel that's not necessary; **playlists are just for me to save songs in chunks so i can remember better**; channels also store songs in order — so what's the difference … i'm making playlists with common things so i can **conclude analysis eventually … fast-forward ML results** … i can make a few genres, and for analysis just use a few genres and leave the rest.

## The three constructs (decided this session)
Separate them by **purpose**, not structure (all three are "ordered lists of songs"):

- **Playlist = a thought.** Personal memory buckets — fuzzy, overlapping, many. The raw
  signal for analysis. Never plays on its own.
- **Channel = a broadcast.** A small, curated loop that actually airs. Output. Few.
- **Folder / genre = a label.** A handful of authoritative, hand-decided genres (colored
  folders). The axis you analyze on; you can use a few and ignore the rest.

### Backend implication (proposed, see docs/BACKEND_REDESIGN.md + below)
- **Decouple channels from playlists.** A multi-song channel currently has to borrow a
  playlist as its loop source (`channel_state.source_type='playlist'`). The clean model
  is a channel-owned track list (`channel_tracks(channel_id, track_id, position)`), so
  playlists stay purely personal and channels own their loop. "Build a channel from a
  playlist" becomes an optional *copy*, not a binding. (Not built yet; backing-playlist
  workaround is fine until then.)

## Brains = a genre-membership encoding (the evolution)
The "brains" stopped being "everything green" and became a way to **see how songs/artists
belong to genres**:
- Genres are carried by **edge color** (green = normal, blue = dprsh/sad; more colors as
  Rock/Faithless arrive).
- A **node's color is the blend** of the genres it belongs to (only-green → green,
  only-dprsh → blue, both → aqua "bridge"). Applies to **artists too** (an artist's
  genres = the union over its songs).
- A **white ring = belongs to exactly one genre** (the old "in >1 playlist" meaning was
  dropped as meaningless).
- This **generalizes** to N genres and is the visual foundation for "pure vs crossover"
  analysis. Full reading guide: [docs/brain3/BRAIN3.md](docs/brain3/BRAIN3.md).

## Where ML fits (the long game)
Per-song feature view: `{ artists, genres (folder labels), playlist co-membership,
audio features, embedding? }`. Keep **genres few + authoritative** (supervised label),
**playlists many + fuzzy** (unsupervised signal). The brains already visualize this graph;
an export endpoint would flatten it for analysis. Bridges (aqua, no ring) are the overlap
signal.

## Making more brains comfortably (asked for, planned not built)
A brain = **scope** (which folder/songs) + **highlight** (which playlists/songs to
recolor) + **layout** (force vs concentric). Path: (1) a `BRAINS` config registry + one
generic page per layout → a new brain is one entry; (2) generalize highlight from one set
to many `{ids, color}` groups; (3) later a `brains` DB table + `/admin/brains` UI for
no-code brains from any song selection. Details in [docs/brain3/BRAIN3.md](docs/brain3/BRAIN3.md) §5c.

---

## Update log
_Raw running log of what's actually been built/decided. Newest first._

### 2026-05-27 — search + R2 scope; Spotify OAuth deferred
- **Search:** upgraded `GET /api/search` — title + artist name + catalog `spotify_id`/`spotify_uri`
  match; rich track payload (`artists[]`, `has_audio`, `playlist_count`). Admin search in layout
  header + library + channel control; listener "Request a song" panel on `/radio/[slug]`.
- **Channel votes:** `channel_track_votes` table + `GET/POST/DELETE /api/channels/[slug]/votes`
  (replaces legacy folder-scoped `/api/votes` for per-channel requests). Host sees ranked
  listener requests on channel admin page.
- **R2 scoped:** three ingestion paths documented — admin upload (`/api/tracks/upload`), seed
  pipeline (`scripts/seed/upload-r2.ts`), batch attach (`attach-batch.mjs`). R2 env vars added
  to `.env.example`; ops script `scripts/seed/verify-r2.mjs`.
- **Streaming:** `src/lib/sources/resolve-playback.ts` adapter designed; R2-only broadcast.
- **Spotify OAuth + Brain import:** deferred to next phase.
- **Pending:** Rock/Faithless import; `channel_tracks` decoupling; Brain 4 artist coloring;
  BRAINS config registry; re-download + attach audio for "Pas de Deux".

### 2026-05-26 — audio batch, 4 channels, app fixes, brains-as-genre
- **Bulk audio (44 files):** `scripts/seed/attach-batch.mjs` (dedup `--dry-run` first).
  2 already had audio, 10 attached to existing text-tracks, 32 created (#740–#771), **no
  genre**. One source MP3 was 0 bytes (Tchaikovsky "Pas de Deux" #754) → left audio-less
  (errors **E006**).
- **4 channels** (`scripts/seed/seed-channels-batch.mjs`, idempotent): `die-trying`
  (single, repeat-one), `call-me-when-you-land` (3-song loop), `grace-kelly` (single),
  `nobodies` (4-song loop). Single-song = `current_track_id`; multi-song = a backing
  playlist (`<Channel> — loop`). Live on considerable.in immediately (direct to prod DB).
- **App fixes:** listener stream no longer dies after one song (plays the whole loop
  client-side, advances on `<audio onEnded>`; `/loop` returns ordered `tracks[]` +
  `current_index`) — errors **E007**; responsive mobile dashboard (sidebar → drawer);
  now-playing song card with loop-count "live" pill + hover/tap meta.
- **Brain 4** (`/admin/graph4`): the green Beam graph with the dprsh subset highlighted.
- **Brains 3 + 4 unified** on the dprsh scheme (shared `src/lib/brain-colors.ts`):
  dprsh playlists/edges = sad blue; song **bridge** (dprsh + other) = **aqua**; song
  **only-dprsh** = sad blue; else green. Edges colored by playlist end.
- **Brain 3 — artists colored by genre + white ring repurposed** to "belongs to exactly
  one genre" (was "in >1 playlist").
- **Backend plan** captured: playlists = memory, channels = broadcast, genres = labels;
  proposed `channel_tracks` decoupling.
- **Pending:** import Rock (red) + Faithless (pink); the `channel_tracks` decoupling;
  Brain 4 artist coloring (Brain 4 still shows artists grey); the BRAINS config registry;
  re-download + attach audio for "Pas de Deux".
