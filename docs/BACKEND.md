# Backend — current state + what changes for the recs system

_Last updated: 2026-05-26._ A working assessment before entering the recs-system /
Spotify-data phase. Supersedes [BACKEND_REDESIGN.md](BACKEND_REDESIGN.md) (kept as
historical, from the early "what's been built" pass).

**TL;DR.** The current backend is in good shape. The rec system + Spotify integration
is **largely additive** — a few new tables, a JSONB column, one new branch in the
playback route, and mostly net-new UI. **~95% of current code survives.** No table is
dropped; no destructive migration. You don't need to start over. The tree, playlists,
channels, channel_state, brains, listener, audio storage, auth — all stay.

---

## 1. What you have today

### Data model (Supabase Postgres)
```
folders (id, name, parent_id, color)
   │      ─ nestable; color = a "brain" / genre
   ▼
playlists (id, name, folder_id, ...)
   │      ─ leaves of the tree, hold ordered songs
   ▼ (many-to-many)
playlist_tracks (playlist_id, track_id, position)
   ▼
tracks (id, title, artist_id, file_url, file_key, duration_ms, ...)
   │      ─ ONE canonical row per song
   ▼ (many-to-many)
track_artists (track_id, artist_id, role, position)
   ▼
artists (id, name, slug)

channels (id, name, slug, is_public, status, for_user_id, ...)
   ▼
channel_state (channel_id, source_type, source_id, current_track_id,
               is_playing, playback_started_at, position_ms, repeat_mode,
               priority_queue, user_queue, skipped_track_ids, ...)
   ▼ (private channels)
channel_members (channel_id, user_id, role)

users (id, auth_id, is_host, ...)              ← Supabase Auth via @supabase/ssr
host_presence, listening_history, user_library, stickers, track_votes,
channel_schedules, drive_credentials (Drive removed but table kept)
```

Plus a `can_access_channel(p_channel_id, p_user_id)` DB function for the
public-OR-host-OR-member check (now used by the API after E008).

### The tree (curation)
`folders` nest infinitely via `parent_id`. A folder's optional `color` makes it a
"brain" (genre). Playlists live in folders; songs live in playlists. **A song can be
in many playlists across many folders** (many-to-many via `playlist_tracks`) — bridges
between genres are already first-class in the schema, even if the UI/rules don't fully
exploit them yet.

### Playback model
A channel has one `channel_state` row. Two modes:
- **Single-song loop** — `current_track_id` set, `source_type` null, `repeat_mode:"one"`.
- **Multi-song loop** — `source_type:"playlist"` + `source_id` (a backing playlist),
  `current_track_id` = first track, `repeat_mode:"all"`.

`GET /api/channels/[slug]/loop` computes the current + next track from elapsed time
over the loop's cumulative durations (audio-optional — a song with no audio still
advances on a timer). Returns ordered `tracks[]` (with `file_url`/`duration_ms`/
`artist`/`cover_url`) + `current_index`, so the listener plays through locally.

### Listener experience
`/radio/[slug]` (client-side React). On Tune-In, plays the entire loop locally and
advances on `<audio onEnded>`. Polls `/loop` every 20s only to pick up loop-composition
changes — never restarts the current song. Native `audio.loop` for single-song
channels. Audioless tracks advance on a timer. Now-playing **song card** (cover / title
/ artist) with loop-count "live" trust pill; next-song + updated-at on hover (desktop)
or tap (mobile). MediaSession metadata for lock-screen.

### The brains (visualisations)
Four graph views, all driven by `GET /api/graph` (paginated — never silently truncated
at 1000 rows, see [errors.md E005](../errors.md)).
- **Brain 1** `/admin/graph` — whole-library force graph (`KnowledgeGraph`).
- **Brain 2** `/admin/graph2` — folder-scoped, artist-centric.
- **Brain 3** `/admin/graph3` — concentric (`ConcentricBrain`): artists inner, songs
  middle, playlists outer; colors per genre membership; white ring = mono-genre.
- **Brain 4** `/admin/graph4` — Beam-scoped force graph with the dprsh subset
  highlighted via the shared bridge/pure scheme.

Coloring palette in `src/lib/brain-colors.ts` (shared) — `green / sad-blue / aqua
bridge`. Full reading guide in [docs/brain3/BRAIN3.md](brain3/BRAIN3.md).

### Audio storage
Cloudflare R2 bucket `radio-music`. Keys `music/<artist-slug>/<song-slug>.mp3`.
Public via `R2_PUBLIC_URL`. Empty-source-file gotcha: see [errors.md E006](../errors.md).

### Auth
Cookie-based via `@supabase/ssr`. Middleware gates `/admin/*`, the `/radio` index,
and login redirects. `users.is_host = true` marks the host. **Private channels are
enforced** at the API level (E008): `GET /api/channels` returns private channels only
to the host or invited members; `GET /api/channels/[slug]/loop` 404s a private
channel for non-host/non-member.

---

## 2. Functionalities working today

### Owner (host)
- Bulk add songs: `scripts/seed/attach-batch.mjs` — dedup `--dry-run` first, then
  upload to R2 + create/attach tracks. Reusable single-shot: `attach-audio.mjs`.
- Inline add: **Quick Add** (`/admin/add`) — paste "Title - Artist" lines into a new
  or existing playlist (no audio).
- File songs: orchestrator FolderTree (`+ Play`, `+ Queue`, "where is this song"
  sheet, swipe-to-queue, hide-in-queue toggle).
- Channel creation/edit: backend seed scripts (`scripts/seed/seed-channels-*.mjs`,
  `seed-rock-*.mjs`). Idempotent; reuse existing backing playlists.
- View brains 1–4.
- Orchestrator dashboard: view + select channels, transport (play/pause/skip),
  channel switcher, queue journal, stats strip, mobile drawer.
- Private channels (e.g. Rakesh).

### Listener (friend)
- Public link `/radio/[slug]` — tune in, hear the loop, see now-playing.
- Listening history is recorded.
- Sticker reactions (Supabase Broadcast channel).

### Working but limited
- No channel-editing UI (rename / add-song / remove / reorder / public-toggle) — all
  done via backend scripts.
- No catalogue search.
- No per-user accounts beyond host (no liked songs / channels per listener).
- No rule-engine channels (only handcrafted playlist or single-track).
- Sub-folder structure is shallow — only "Beam me up, jesus." has a non-trivial
  subtree. Rock / Out-of-love / Motivational don't exist as folders yet.

---

## 3. What changes for the rec system

### The good news (specifics)
**Survives unchanged:** every table above, every API route except `/loop`, the
orchestrator dashboard, the brains, the listener experience, R2, auth, all 45+ audio
files, all 13 channels, all ~720 tracks and ~650 artists. The tree-as-ground-truth
model the rec system needs IS exactly what's built.

### What gets ADDED (net new — no existing code touched)
| Add | Why | Shape |
|---|---|---|
| `channel_tracks (channel_id, track_id, position)` | Decouple channels from playlists so playlists stay 100% memory buckets | mirror of `playlist_tracks` |
| `channels.rule_config jsonb` | A channel can be a RULE (Option B) instead of a fixed list (Option A) | `null` for manual; `{type:"rule", scope_folder_ids:[..], filter:{...}, order:{...}}` for rule |
| `track_tags (track_id, tag text)` | Owner-controlled per-song metadata for rule filtering before Spotify data lands | `["late-night","lyric-heavy","high-energy"]` etc. |
| `liked_songs (user_id, track_id, liked_at)` | Friends' personal libraries; the basis for tree-coverage | many-to-many |
| `liked_channels (user_id, channel_id, liked_at)` | Friends' channel preferences; channel-score signal | many-to-many |
| `spotify_history (...)` | Imported streaming events; exact shape TBD pending parallel-instance analysis | timestamped track plays + context |
| `user_tree_coverage` (materialized view) | Derived from liked_songs × tree positions; powers "vs Sarthak" | computed |

### What gets MODIFIED (small, localized)
1. **`/api/channels/[slug]/loop`** — gains a third branch: if `channel.rule_config !=
   null`, compute the queue by evaluating the rule against the current tree state +
   `track_tags` + (eventually) `spotify_history`. Existing playlist + single-track
   branches untouched.
2. **Orchestrator** — net-new UI for channel editing (rename, reorder, add/remove
   songs, public toggle, attach rule). The underlying API mostly exists; this is
   front-end work, not a refactor of existing back-end logic.
3. **`db.channels.list`** in `queries.ts` — may want a richer return when rule_config
   is present (compute preview queue). Optional.

### What gets REWRITTEN
**Nothing significant.** No table is dropped. No route is replaced. No `tracks` /
`artists` / `playlists` / `folders` / `channels` / `channel_state` migration is
destructive. The brains keep working with more genres + sub-folders (they get
richer automatically). The listener doesn't care how a channel's queue was decided —
playlist, single track, or rule — it just consumes the `tracks[]` from `/loop`.

### Two things worth re-thinking (small, not rewrites)
- **`playlists.is_public`** — currently both a personal-memory flag and a needed-for-
  backing-loop flag. Once `channel_tracks` exists, playlists are purely personal;
  `is_public` reduces to a single-purpose preference.
- **Backing-playlist workaround channels** (#38 Call Me When You Land — loop, #39
  Nobodies — loop, #40 Rakesh — loop, #41 Rock 2026 — loop, #42 Rock Ballads — loop)
  — once `channel_tracks` exists, these get migrated and the placeholder playlists
  deleted. One-time cleanup script.

---

## 4. The "do I start from scratch?" question — answered

| Concern | Reality |
|---|---|
| "Will Spotify data force a rewrite?" | **No.** It adds tables (history, optional metadata enrichment on `tracks`). Nothing existing is rewritten. |
| "Will the rec system force a rewrite?" | **No.** It adds tables (likes, tags) + a `rule_config` column + one branch in `/loop`. The tree-as-ground-truth foundation IS what it runs on. |
| "Will the brains break?" | **No.** They already encode genre-membership. More genres + deeper sub-folders make them richer, not break them. |
| "Will I lose my work?" | **No.** Tracks, artists, audio in R2, channels, playlists, brains — all preserved. |
| "Will the listener page break?" | **No.** It consumes `tracks[]` from `/loop`; doesn't care how the queue was decided. |

**Net:** what you've built is the foundation. The recs system is what you build **on
top of** it, not **in place of** it.

---

## 5. Refactor order (when you're ready — phased, deployable independently)

| # | Phase | Spotify needed? | Touches |
|---|---|---|---|
| 1 | **Sub-folder depth** | No | Create real folders under each root genre (Rock → Greats/Grunge/Indie/Ballads/2000s, etc.); file existing songs into the right sub-folders. The brains immediately get richer. |
| 2 | **`track_tags`** | No | New table + admin tag-edit UI. Each song gets 0–3 owner tags. Free metadata you control. |
| 3 | **`channel_tracks` + decouple** | No | Add the table, write a migration that copies each backing-playlist's tracks into the channel's own list, flip `/loop` to prefer `channel_tracks`, delete the "— loop" playlists. |
| 4 | **`channels.rule_config`** | No | Add the JSONB column. Mark existing channels `{type:"manual"}`. Build a `/api/channels/preview-rule` endpoint to test rule expressions without saving. |
| 5 | **Spotify import** | YES | Schema TBD by parallel-instance output. New tables for history; optional metadata enrichment of `tracks`. Idempotent importer. |
| 6 | **User likes + tree coverage** | (helps) | `liked_songs` / `liked_channels` tables, friend-account flow, the tree-coverage view. |
| 7 | **Rule engine activation** | (richer with Spotify) | The `/loop` branch that evaluates `rule_config` against tree + tags + history. |
| 8 | **Orchestrator channel-editing UI** | No | Rename / reorder / add / remove / public-toggle / rule-builder. Mostly front-end. |

**Phases 1–4 can happen NOW**, before Spotify data lands. Phases 5+ are gated on the
parallel instance's analysis.

---

## 6. About the "if I give you Spotify account data" question

Yes — given a Spotify export I could:
- Cluster your streaming history into proposed sub-folders (by co-play patterns,
  time-of-day, replay).
- Per-song derived metadata: replay count, time-of-day distribution, skip rate, year
  imported.
- Initial rule candidates for channels ("songs you replayed a lot at 1am from your
  slow folder").
- A first cut of the tree-coverage baseline (Sarthak's own).

**But** another LLM instance is already on it (per your prior turn). Better division
of labor: that instance returns the analysis output; this side integrates it into the
backend (write the importer, the schema, the routes). Don't double-process the same
data with two LLMs.

If the parallel instance's output doesn't fit, or if you want a second read, hand me
the raw export and I'll do my own pass. Default: wait for the other instance.

---

## 7. What I'd do RIGHT NOW (without Spotify, without the rec system)

The single highest-leverage move is **Phase 1: sub-folder depth.** Today only the
"Beam me up, jesus." subtree has real structure. Rock, Out-of-love, Motivational
don't exist as folders yet — the channels you're naming (Rock 2026, Rock Ballads)
have no folder home. If you flesh out the sub-folder structure now:

- The brains immediately encode richer relationships (more genres, more bridges).
- Today's handcrafted "Rock Ballads" channel maps to a future one-line rule against
  `folders.path == 'Rock/Ballads'`.
- Every new song you add later has a meaningful place to go.
- Tree-coverage comparison becomes interesting at the sub-folder level (which is
  where the "vs Sarthak" interest lives).

**Optional add-on now:** Phase 2 (`track_tags`). Cheap, owner-controlled, immediately
useful — and it works without Spotify or new accounts.

Everything else genuinely benefits from waiting for the Spotify analysis to shape the
specifics. But sub-folder depth + tags don't need to wait.

---

## Appendix — file map (where current things live)

| Concern | Path |
|---|---|
| API: channels list + create | `src/app/api/channels/route.ts` |
| API: channel CRUD | `src/app/api/channels/[slug]/route.ts` |
| API: playback control | `src/app/api/channels/[slug]/playback/route.ts` |
| API: loop computation | `src/app/api/channels/[slug]/loop/route.ts` |
| API: graph (brains) | `src/app/api/graph/route.ts` |
| API: tracks (CRUD + bulk + upload) | `src/app/api/tracks/route.ts`, `[id]/`, `bulk/`, `upload/` |
| API: playlists | `src/app/api/playlists/route.ts`, `[id]/` |
| API: folders | `src/app/api/folders/route.ts`, `[id]/` |
| DB access layer | `src/lib/supabase/queries.ts` |
| Supabase clients | `src/lib/supabase/{client,server}.ts` |
| R2 wrapper | `src/lib/r2/index.ts` |
| Listener page | `src/app/radio/[slug]/page.tsx` |
| Orchestrator dashboard | `src/app/admin/page.tsx` |
| Admin layout (sidebar drawer) | `src/app/admin/layout.tsx` |
| AdminSidebar | `src/components/admin/AdminSidebar.tsx` |
| FolderTree | `src/components/admin/FolderTree.tsx` |
| KnowledgeGraph (Brains 1/2/4) | `src/components/admin/KnowledgeGraph.tsx` |
| ConcentricBrain (Brain 3) | `src/components/admin/ConcentricBrain.tsx` |
| Shared brain palette | `src/lib/brain-colors.ts` |
| Migrations | `supabase/migrations/` (001–015) |
| Bulk audio attach | `scripts/seed/attach-batch.mjs` |
| Channel seeders | `scripts/seed/seed-channels-*.mjs`, `seed-rock-*.mjs` |
| Genre import | `scripts/import/import-graph.mjs` |
| Errors log (repo) | `../errors.md` |
| Versioned briefs | `../ideas-v1..v4.md`, `../feedback-v1..v3.md` |
