# Ideas v4 — Refactor scope before the recs phase ("do I start from scratch?")

Created: 2026-05-26 · Status: open question, answered in [docs/BACKEND.md](docs/BACKEND.md).
Extends [ideas-v3.md](ideas-v3.md) (RECS SYS vision).

## The owner's question (verbatim)
> IF I GIVE YOU THE ACCOUNT DATA, CAN YOU LIKE VISIBLY CLASSIFY HOW IS THE SUBFOLDERS
> AND SONGS AND ALL / we'll see if ill give that to you or not
>
> first, just like `>>idea.md`, make `>>backend` the structure and like how
> refractored code would look and how the backend is and the functionalities
> present now
>
> after i will have, the reccs thing, and spotify data is also gonna change the
> backend too much, so i have to see how much I can do that, or do i have to start
> from scratch, **ive already invested so much time, its nice only even now**

## What's actually being asked
1. **Spotify classification** — could an LLM, given the owner's Spotify export,
   visibly classify songs into the sub-folder structure (and propose sub-folders)?
2. **Backend audit** — what does the current backend look like, and what does the
   refactored / recs-ready version look like?
3. **The deciding question** — will the rec system + Spotify integration force a
   rewrite, or can the current code be extended?

## Answers (full detail in docs/BACKEND.md)

1. **Spotify classification: yes — but redundant right now.** A parallel LLM
   instance is already processing the Spotify data (per ideas-v3.md). If that
   stalls or its output doesn't fit, hand the raw export here and this side will
   do its own pass. Default: wait for the other instance, then this side
   *integrates* the analysis into the backend (importer, schema, routes) rather
   than duplicating the analysis.

2. **Backend doc: written to `docs/BACKEND.md`.** Covers current data model,
   functionalities, what changes for recs, the "start from scratch?" question,
   and a phased refactor order (8 phases; 1–4 don't need Spotify).

3. **Do I start from scratch?** **No.** ~95% of current code survives. The recs
   refactor is additive:
   - **Added** (new tables): `channel_tracks`, `track_tags`, `liked_songs`,
     `liked_channels`, `spotify_history`; plus `channels.rule_config jsonb`.
   - **Modified** (small): one new branch in `/api/channels/[slug]/loop` for
     rule-channels; net-new UI in the orchestrator for channel editing.
   - **Rewritten:** nothing. No table dropped, no destructive migration.
   - **Re-thought** (small): `playlists.is_public` (its dual purpose collapses
     once channels stop borrowing playlists); the 5 backing-playlist channels
     get migrated to `channel_tracks` once.

## Owner's emotional read — acknowledged honestly
> "ive already invested so much time, its nice only even now"

It IS nice, and the work IS solid. Folders nestable, songs many-to-many with
playlists, channels with their own state, brains showing genre membership, audio
in R2, private channels enforced, the listener that plays through the loop
locally — these are the foundations the rec system runs *on top of*, not
*in place of*. The tree-as-ground-truth model is exactly what was needed.

## What I'd do RIGHT NOW (before Spotify lands)
- **Phase 1 — sub-folder depth.** The single highest-leverage move. Today only
  "Beam me up, jesus." has children. Rock / Out-of-love / Motivational don't
  exist as folders yet. Make them, with their sub-folders (Rock → Greats /
  Grunge / Indie / Ballads / 2000s, etc.), and file existing songs into them.
  The brains immediately get richer; future rules become one-liners.
- (Optional, also no-Spotify-needed) **Phase 2 — `track_tags`.** Tiny per-song
  tags the owner controls (`late-night`, `lyric-heavy`, etc.). Bridges to
  Spotify metadata without waiting.

Everything else benefits from waiting for the Spotify analysis to shape it.

## What stays parked
- Channels-as-rules engine (Phase 7).
- Tree-coverage / "vs Sarthak" UI (Phase 6).
- Orchestrator channel-editing UI (Phase 8) — owner's explicit instruction.
- Final shape of `spotify_history` schema.

---

## Update log
_Newest first._

### 2026-05-26 — backend audit produced before entering the recs phase
- Owner asked for an audit + refactor scope before committing to the rec system.
- Concern: "do I have to start from scratch?" Answer: **no**, additive refactor;
  detail in `docs/BACKEND.md`.
- Decision deferred: whether to hand the Spotify data to this LLM or rely on the
  parallel instance.
- One concrete action surfaced and recommended for now: **sub-folder depth
  (Phase 1)**, doable today without any new data.
