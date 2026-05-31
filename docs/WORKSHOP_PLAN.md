# Workshop Plan — curation, rule-channels, and the Golden tree

_Created 2026-05-26. For an LLM picking this up cold. Build target: a new admin page
`/admin/workshop` in the existing radio app. Nothing in the rest of the app is
touched. Status when this was written: **all five locked decisions confirmed by the
owner; no code yet.**_

---

## 0 · Orient yourself (read these in order, then start)

This isn't a greenfield project. The radio app already exists and works. Don't
reinvent — pick these up cold first:

1. **`AGENTS.md`** at the repo root — this is a **modified Next.js**; read the
   relevant doc in `node_modules/next/dist/docs/` before writing any app code.
2. **`docs/BACKEND.md`** — canonical current backend audit + the 8-phase refactor
   sequence. This Workshop plan executes parts of Phases 1, 4, 7, 8 of that doc
   (sub-folder depth, channel_tracks-style rules, rule engine, channel-edit UI)
   collapsed onto one new page.
3. **`ideas-v1.md`** — text-first DJ vision, the 7 genres, "curation as ground truth."
4. **`ideas-v3.md`** — RECS SYS vision: rule-engine channels (Option B) as the
   default; "vs Sarthak" social hook; tree as the ground truth.
5. **`ideas-v4.md`** — owner's "do I start from scratch" anxiety; answer: no —
   refactor is additive, ~95% of code survives.
6. **`ideas-v5.md`** — the integrate-don't-fork decision against the parallel LLM
   instance's `spotify-history` Supabase project.
7. **`docs/TREE_BUILDER.md`** — the smaller (now superseded) tree-import-only plan;
   this document extends it with editing, rule-channels, and the Golden tree.
8. **`docs/brain3/BRAIN3.md`** — how the brains encode genre membership; the
   Workshop's edits automatically light up Brain 3 and Brain 4 with no extra code.
9. **`errors.md`** — E000–E008. Critically: **E005 (paginate any full-table fetch
   — 1000-row silent cap), E004 (unique Supabase realtime channel names per
   subscription), E008 (private channels must be enforced in the API, not just
   the column).** Internalise these before touching anything.

Then read this document end-to-end before coding.

---

## 1 · The Workshop in one paragraph

A new admin-only page at `/admin/workshop` with **four panels**:

- **Source** — the owner's actual Spotify tree (parsed from
  `library_structure.html`: ~9 top folders / 25 folders total / 260 playlists),
  read-only, drag-to-import.
- **Working** — the radio app's live `folders` / `playlists` / `tracks`,
  drag-and-drop editable, drag-to-channel.
- **Golden** — a top-level "Golden" folder for small, tight, high-confidence
  playlists ("absolute data" — the owner's ground-truth clusters); same drag
  affordances; visually distinct.
- **Channels rail** — drop zone for creating rule-channels + a list of existing
  channels with a badge marking handcrafted vs rule.

Editing the Working/Golden trees writes **live** to the radio app's Supabase
(`eyljbqnglfbkbflwpkxv`). Brains 1–4 reflect changes automatically. New
rule-channels are first-class (appear in `/api/channels`, friends can tune in if
public — **default private** during sandbox).

---

## 2 · Locked design decisions (do NOT redebate; ask owner first if you want to change them)

| # | Decision | Why |
|---|---|---|
| 1 | **Page name = "Workshop"**, route `/admin/workshop` | Signals "experimental sandbox" without being precious. Owner endorsed. |
| 2 | **Don't create a third Supabase project**; keep `spotify-history` (the parallel instance's project) alive as a **read-only source**; the radio app's Supabase stays the writer | Avoids fragmentation; preserves both threads of work. See `ideas-v5.md`. |
| 3 | **Source tree from bundled `public/spotify-tree.json`** (parsed once from `library_structure.html`) | Self-contained, fast, no extra services. The tree changes rarely. |
| 4 | **Drag scope v1: playlists + folders only** (NOT individual songs) | Lower accidental-move risk; songs can come later when patterns settle. |
| 5 | **Rule primitives v1: only `{type:"playlist", source_id}` and `{type:"artist", source_id}`** | Two primitives cover ~80% of useful rules. More types only when actually wanted. |
| 6 | **Golden = top-level folder** named "Golden" with `folders.color = "#FFD700"` (gold) | Zero schema change; brain coloring already does the visual heavy-lifting. Add `folders.is_golden bool` only when you need a golden sub-folder somewhere inside the regular tree. |
| 7 | **New rule-channels default `is_public: false`** | Owner promotes to public when satisfied. Prevents half-baked sandbox channels leaking to friends. |
| 8 | **Skip the 79 unmatched + 12 ambiguous Spotify-tree playlists in Phase 3**; surface them in the UI as "needs reconcile," handle one-by-one | Get the 169 unambiguous matches in fast; long tail is manual. |
| 9 | **Stop the parallel instance's planned `spotify-app` Supabase fork**; spotify-history stays as analytics/source | Owner confirmed (ideas-v5 §3). |

Anything not on this list is open — make a recommendation, surface it to the owner.

---

## 3 · Originality — what this app is NOT

The owner explicitly said *"I don't have any intention to make this just as same as
Spotify, would like to have some originality in this."* Keep these disciplines:

**DO build (these are the app's identity)**

- Brains as the centerpiece of "seeing your taste" (Brain 3's concentric layout +
  Brain 4's genre-bridge highlighting are unique to this app).
- Channels as **ordered broadcast loops**, not an on-demand library.
- **Discovery only through channels** — no free browse for listeners. Friction by design.
- Audio-optional, text-first songs (a song without an MP3 still exists and still
  plays "silently" in a channel loop — it just advances on a timer).
- "Vs Sarthak" comparison via tree coverage (eventually — see ideas-v3).
- The visual language: void (`#0A0A0B`) / surface-1/2/3 / ember (`#FF6B35`) / twilight
  (`#7B68EE`) / Playfair Display for headlines / Outfit for body / Caveat for personal
  text. Late-night-radio-in-a-friends-room mood.

**DON'T build (these are Spotify clones; the owner explicitly doesn't want them)**

- Full-text catalog search for listeners.
- An on-demand "play any song" library page for friends.
- Social feeds, comments, collaborative playlists.
- Spotify-style algorithmic recommendations ("you might like…") — recs here are
  rule-driven over the owner's curated tree, not crowd-derived.
- Anything that takes intent away from the listener.

---

## 4 · Architecture

### Two Supabase projects, one Next.js app

```
                Workshop page
                /admin/workshop
                       │
                       ├─→ src/lib/supabase/server.ts        (existing — writes here)
                       │       ↓
                       │   Radio app DB: eyljbqnglfbkbflwpkxv
                       │   folders / playlists / playlist_tracks / tracks /
                       │   track_artists / artists / channels / channel_state / …
                       │
                       └─→ src/lib/supabase/spotify-data.ts  (NEW — reads only)
                               ↓
                           spotify-history DB: ewialamgozrsvjtbxghd
                           streams (181k) / playlists (638) / tracks (17k) /
                           artists (5.5k) / playlist_tracks (24k) / …
```

The browser **never** talks to spotify-history. All cross-DB reads happen in API
routes under `/api/workshop/*` using the server-side `spotifyData` client.

### Where Workshop code lives

```
src/
  app/
    admin/
      workshop/
        page.tsx                       ← the Workshop page (host-gated)
    api/
      workshop/
        spotify-tree/route.ts          ← Phase 1
        preview-import/route.ts        ← Phase 3
        import/route.ts                ← Phase 3
        create-rule-channel/route.ts   ← Phase 7
  components/
    admin/
      workshop/
        SpotifyTreePanel.tsx           ← Phase 1
        WorkingTreePanel.tsx           ← Phase 2
        GoldenTreePanel.tsx            ← Phase 8
        ChannelsRail.tsx               ← Phase 5
        ImportModal.tsx                ← Phase 3
        RuleChannelModal.tsx           ← Phase 7
        useWorkshopDrag.ts             ← Phase 4 (dnd-kit wrapper)
  lib/
    supabase/
      spotify-data.ts                  ← Phase 0.5 (read-only client wrapper)
    rules/
      evaluate.ts                      ← Phase 6 (pure rule → tracks function)
  data/
    spotify-tree.json                  ← Phase 0.5 (bundled, parsed once)

supabase/migrations/
  016_channels_rule_config.sql         ← Phase 6 (add channels.rule_config jsonb)

scripts/
  seed/
    parse-spotify-tree.mjs             ← Phase 0.5 (one-time parser; run by hand)
```

Everything else in the repo is untouched.

### Existing files that get one-line additions (NOT rewrites)

| File | Change |
|---|---|
| `src/app/admin/page.tsx` | Add a `◈ Workshop` link to the dashboard nav strip (next to the brain chips). |
| `src/app/api/channels/[slug]/loop/route.ts` | Add a third branch: if `channel.rule_config != null`, evaluate the rule and use its tracks. The existing playlist + single-track branches are untouched. |

---

## 5 · Phases — each independently deployable, each verifiable

Verify pattern after every phase (this is how this repo deploys, see `errors.md` workflow):

```bash
npx tsc --noEmit       # type check
npm run build          # webpack build
git add <files>
git commit -m "..."
git push origin main   # Vercel auto-deploys (~50s) to considerable.in
# then: curl the live endpoint to confirm
```

---

### Phase 0.5 — Infrastructure (no UI yet)

**Goal:** the page exists at `/admin/workshop`, host-gated, blank. Cross-DB client wired.

**Files added**

- `src/lib/supabase/spotify-data.ts`:
  ```ts
  import { createClient } from "@supabase/supabase-js";
  export const spotifyData = createClient(
    process.env.SPOTIFY_DATA_SUPABASE_URL!,
    process.env.SPOTIFY_DATA_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  ```
- `src/app/admin/workshop/page.tsx`: minimal host-gated shell (mirror the auth
  pattern from `src/app/admin/graph3/page.tsx`). Renders a header "Workshop" and
  the four-panel placeholder layout (empty divs labelled Source / Working /
  Golden / Channels).
- `src/data/spotify-tree.json`: created by running `scripts/seed/parse-spotify-tree.mjs`
  once. Owner provides `library_structure.html` (already in `~/Downloads/`).
- `scripts/seed/parse-spotify-tree.mjs`: a one-shot Node script that reads the
  HTML, walks the `.folder` / `.playlist` divs (the structure is plain — see
  the file), and emits a JSON tree:
  ```ts
  type Node =
    | { type: "folder"; name: string; children: Node[]; counts?: { playlists: number; folders: number } }
    | { type: "playlist"; name: string; owner?: string };
  type TreeFile = { root: Node[]; generatedAt: string; sourceFile: string };
  ```
  Use a small HTML parser (`node-html-parser` is already in `node_modules` for
  the import-graph script).
- 1 line in `src/app/admin/page.tsx`: add `<Link href="/admin/workshop" …>◈ Workshop</Link>`
  next to the existing `◈ Brain 1..4` chips.

**Env vars added** (`.env.local` + Vercel project env)

- `SPOTIFY_DATA_SUPABASE_URL` = `https://ewialamgozrsvjtbxghd.supabase.co`
- `SPOTIFY_DATA_SUPABASE_ANON_KEY` = (anon key; ask owner, or read from the
  parallel handoff. RLS is off on that project per the parallel instance's notes
  — anon SELECT works.)

**Schema** none.

**Acceptance**

- `/admin/workshop` returns 307 to /login for anon (matches other brains).
- Host loads the page, sees four empty labelled panels.
- `tsc` + build green.
- A test API route can `await spotifyData.from("playlists").select("name").limit(1)`
  and get a row back (verify server-side in a throwaway endpoint or by hand;
  remove the test endpoint before committing).

**Effort** ~30–60 min.

---

### Phase 1 — Source panel (Spotify tree, read-only)

**Goal:** the Source panel renders the full Spotify tree with collapse/expand and
per-playlist match status against the radio app.

**Files added**

- `src/app/api/workshop/spotify-tree/route.ts`:
  - GET — reads `src/data/spotify-tree.json` (import at build time or `fs.readFile`
    via `next/server`).
  - For each playlist in the tree, attach a `match` field:
    - `{status: "exists", radio_playlist_id: N}` if a radio-app playlist matches by
      normalised name (use the same `norm()` function as in
      `scripts/seed/attach-batch.mjs`).
    - `{status: "ambiguous", candidates: [N, M, …]}` if multiple radio-app
      playlists match the same normalised name.
    - `{status: "missing"}` otherwise.
  - **Paginate the radio-app `playlists` fetch** (E005). 42 today, but it will
    grow.
- `src/components/admin/workshop/SpotifyTreePanel.tsx`:
  - Recursive tree component, collapsible (same pattern as the existing
    `FolderTree.tsx` — read it for the visual language).
  - Each folder shows count badge (e.g. "20 playlists").
  - Each playlist shows match status: ✓ green dot for exists, ⚠ amber for
    ambiguous, ◌ grey for missing.
  - Read-only this phase; no interactions yet.

**Acceptance**

- Source panel renders all 9 top folders + nested structure.
- The 169 unambiguous matches show ✓, the 12 ambiguous show ⚠, the 79 unmatched
  show ◌. Numbers may vary slightly with new imports.

**Effort** ~2–3 hr.

---

### Phase 2 — Working tree panel (radio app, read-only this phase)

**Goal:** the Working panel renders the radio app's current `folders` + `playlists`
side-by-side with Source.

**Files added**

- `src/components/admin/workshop/WorkingTreePanel.tsx`:
  - Uses the existing `/api/graph` data OR a smaller new endpoint
    `/api/workshop/working-tree` that returns just folders + playlists with track
    counts (lighter than /api/graph). Reuse `/api/graph` first if you can — it's
    already paginated and battle-tested.
  - Visual language matches `FolderTree.tsx` for consistency with the rest of
    `/admin`.

**Acceptance**

- Working panel shows current 6 folders + 42 playlists.
- Owner can visually compare Source vs Working.

**Effort** ~1–2 hr.

---

### Phase 3 — Import action (Source → Working)

**Goal:** owner clicks "Import" on a Source playlist or folder; it materialises in the
radio app's DB (idempotent).

**Files added**

- `src/app/api/workshop/preview-import/route.ts`:
  - GET `?node=<source-tree-path>` (e.g. `?node=rock/scream`).
  - Dry-run. Returns: would-create folders, would-create playlists, per-track
    breakdown:
    - `{action: "match-uri", track_id: N, spotify_uri}` — exact URI match in
      radio app's `tracks.spotify_uri`.
    - `{action: "match-title-artist", track_id: N, candidates: [...]}` — fallback
      match via `attach-batch.mjs`-style normalisation.
    - `{action: "create", title, artists, spotify_uri}` — no match.
- `src/app/api/workshop/import/route.ts`:
  - POST `{node: <source-tree-path>, mode: "playlist" | "folder"}`.
  - Performs the import. Uses radio-app `createAdminClient()` (service role —
    bypasses RLS for writes).
  - Reads source data from `spotifyData` (server-only).
  - Track-matching order:
    1. **Spotify URI / ID** — `tracks.spotify_uri = <uri>` or `tracks.spotify_id = <id>`.
    2. **Title + primary artist (normalised)** — same `norm()` as `attach-batch.mjs`.
    3. **Create** — insert into `tracks` with `spotify_id` + `spotify_uri` populated
       so future re-imports hit branch 1.
  - For imported songs without audio: leave `file_url` / `file_key` null. The
    listener handles audio-optional tracks. Audio is attached later via
    `attach-batch.mjs` when the owner uploads MP3s.
  - Folders/playlists: find-or-create by `(name, parent_id)` / `(name, folder_id)`.
  - Idempotent: re-running the same import should produce **zero new rows**.
- `src/components/admin/workshop/ImportModal.tsx`:
  - Shows the dry-run breakdown.
  - "Confirm import" button calls the POST endpoint.
  - Surface ambiguity / missing rows with a small "needs reconcile" badge that
    the owner can ignore for now (handled in Phase 10).

**Acceptance**

- Import one Source playlist; verify in DB it created a playlist + matched/created
  tracks.
- Re-import same playlist; zero new rows.
- Import a folder; cascades to all child playlists.
- Brain 1 (`/admin/graph`) reflects the new structure on refresh.

**Effort** ~3–4 hr.

---

### Phase 4 — Drag-and-drop in the Working tree

**Goal:** owner can drag playlists between folders, nest folders, reorder.

**Files added**

- `src/components/admin/workshop/useWorkshopDrag.ts` — dnd-kit hook (the repo
  already uses dnd-kit via `TrackUploader.tsx`; copy the pattern).
- Logic:
  - **Drag playlist into folder** → `PATCH /api/playlists/[id]` with `{folder_id}`.
    Uses the existing endpoint (already supports this — see `PATCH` in
    `src/app/api/playlists/[id]/route.ts`).
  - **Drag folder under parent** → `PATCH /api/folders/[id]` with `{parent_id}`.
  - **Reorder within folder** → `PATCH /api/playlists/[id]` with `{position}`
    (or batch endpoint if needed).
- Confirmation modal for cross-folder moves (toggleable preference; default ON
  while owner is getting comfortable).
- A small "Recent moves" list in the panel (last 5; click to undo, session-scoped).

**Acceptance**

- Drag persists across reload.
- Brain 1 reflects the move on next refresh.
- Cross-folder move shows confirmation.
- "Recent moves" undoes the last move.

**Effort** ~3–4 hr.

---

### Phase 5 — Channels rail (display only)

**Goal:** the rail shows existing channels and is ready to accept drops.

**Files added**

- `src/components/admin/workshop/ChannelsRail.tsx`:
  - Lists channels from existing `/api/channels` (already privacy-enforced — see E008).
  - Per-channel: name, slug, badge (handcrafted or rule — rule support comes
    Phase 6 so initially everything is "handcrafted").
  - Visual drop zone (empty until Phase 7).

**Acceptance**

- Lists all 13 current channels.
- Renders the drop-zone affordance.

**Effort** ~1 hr.

---

### Phase 6 — Rule-channel infrastructure (DB + /loop)

**Goal:** channels can be defined as rules. The `/loop` endpoint evaluates rules.

**Migration `supabase/migrations/016_channels_rule_config.sql`**

```sql
alter table channels add column if not exists rule_config jsonb;
-- rule_config null = handcrafted (Option A). non-null = rule-channel (Option B).
-- shape v1: {type: "playlist", source_id: <int>} | {type: "artist", source_id: <int>}
comment on column channels.rule_config is
  'When set, channel queue is computed from this rule against the tree (Option B).
   Null means handcrafted (Option A) — uses channel_state.source_type instead.';
```

Apply via `npx supabase migration up` (or MCP if available; see how migration
015 was applied).

**Files added**

- `src/lib/rules/evaluate.ts`:
  ```ts
  type RuleConfig =
    | { type: "playlist"; source_id: number }
    | { type: "artist"; source_id: number };

  export async function evaluateRule(
    supabase: SupabaseClient,
    rule: RuleConfig
  ): Promise<LoopTrack[]> {
    if (rule.type === "playlist") {
      // pull ordered tracks from the playlist (mirror existing playlist-source branch)
    }
    if (rule.type === "artist") {
      // pull all tracks linked to artist via track_artists, ordered alphabetically by title initially
    }
  }
  ```
  - Returns objects with the same shape as the existing `/loop` `tracks[]` items:
    `{id, title, artist, file_url, cover_url, duration_ms}`.
  - **Paginate any full-table fetch** (E005).

**Files modified**

- `src/app/api/channels/[slug]/loop/route.ts`:
  - After fetching the channel, add a third branch:
    ```ts
    let loopTracks: any[] = [];
    if (channel.rule_config) {
      const ruleTracks = await evaluateRule(supabase, channel.rule_config);
      loopTracks = ruleTracks;
    } else if (state?.source_type === "playlist" && state?.source_id) {
      // existing playlist branch
    } else if (state?.current_track) {
      // existing single-track branch
    }
    ```
  - Rest of the route (current_index computation, position_ms, JSON shape) is
    unchanged.

**Acceptance**

- Manually insert a rule-channel row in DB:
  `update channels set rule_config = '{"type":"playlist","source_id":38}'::jsonb where slug = 'call-me-when-you-land'`
  (don't actually do this on a live channel — use a throwaway one for the test).
- Curl `/api/channels/<slug>/loop`; verify it returns the playlist's tracks via the
  rule path.
- Existing channels (rule_config null) still work identically — regression check
  all 13 via the live API.

**Effort** ~3–4 hr (migration + evaluator + route edit + tests).

---

### Phase 7 — Drag-to-channel (rule-channel creation)

**Goal:** owner drags a Source/Working playlist node onto the Channels rail; a
modal appears; confirming creates a rule-channel.

**Files added**

- `src/app/api/workshop/create-rule-channel/route.ts`:
  - POST `{name, rule_config}` → creates channel with that rule, `is_public: false`,
    `description: null`. Slug derived from name.
  - Idempotent on slug collision (use the same slug-suffix loop as in
    `src/app/api/channels/route.ts`).
- `src/components/admin/workshop/RuleChannelModal.tsx`:
  - Shown when a playlist node is dropped onto the rail.
  - Inputs: name (default "Play '{playlist name}'"), is_public toggle (default OFF).
  - Shows a small preview of the queue (call the new endpoint, then `/loop`
    preview, or compute client-side from the rule shape).
- Drop handler in `ChannelsRail.tsx`: accept playlist-typed drag events from
  `WorkingTreePanel` / `SpotifyTreePanel`.

**Optional but worthwhile:** also accept artist-typed drops (an artist node
dragged from anywhere → "Play all songs by Mohan Kannan" rule). Surface artists
either inside playlists or as a separate compact panel; owner's call.

**Acceptance**

- Drag a Working playlist onto the rail → modal → confirm → channel appears in
  the rail with a "rule" badge.
- Visit `/radio/<new-slug>` (as host) → loop plays the rule's tracks.
- Channel is private by default (anon `/api/channels` doesn't include it).

**Effort** ~2–3 hr.

---

### Phase 8 — Golden tree panel

**Goal:** a dedicated panel for the "Golden" subtree (small, tight, very-similar-
songs playlists). Visually distinct (gold), same drag affordances.

**Approach**

- No new schema. Just a top-level folder named "Golden" with `color = "#FFD700"`.
- The Workshop page renders the Golden subtree in its own panel; the rest of the
  folders go in the Working panel.
- Owner creates the Golden folder via a "Create Golden folder" button if it
  doesn't exist yet (one-shot POST to `/api/folders`).

**Files added**

- `src/components/admin/workshop/GoldenTreePanel.tsx`:
  - Same as `WorkingTreePanel.tsx` but filters to the Golden subtree.
  - Gold accent (border + tag).
  - Drag-and-drop works the same way (a playlist dragged from Working → Golden
    moves it into the Golden folder, no other change).

**Brain integration (free)**

- The brains read `folders.color` and already use it. Setting Golden = `#FFD700`
  means gold cluster appears in Brains 1, 3, 4 automatically.
- Optional polish: in `src/components/admin/ConcentricBrain.tsx`, give Golden
  nodes a slightly thicker ring or a subtle glow. Tiny edit; defer to Phase 10.

**Acceptance**

- "Create Golden folder" works once; idempotent thereafter (button hides if
  exists).
- Dragging a playlist into Golden moves it; brain colors it gold on refresh.
- Workshop shows Golden separately from Working.

**Effort** ~2–3 hr.

---

### Phase 9 — Wire the brains (mostly free)

**Goal:** the brains visibly benefit from the Workshop. Mostly happens for free.

**What you actually do**

- Nothing in the brain code, unless you want Golden nodes to have a special outline
  (one edit in `ConcentricBrain.tsx` — check `folder.color === GOLD` and stroke
  a thicker ring).
- Update `docs/brain3/BRAIN3.md` if Golden gets a new visual treatment.

**Acceptance**

- Open Brain 3 after importing a Source folder → tree is visibly richer.
- Open Brain 1 → more colored bridges as imported folders pick up colors.

**Effort** ~0–1 hr.

---

### Phase 10 — Polish

**Goal:** the workshop feels safe and pleasant.

**Items**

- **Session undo stack** — keep the last N moves in `useState`; offer one-click undo.
- **Confirmation modals** — cross-folder drag, "Import folder" cascade (warn how
  many playlists + tracks), rule-channel public-toggle.
- **Ambiguity reconcile sheet** — for the 12 ambiguous + 79 unmatched Source
  playlists, a sidebar that lets the owner pick the right match or "create new" /
  "skip permanently."
- **Empty states + skeletons** — loading, no-Golden-folder-yet, no rule-channels-yet.
- **A small "What changed?" log** at the bottom (last 20 Workshop ops).
- **Keyboard shortcuts** — `i` to import the focused Source node, `g` to send to
  Golden, etc. (only if owner asks).

**Acceptance**

- Owner can use the page for an hour without dread of breaking something.

**Effort** ~3–6 hr (incremental).

---

## 6 · Verification pattern (repeat after every phase)

```bash
# inside the repo root: C:\Users\lenovo\Desktop\June\2_June\radio
npx tsc --noEmit
# expect: "tsc exit: 0" (no output = success)

npm run build
# expect: "✓ Compiled successfully" and the new route(s) in the build manifest

git status --short
git add <touched files only — never -A>
git commit -m "<type>: <short imperative>"
git push origin main
# Vercel auto-deploys to considerable.in (~50s).

# After deploy, verify the live endpoint:
curl -s "https://www.considerable.in/admin/workshop" -o /dev/null -w "%{http_code}\n"
# expect: 307 (auth redirect — confirms route is deployed)

# For API endpoints, curl them directly (most return JSON; anon-readable ones
# return data, gated ones 404/307).
```

If anything fails: **read `errors.md` E000–E008.** Most "weird" issues there are
already documented (especially E004 unique realtime channel names, E005 1000-row
silent cap, E008 private channels not enforced).

---

## 7 · Schema reference (quick — full ER in `docs/BACKEND.md` §1)

### Radio app DB (`eyljbqnglfbkbflwpkxv`) — where the Workshop writes

| Table | Key columns | Used in this plan |
|---|---|---|
| `folders` | `id, name, parent_id, color` | Imported folder hierarchy; Golden = top-level folder with gold color. |
| `playlists` | `id, name, folder_id, is_public` | Imported playlists; drag-drop edits. |
| `playlist_tracks` | `playlist_id, track_id, position` | Imported playlist contents. |
| `tracks` | `id, title, artist_id, spotify_id, spotify_uri, isrc, file_url, …` | Track matching (Spotify URI primary). Migration 012 added the identifier columns. |
| `artists` | `id, name, slug` | Find-or-create when importing songs. |
| `track_artists` | `track_id, artist_id, role` | Many-to-many for featured artists. |
| `channels` | `id, name, slug, is_public, status, rule_config (Phase 6)` | Channels rail; rule-channels carry `rule_config`. |
| `channel_state` | `channel_id, source_type, source_id, current_track_id, repeat_mode, is_playing, playback_started_at, …` | Handcrafted channels still use this. Rule-channels need `is_playing + playback_started_at` set so `/loop` computes a position; `source_type` can stay null. |

### spotify-history DB (`ewialamgozrsvjtbxghd`) — read-only via `spotifyData` client

| Table | Key columns | Used |
|---|---|---|
| `playlists` | `id, name, owner, description, …` | Resolving Source playlists. |
| `playlist_tracks` | `playlist_id, track_id, position` | Source playlist contents. |
| `tracks` | `id, spotify_id, spotify_uri, name, artist, album, …` | Source track resolution (carries Spotify URIs into our `tracks.spotify_uri`). |
| `artists` | `id, spotify_id, name, …` | Source artist resolution. |
| `streams` | `played_at, track_id, ms_played, context_type, …` (181k rows) | **Reserved for later phases** (rule filters by time-of-day / replay count). Not used in Phases 0.5–9. |

---

## 8 · Things I deliberately did NOT add to this plan (in scope discipline)

- **The full rec-engine** (tree-coverage scoring, "vs Sarthak" UI, `liked_songs`
  tables). That's BACKEND.md Phases 6–7. Plan it after the Workshop ships.
- **The orchestrator channel-editing UI** (rename / add / remove / public-toggle
  in `/admin`). Owner explicitly parked this until after the rec phase.
- **Importing the `streams` (181k rows) into the radio app's DB.** Read from
  spotify-history when rules need it (Phase 6+ later). Don't duplicate the data
  unless you must.
- **Removing the parallel `spotify-history` project.** Stays as analytics + the
  read-source. Deleting is a future decision after the Workshop has imported
  everything the owner wants.
- **A `channel_tracks` table to decouple channels from backing playlists**
  (BACKEND.md §3). The 5 existing backing-playlists (#38, #39, #40, #41, #42)
  keep working. `channel_tracks` is a follow-up cleanup, not a Workshop concern.

---

## 9 · Owner preferences to carry forward (from earlier docs)

- **Heavily context-budget aware.** Never `cat` / Read big files; summarise via
  scripts. Don't load `library_structure.html` into LLM context — the parser
  emits a small JSON file.
- **Builds incrementally.** Wants to see each phase, then decide. Don't try to
  finish 10 phases in one shot. Ship Phase 0.5 → 1 → 2 first, get feedback,
  iterate.
- **Likes versioned artifacts.** When iterating on a doc, bump the version
  (`ideas-vN.md`, `feedback-vN.md`). Existing convention; don't break it.
- **Doesn't want a Spotify clone.** Re-read §3 of this doc before every visual
  decision.
- **Channels are first-class.** A new rule-channel is a real channel that friends
  can tune into — privacy enforcement (E008) applies.
- **Verify with `tsc --noEmit` + `npm run build`** before pushing. Push to `main`
  → Vercel auto-deploys to considerable.in.
- **All seed scripts live in `scripts/seed/`** and are committed with the dated
  pattern (`seed-rock-2026.mjs`, `seed-channels-2026-05-26.mjs`, etc.). The
  Workshop is mostly UI but its one-time parser (`parse-spotify-tree.mjs`)
  follows the same convention.

---

## 10 · Appendix — relevant existing files to reference (don't re-derive these)

| Concern | File |
|---|---|
| Auth pattern for an admin page | `src/app/admin/graph3/page.tsx` (host gate + early returns) |
| dnd-kit usage | `src/components/admin/TrackUploader.tsx` (drag-and-drop file upload — copy the pattern) |
| FolderTree visual language | `src/components/admin/FolderTree.tsx` |
| Idempotent find-or-create patterns | `scripts/seed/attach-batch.mjs`, `scripts/seed/seed-channels-batch.mjs`, `scripts/seed/seed-rock-2026.mjs` |
| Track-matching normalisation (`norm()`) | `scripts/seed/attach-batch.mjs` lines defining `norm = (s) => ...` |
| Cross-DB read pattern | TBD — this plan introduces it (`src/lib/supabase/spotify-data.ts`) |
| Loop computation + audio-optional | `src/app/api/channels/[slug]/loop/route.ts` |
| Listener (consumes /loop, plays through locally) | `src/app/radio/[slug]/page.tsx` |
| Brain colors (Workshop changes light up here) | `src/components/admin/KnowledgeGraph.tsx`, `src/components/admin/ConcentricBrain.tsx`, `src/lib/brain-colors.ts` |
| Existing channel routes (model the new Workshop API routes after these) | `src/app/api/channels/route.ts`, `src/app/api/channels/[slug]/loop/route.ts` |
| Migrations | `supabase/migrations/001..015` (next is 016 in Phase 6) |
| Errors log (READ THIS) | `errors.md` E000–E008 |
| Backend audit | `docs/BACKEND.md` |
| Brain reading guide | `docs/brain3/BRAIN3.md` |
| Versioned briefs | `ideas-v1..v5.md`, `feedback-v1..v3.md` |

---

## 11 · Owner sign-off checkpoints

Don't ship in one go. After each of these phases, **pause and show the owner**:

- **After Phase 0.5** — page exists, blank, host-gated. ("Does the layout feel right?")
- **After Phase 1+2** — Source vs Working side-by-side. ("Are the match counts about
  what you expected? Any glaring missing or wrong-matched ones?")
- **After Phase 3** — first folder imported. ("Did the brain change the way you
  hoped?")
- **After Phase 4** — drag-and-drop. ("Is the confirmation modal too noisy?")
- **After Phase 6+7** — first rule-channel created. ("Listen to it. Does it feel
  different enough from a handcrafted channel?")
- **After Phase 8** — Golden visible. ("Does the visual treatment match the
  'absolute data' framing in your head?")

The owner explicitly said *"sounds good and doable"* about the direction; they
want to see each piece land before greenlighting the next.

---

## 12 · TL;DR for the fresh LLM

- Build `/admin/workshop` — a four-panel page in this existing radio app.
- Read from `spotify-history` Supabase (parallel instance's project — kept as
  read-source), write to the radio app's existing schema. Two Supabase clients.
- Phases 0.5 → 10. Each independently deployable.
- Five locked decisions (§2). Don't redebate; ask owner if you want to change.
- Don't make this Spotify (§3). The brains, channels-as-loops, no-free-browse,
  audio-optional, late-night-mood are this app's identity.
- Verify with `tsc` + `npm run build` + push + curl after every phase.
- Read `errors.md` E000–E008 before you trip on them.
- Pause for sign-off after Phases 0.5, 2, 3, 4, 7, 8.
