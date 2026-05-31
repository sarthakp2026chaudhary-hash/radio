# Ideas v5 — Bridge the parallel Spotify work into the radio app (don't fork)

Created: 2026-05-26 · Status: **plan, not built**. Full design in
[docs/TREE_BUILDER.md](docs/TREE_BUILDER.md). Extends
[ideas-v3.md](ideas-v3.md) (RECS SYS vision) and [ideas-v4.md](ideas-v4.md)
(refactor scope — "don't start from scratch").

## What just landed
The owner shared two things in one turn:

1. **`library_structure.html`** — the parsed visible tree of his actual Spotify
   library: **9 top-level folders, 25 folders total, 260 playlists.** Real
   ground-truth, not speculation. Folder list (top-level):
   `rock · pretenses · OLD · SOLO · SARTHAKOLD · SARTHAKOTHER · Beam me up, jesus.
   · faithless · get fat` + "New Folder" / SARTHAKBOSEMAN / discarded /
   loose-context items.
2. **A HANDOFF document from a parallel LLM instance** working a different codebase.
   That instance has already loaded the owner's Spotify export into a **separate**
   Supabase project (`spotify-history`, `ewialamgozrsvjtbxghd`, `ap-south-1`):
   17 tables, 181k streams, 638 playlists, 17k tracks, 5.5k artists, 3.8k saved
   tracks, dashboard + brain v1/v2 + DuckDB + Jupyter notebook all built.
   The parallel instance's **planned next step** was to create a **third** Supabase
   project `spotify-app`, build a parallel `tree_nodes` / `tree_node_tracks` schema
   there, and spin up a fresh Next.js tree-builder app.

## The owner's directive (verbatim)
> can you plan this better with the app we have? for better purpose we can make
> like a new seperate page, so old things dont get that distured

## The decision
**Don't fork. Integrate.** Specifically:

- **No third Supabase project.** Keep the radio's project as the canonical writer;
  keep `spotify-history` as the read-source.
- **No second Next.js app.** Add **one new page** to the radio app:
  `/admin/tree-builder`. The page bridges to `spotify-history` server-side
  (a second, read-only Supabase client) and writes into the radio app's existing
  `folders` / `playlists` / `tracks` schema.
- **No new tables.** The radio app's existing schema already models everything
  (the parallel instance's planned `tree_nodes` is conceptually the same as the
  radio app's `folders` + `playlists` already are).
- **Nothing in the radio app is touched.** Every existing file, route, channel,
  brain, audio file, listener page — all preserved. Only NET-NEW files
  (1 page, ~3 API routes, 1 lib wrapper, 2 env vars, 1 static tree.json).
- **The brains light up automatically** as imported folders/playlists appear —
  Phase 1 from [BACKEND.md](docs/BACKEND.md) (sub-folder depth) gets done as a
  natural side effect of importing the user's real Spotify tree.

## Why this is better than the parallel instance's plan
| | Parallel plan | This plan |
|---|---|---|
| Supabase projects | 3 | 2 |
| Next.js codebases | 2 | 1 |
| New schema | `tree_nodes` + join table | 0 |
| Brains/channels integration | none | automatic |
| Owner's existing work | parallel to it | flows into it |
| Owner's anxiety ("start from scratch?") | reinforced | dispelled |

## What the new page does
Side-by-side: the user's Spotify tree on the left (read-only, from the parsed
tree.json), the radio app's current folder/playlist state on the right. Per row:
"already imported" / "not imported (click to import)" / "ambiguous — reconcile."
Per folder: "Import folder" cascades (folder + children + tracks). All idempotent;
all dry-runnable. Same dedup discipline as `attach-batch.mjs`.

Track matching: Spotify URI/ID first (the radio app's `tracks` already has
`spotify_uri` / `spotify_id` columns from migration 012), then title+artist
normalised, then create-new. Imported tracks come in **audio-less** by default;
MP3s arrive later via `attach-batch.mjs` as the owner uploads them.

## What's parked (still — per ideas-v3 / v4)
- The rec-engine itself (`rule_config`, rule evaluator in `/loop`).
- User `liked_songs` / `liked_channels` tables + "vs Sarthak" UI.
- Orchestrator channel-editing UI.
- Final `spotify_history` integration into the radio app (we'll be READING the
  parallel project's `streams` table directly when needed; if we later want to
  copy/sync history into the radio app it's a separate decision).

## Three open questions (need owner confirmation before Phase 0.5 starts)
See [docs/TREE_BUILDER.md §10](docs/TREE_BUILDER.md) for details + my picks:
1. Where does the parsed tree come from at runtime? — my pick: bundle a static
   `public/spotify-tree.json` exported once.
2. What do we do with the parallel instance's `_work/tree.json` and dashboard? —
   my pick: hand the tree.json over once, keep `spotify-history` alive as
   analytics, drop the planned spotify-app fork.
3. The 79 unmatched + 12 ambiguous playlists — my pick: skip them in Phase 3,
   surface in the UI as "needs reconcile," handle one-by-one.

## Status
Scope expanded to a full **Workshop** (curation + rule-channels + Golden tree).
**Full phased plan in [`docs/WORKSHOP_PLAN.md`](docs/WORKSHOP_PLAN.md)** (commit
`cd829f0`) — self-contained for a fresh LLM, 10 phases, 9 locked decisions.
Owner direction approved; the plan is the handoff artifact. Still no code.
