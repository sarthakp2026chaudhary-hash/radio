# Brain 3 — "THE BRAIN" (concentric artist → song → playlist graph)

_Last updated: 2026-05-26._ A reading guide + a plan for growing the brains as more
genres and songs arrive. The live code is in `src/`; a frozen copy of Brain 3 sits
next to this file so it can't be lost:

| File (live) | Frozen snapshot (here) | What it is |
|---|---|---|
| `src/components/admin/ConcentricBrain.tsx` | `ConcentricBrain.snapshot.tsx` | the whole Brain 3 (layout + coloring + interaction) |
| `src/lib/brain-colors.ts` | `brain-colors.snapshot.ts` | the shared palette (also used by Brain 4) |
| `src/app/admin/graph3/page.tsx` | `graph3-page.snapshot.tsx` | the page: auth + resolves the dprsh playlists + renders the component |
| `GET /api/graph` | — | the data source (nodes: folder/playlist/song/artist + links) |

> The snapshots are documentation only — `docs/` is excluded from `tsconfig`, so they
> are **not** compiled and can drift from the live code. They're a "this is what it
> looked like on 2026-05-26" backup, not a second copy of the app.

---

## 1. What you're looking at

A single HTML `<canvas>` laid out as **three concentric rings** (d3 `forceRadial`):

- **Artists** — innermost (the dense central cluster)
- **Songs** — middle ring
- **Playlists** — outer ring

Folders are hidden. Edges run **playlist → song** and **song → artist**. You can
**drag** any node (it pins where you drop it), **pan** by dragging empty space,
**zoom** with the wheel/pinch, and **hover/click** a node to light up its connections
(everything else dims). The tooltip shows counts.

## 2. The encoding — what the colors actually MEAN

There are two "genres" today, defined by **edge color**:

- **green** = the normal / "Beam me up, jesus." world
- **blue** (`#5C82B0`) = **dprsh** (the sad playlists, folder `dprsh1`)

From those edges, everything else is derived:

| Visual | Meaning |
|---|---|
| **Edge color** | the genre of the **playlist end** of that edge (dprsh playlist → blue, otherwise green). A song↔artist edge has no playlist end, so it stays neutral/green. |
| **Node color = green** | belongs to **one** genre, and it's green (only normal playlists) |
| **Node color = blue** (`#5C82B0`) | belongs to **one** genre, and it's dprsh (a "pure-sad" node) |
| **Node color = aqua** (`#5BEAD4`) | **bridge** — belongs to **both** genres (a green + a dprsh playlist) |
| **White ring** | **monogenre** — belongs to exactly ONE genre. Bridges (aqua) get **no** ring. |
| **Bigger node** | (artists only) more songs |

Crucially, **artists are colored the same way as songs**: an artist's genres are the
**union over all its songs' playlists**. So an artist who only ever appears on sad
songs is blue + ringed; an artist whose songs span both worlds is aqua + no ring.

### Worked examples (from the live graph)
- **Mohan Kannan** — all his songs are sad → one genre → **blue node + white ring**.
- **Kuch Kaam** (song) — only in the `dprsh1` playlist → one genre → **blue + white ring**.
- **Shaan** (artist) — has songs in both worlds → **aqua, no ring**.
- **"Lie To Me"** — in a dprsh playlist *and* green playlists → **aqua**, with a **blue
  edge** to the dprsh playlist and **green edges** to the others.

## 3. How to read it (what to observe)

- **Aqua, no ring = crossover.** These are the interesting nodes — songs/artists that
  live in more than one genre. They're where your categories blend.
- **Blue + ring = pure-sad island.** Lives only in dprsh, connects to nothing else.
- **Green threads leaving the blue cluster** = sad songs/artists reaching into the rest
  of the brain. Lots of them = the sad world overlaps everything; few = it's
  self-contained.
- **Hover/click** a node to isolate its neighborhood; **drag** it out of the cluster to
  inspect it.
- An aqua **artist** is a tell that the artist crosses moods; a blue+ring artist is a
  one-mood artist.

This is the analytically useful split — "pure" vs "crossover" — and it's exactly the
kind of structure that feeds the ML/analysis goal: overlaps between a hand-labeled
genre (dprsh) and everything else.

## 4. Why the code is shaped like this (the LOC rationale)

Read `ConcentricBrain.snapshot.tsx` alongside this. The component is one big `useEffect`
because it owns an imperative canvas + animation loop, not React-rendered DOM.

1. **Canvas, not SVG/DOM.** The graph is ~1.3k nodes and thousands of edges. An SVG/DOM
   node per item would be unusably slow. So it's a single `<canvas>` with a manual
   `draw()` called every frame via `requestAnimationFrame`.
2. **d3-force for layout only.** `forceRadial` pins each node type to its ring radius
   (`RADIAL = { artist: 0, song: 430, playlist: 700 }`); `forceManyBody` + `forceCollide`
   spread them; `forceLink` pulls connected nodes together. We never let d3 touch the
   DOM — we just read each node's `x/y` and paint it.
3. **The pipeline (inside the effect):**
   `fetch('/api/graph')` → build adjacency maps (`songPlaylists`, `artistSongs`,
   `playlistSongs`) from the **raw string** links → compute each node's genre
   membership (`hasGreen` / `hasBlue`) → derive `fill` (green / blue / aqua) and `mono`
   (white ring) → `forceSimulation(...)` → start the `draw()` loop.
   Membership is computed **before** `forceLink` runs, because `forceLink` mutates each
   link's `source`/`target` from string ids into node objects.
4. **`dprshPlaylistIds` is a prop, not hard-coded.** The page resolves the `dprsh1`
   folder's playlists (`playlists.folder_id`) and passes their ids (`p<id>`). The
   component decides genre membership purely from "is this playlist in that set?"
5. **Colors live in `src/lib/brain-colors.ts`** so Brain 3 and Brain 4 use the exact
   same hexes — change one constant, both brains update, they can't drift.
6. **Interaction** is hand-rolled pointer handling: `onDown` decides node-drag vs pan
   (hit-test), `onMove` updates a dragged node's pinned `fx/fy` or the pan offset or the
   hover target, `onWheel` zooms about the cursor. Hover is a nearest-node hit-test
   within a zoom-scaled tolerance.

## 5. Moving forward — the organized way

### 5a. Adding songs (the routine)
1. `node scripts/seed/attach-batch.mjs --dry-run` — **read-only dedup report.** Edit its
   `TARGETS` first. It matches each song against every existing track (normalized
   title + artist) so you never create duplicates. Review the EXISTS / TITLE-ONLY /
   NEW verdicts.
2. `node scripts/seed/attach-batch.mjs` — upload audio to R2 + create/attach tracks. **No
   genre is set** (by design — genre comes later via folders).
3. File songs into playlists/folders (Quick Add `/admin/add`, or the song-actions sheet).
   **A song that's in no playlist won't appear in any brain** — playlists are how a song
   enters the graph.

### 5b. Adding a genre (Rock, Faithless, …)
1. Import its map: `node scripts/import/import-graph.mjs "<html>" --genre "Rock"`.
2. **Color its folder** (the swatch in the Library tree): e.g. Rock = red, Faithless = pink.
3. The brains pick it up automatically. The coloring model **generalizes**: a node's
   color is the *blend of the genres it touches*, and the white ring still means "belongs
   to exactly one genre." With 3+ genres you'll want to decide explicit blend colors for
   the common pairs (today there's just one blend: green+blue = aqua) — add them to
   `brain-colors.ts`.
4. **Keep genres few + authoritative** (a handful of colored folders) and **playlists
   many + fuzzy** (personal memory buckets). Genres are the labels you analyze on;
   playlists are the raw signal.

### 5c. Making MORE brains comfortably (the backend pattern)

Right now a "brain" is just a page that makes three choices and hands them to a graph
component:

1. **Scope** — which slice of the library (`/api/graph?folder=<id>`, or the whole thing).
2. **Highlight** — which playlists/songs to recolor (today: the `dprsh1` playlists,
   passed as `dprshPlaylistIds`).
3. **Layout** — `KnowledgeGraph` (free-floating force graph, Brains 1/2/4) or
   `ConcentricBrain` (the rings, Brain 3).

Both layout components already take the same highlight input and share the palette, so a
new brain is *mostly* a copy-paste page today. To make new brains (from "these specific
songs", a vibe, an artist, etc.) genuinely cheap, here's the suggested path — **not built
yet, this is the plan**:

- **Step 1 — config registry (small refactor).** A `src/lib/brains.ts` exporting a
  `BRAINS` array: `{ slug, title, scopeFolder?, highlightPlaylists?|highlightSongs?,
  layout: 'force'|'concentric', palette }`. One generic page per layout reads the config
  by slug. **Adding a brain = one array entry + a nav link — no new page, no new logic.**
- **Step 2 — generalize "highlight" from one set to many.** Replace the single
  `dprshPlaylistIds` with a list of highlight groups, each with its own color
  (`[{ ids, color, label }]`). Then one brain can spotlight several subsets at once
  (e.g. sad = blue, hype = orange) and the blend/ring rules extend naturally.
- **Step 3 — no-code brains (later).** A `brains` table in Supabase
  `{ id, name, slug, scope_folder_id, highlight (jsonb), layout, palette }` + a tiny
  `/admin/brains` UI to define one by picking a folder / selecting songs. Pages render
  straight from the row. Then "make a brain out of these songs" = save a selection in the
  UI, **no deploy** — which is the comfort level you're after.

Until Step 1 lands, the cheapest way to add a brain is: copy `graph4/page.tsx`, change
the scope + the playlist-id resolution, point it at the layout you want, and add a nav
chip on `/admin`.

---

## Appendix — the genre/color rule in one place (today)
```
genre of an edge   = dprsh playlist end → BLUE, else GREEN
genre set of a node= the genres of the playlists it belongs to
                     (artist = union over its songs' playlists)
node color         = only green → GREEN
                     only dprsh → BLUE
                     both       → AQUA (bridge)
white ring         = node belongs to exactly ONE genre (songs/artists only)
size               = artist with more songs is bigger
palette            = src/lib/brain-colors.ts  (GREEN #3ecf8e, SAD_BLUE #5C82B0, BRIDGE #5BEAD4)
```
