# Feedback v2 — Brain 2 → Brain 3 (the concentric "THE BRAIN")

Date: 2026-05-22

## What was asked (the exact ask)
- **Keep Brain 1 AND Brain 2 — do not remove or change them.** Brain 3 is a separate, *additional* view. ("do keep brain 2, do not remove it … now make brain 3", "another attempt at brain".)
- **Layout** like the reference HTML (`knowledge_graph_v9`): **artists on the inside, then songs (middle), then playlists on the outside** connecting in to the songs.
- **Interactive:** "this even highlights when i touch something, is movable also" → hover highlights a node's connections; nodes are **draggable**; **click to highlight connections**; hover **tooltip** with counts, e.g. *"Kavita Krishnamurthy · 3 songs · in 3 playlists ⇄ shared"*.
- **Bigger artist = more songs. White ring = shared across playlists.**

## Coloring decision (important — drives current + future brains)
- "since these are all for beam me up jesus and since **i decide genre and it not about shared playlist**, these should be **green only for now**."
- Meaning: the genre/brain is **owner-decided, not inferred from shared playlists.** The whole dataset is currently the Beam genre → render everything **green**. Multi-brain colors (Rock = red, Faithless = pink, etc.) appear only once other genres are imported/colored.
- On "Unknown": fine to keep **Unknown as a real artist** (already seeded) as a placeholder for missing data; owner will fix specifics. Used originally so song numbering stayed intact when names were missing.

## Built
- `/admin/graph3` — concentric d3-force (artists inner / songs middle / playlists outer), draggable (pins on drop), hover + click highlight, tooltip with counts, **all green**, white ring = shared, folders hidden, fed by live `/api/graph`. Brains 1 & 2 untouched. (commit a49ca99)
- Reference HTML re-supplied: `knowledge_graph_v9 (2).html`. Built to match its spec; fine-tuning to the exact look (ring spacing / sizes / labels) pending owner feedback.
