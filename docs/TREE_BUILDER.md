# Tree Builder — design (Phase 0, before any code)

_Created: 2026-05-26. Status: **plan, not built.** Awaiting owner confirmation on the
three open questions in §10 before implementing._

## 1 · Context — what just landed

Two threads of work need to come together.

**Thread A — this radio app (considerable.in).** ~720 tracks, 13 channels, 4 brains,
listener that plays loops locally, audio in R2, private channels enforced. Supabase
project `eyljbqnglfbkbflwpkxv`. ~95% of code survives any rec-system refactor (see
[BACKEND.md](BACKEND.md)). Current weakness: **shallow sub-folder structure** — only
"Beam me up, jesus." has children; the rest of the genres don't exist as folders yet.

**Thread B — a parallel LLM instance.** Loaded the owner's Spotify export into a
**separate** Supabase project `spotify-history` (ID `ewialamgozrsvjtbxghd`,
`ap-south-1`) — **17 tables** including `streams` (181,661 rows, 2019–2026),
`playlists` (638), `playlist_tracks` (23,865), `tracks` (17,282), `artists` (5,568),
plus saved_tracks/followed_artists/search_queries/inferences/marquee/etc. Built a
dashboard, two brain visualisations, a DuckDB copy, a Jupyter notebook. Parsed
`library_structure.html` (the owner's actual visible Spotify tree —
**9 top folders, 25 folders total, 260 playlists**) into `_work/tree.json` and verified
mapping: 169 of 260 playlists match by exact name, 12 ambiguous, 79 unmatched
(encoding/emoji — cleans to ~90–95% with normalisation), 453 archive-pile playlists
not in the visible tree.

**Parallel instance's planned Phase 0:** create a **third** Supabase project
`spotify-app`, apply a `tree_nodes` + `tree_node_tracks` migration there, pre-seed from
`_work/tree.json`, build a tree-builder Next.js page in a fresh codebase.

## 2 · The decision — integrate, don't fork

**Don't create a third Supabase project. Don't fork the app.** A new page in the
radio app does the same job with zero of the fragmentation costs:

| | Parallel instance's plan | **This plan** |
|---|---|---|
| Supabase projects | 3 (radio + spotify-history + new spotify-app) | 2 (radio + spotify-history kept as read-source) |
| Next.js codebases | 2 (radio + new tree-builder app) | 1 (the radio app, new page added) |
| New schema | `tree_nodes` + `tree_node_tracks` (parallel to radio's existing folders/playlists) | **none** — the radio app's `folders`/`playlists`/`tracks` already model this |
| Radio app's brains | not connected | automatically light up as the tree fills |
| Radio app's channels | not connected | future rule-channels can immediately span imported folders |
| Existing UI files touched | n/a | **none** — only net-new files |
| Risk to existing work | n/a | none |

The parallel instance's data work isn't wasted — `spotify-history` stays as the
**read-source** that this page bridges to. Their tree.json becomes the input. The new
page is the **migration UI** from "raw Spotify reality" into "the radio app's curated
schema."

## 3 · What gets ADDED (every file is net new)

| Add | Purpose |
|---|---|
| `src/app/admin/tree-builder/page.tsx` | The new admin page (host-gated, same pattern as `/admin/library`). |
| `src/app/api/tree-builder/spotify-tree/route.ts` | GET — returns the parsed Spotify tree (folders + playlists + counts), read from the bundled tree.json or via a cached fetch. |
| `src/app/api/tree-builder/preview-import/route.ts` | GET — given a tree-node id, returns what would be imported (folder + child playlists + track-by-track resolution status: would-create / would-attach-to-existing / would-update). **Dry-run.** Mirrors `attach-batch.mjs --dry-run`. |
| `src/app/api/tree-builder/import/route.ts` | POST — actually performs the import for a tree-node (folder or playlist). Idempotent. |
| `src/lib/supabase/spotify-data.ts` | A second Supabase client wrapper pointed at `spotify-history` for reads (no writes, ever). |
| `public/spotify-tree.json` (or `src/data/...`) | The pre-parsed tree from `library_structure.html`. ~10–50 KB. Static asset. |
| 1 env var: `SPOTIFY_DATA_SUPABASE_URL` | Read-only handle to the parallel project. |
| 1 env var: `SPOTIFY_DATA_SUPABASE_ANON_KEY` | (RLS is intentionally off on `spotify-history` per parallel handoff, so anon works fine for reads.) |

That's it. **No DB migrations on either side.** The radio app's existing
`folders` / `playlists` / `playlist_tracks` / `tracks` / `track_artists` / `artists`
already accommodate everything imported.

## 4 · What stays UNTOUCHED

- Every existing page, route, component, hook, lib module in the radio app.
- The brains (1–4) — they read from `/api/graph`; as imported folders/playlists
  appear, the brains get richer automatically. No code change.
- The listener (`/radio/[slug]`), all 13 channels, the orchestrator dashboard,
  R2 audio storage, the seed scripts, auth, the privacy enforcement.
- The `spotify-history` Supabase project — left exactly as the parallel instance
  built it. The radio app reads it; never writes.
- The radio app's existing data: ~720 tracks, ~650 artists, 42 playlists, 6 folders,
  13 channels, all audio files in R2.
- Migrations 001–015 in `supabase/migrations/` — none touched.

## 5 · How the page works (UX sketch)

```
/admin/tree-builder
┌──────────────────────────────────────────────────────────────────────┐
│  Tree Builder — import Sarthak's Spotify library into the radio app  │
│                                                                      │
│  [Spotify tree (left, read-only)]    [Radio app state (right)]       │
│                                                                      │
│  ▼ rock (20 playlists)                ─ rock                         │
│    □ EVI3(alc)                          NOT IMPORTED                 │
│    □ ev12                               NOT IMPORTED                 │
│    ☑ scream                             ✓ already (#…)               │
│    …                                                                 │
│                                                                      │
│  ▼ Beam me up, jesus. (5 + 3 folders)  Beam me up, jesus. (in app)   │
│    ☑ Beamed                             ✓ already                    │
│    ▼ SARTHAKJAZZ (5)                                                 │
│      ☑ Car17(jazz in my pants)          ✓ already                    │
│      …                                                               │
│    ▼ dorsh1 (8)                         dprsh1 ←─ slug mismatch!     │
│      ⚠ Dorsh1 (Spotify)                 vs Dprsh1 (radio) — reconcile│
│      ⚠ Mistake                          ambiguous — multiple matches │
│      …                                                               │
│                                                                      │
│  [Import folder] [Import selected] [Preview (dry-run)]               │
│                                                                      │
│  Match strategy: Spotify URI ▸ title+artist ▸ create                 │
│  Source: spotify-history project (read-only)                         │
└──────────────────────────────────────────────────────────────────────┘
```

Per playlist row, three states:
- ✓ **Already in radio app** (matched by name in this app's `playlists` table).
- □ **Not imported** — clicking imports it.
- ⚠ **Needs reconcile** — name clash, ambiguous match, or encoding mismatch
  (e.g. the spotify tree calls it `dorsh1` with a lowercase 'o'; the radio app has
  `dprsh1` with a 'p'; the dorsh playlists are `Dorsh1..Dorsh8` vs the existing
  `Dprsh1..Dprsh6`). The user resolves these one-off.

Per folder: "Import folder" cascades — creates the folder, all child playlists,
matches/creates all tracks.

## 6 · The cross-database bridge

Two Supabase clients in this app:

```
src/lib/supabase/server.ts          ← existing — writes to the radio app
src/lib/supabase/spotify-data.ts    ← NEW — reads only, points at spotify-history
```

The spotify-data client is **server-side only** (in API routes). The browser never
talks to spotify-history directly. Pattern:

```ts
// src/lib/supabase/spotify-data.ts
import { createClient } from "@supabase/supabase-js";
export const spotifyData = createClient(
  process.env.SPOTIFY_DATA_SUPABASE_URL!,
  process.env.SPOTIFY_DATA_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);
```

API routes can query `spotifyData.from("playlists").select(...)` for the raw Spotify
playlist data, then write into the radio app's tables via the existing server client.

## 7 · Track matching — how a Spotify song becomes a radio-app track

Order of attempts when importing a song from a Spotify playlist:

1. **Spotify URI / ID match.** The radio app's `tracks` table already has
   `spotify_id`, `spotify_uri`, `isrc`, `musicbrainz_recording_id`, `apple_music_id`,
   `youtube_id`, `acoustid` columns (migration 012). If `tracks.spotify_uri =
   <imported uri>` → use that row. **No duplicates.**
2. **Title + primary artist (normalised).** Same matcher as `attach-batch.mjs`
   (lowercase, strip parentheticals/feat/diacritics, collapse spaces). Tolerates
   minor formatting drift.
3. **Create new track + artists.** If neither match hits, insert a new row in
   `tracks` (with `spotify_id`/`spotify_uri` populated from the source so future
   imports re-match), find-or-create artists by slug, link via `track_artists`.

Audio: imported songs have **no audio by default** — they enter the system as text-
only tracks (the radio app already handles audio-optional everywhere, per ideas-v1).
Audio comes later via `attach-batch.mjs` when the owner uploads MP3s.

## 8 · Idempotency

Every operation is safe to re-run.

- **Folder:** find by `(name, parent_id)` → use existing or create.
- **Playlist:** find by `(name, folder_id)` → use existing or create.
- **Track:** Spotify-URI match → title+artist match → create. Always populates
  `spotify_id`/`spotify_uri` on create so re-runs hit the URI match.
- **playlist_tracks:** delete existing rows for the playlist, then re-insert in
  source order (same pattern as the channel seed scripts).

Re-importing a folder doesn't duplicate, doesn't reorder existing data destructively
unless the source order changed.

## 9 · Phased implementation (small, deployable, reversible)

| # | What | Deploys | Risk |
|---|---|---|---|
| 0.5 | Bundle parsed tree.json + add the env vars + the spotify-data client wrapper | Backend only; nothing visible to listeners | None — net-new files |
| 1 | The `/admin/tree-builder` page, read-only Spotify tree view + radio-app side-by-side (no actions yet) | One new admin page | None |
| 2 | "Preview import (dry-run)" endpoint + button — shows what would happen | New API route | None — read-only |
| 3 | Real per-playlist import (one click → folder/playlist/tracks materialised in radio app) | New API route + UI button | Low — same write patterns as the seed scripts |
| 4 | Bulk folder import + ambiguity reconcile UI | UI polish | Low |
| 5 | (Later) Optional: write back the radio app's tree structure into `spotify-history` so the parallel project's `tree_nodes` is populated from the canonical source. Only if you want the analytics project to mirror the curated tree. | New API route | Optional |

After Phase 3, **Phase 1 of [BACKEND.md](BACKEND.md) is done** — the radio app
finally has the rich sub-folder structure (Rock with 20 playlists, faithless with 3
sub-folders and 17 heartbreak playlists, etc.) that every future rule needs. The
brains will look completely different — many more genres, many more bridges.

## 10 · Open questions (please confirm before I start)

1. **Where does the parsed tree come from at runtime?**
   - **(a)** Bundle a one-time export (parse `library_structure.html` once, ship
     `public/spotify-tree.json`). Simplest, no extra services.
   - **(b)** Read from the `spotify-history` Supabase if the parallel instance
     loads `tree_nodes` there. Live but adds a dependency.
   - **(c)** Re-parse the HTML each deploy. Niche.
   - **My pick: (a).** The tree changes rarely; bundling keeps the page fast and
     self-contained.

2. **What do we do with the parallel instance's `_work/tree.json` and dashboard?**
   - **(a)** Hand the parsed tree.json over once (file copy) → this app uses it →
     parallel work continues independently (analytics dashboard, brain v1/v2 etc.).
   - **(b)** Ask the parallel instance to keep maintaining `spotify-history` as the
     analytics layer (don't shut it down), and stop the planned spotify-app fork.
   - **My pick: (a) + (b).** Keep the parallel work as analytics; integrate the
     tree.json output here.

3. **The 79 unmatched / 12 ambiguous playlists.**
   - **(a)** Skip them in Phase 3, surface them in the UI as "needs reconcile,"
     handle one-by-one later.
   - **(b)** Try harder normalisation (emojis, HTML entities) and reduce the gap
     before any import.
   - **My pick: (a).** Get 169 unambiguous matches in, deal with the long tail
     manually — exactly what your Spotify tree already does (you visibly see them).

Plus one architectural confirmation: **the `spotify-history` Supabase project stays
alive** as the read-source. We do not delete it. If you ever want to deprecate it,
that's a separate decision after import is complete.

## 11 · Timeline (once you say go)

- Phase 0.5: ~30 min (env, client wrapper, bundle tree.json — needs the file from
  Downloads or from the parallel instance).
- Phase 1: ~1–2 hours (page skeleton + read-only tree display).
- Phase 2: ~1 hour (dry-run endpoint + UI).
- Phase 3: ~2–3 hours (real import + idempotency + ambiguity flags).
- Phase 4 (polish): incremental.

All in one session if you want, or paced across sessions — each phase is
independently deployable and the page is hidden behind `/admin` so listeners never
see a half-built state.

## 12 · What this preserves (the reassurance)

- Your radio app code: every line.
- Your data: every track, channel, playlist, audio file.
- The brains: they get **better** without any change to their code.
- The parallel instance's work: kept as `spotify-history`, used as a source.
- Your investment in either thread: zero waste.

Reply with answers to §10, and I'll start Phase 0.5.
