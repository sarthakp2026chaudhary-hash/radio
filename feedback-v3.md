# Feedback v3 — app fixes + the dprsh/genre brain coloring (the iterations)

Date: 2026-05-26 · extends [feedback-v2.md](feedback-v2.md), informs [ideas-v2.md](ideas-v2.md)

Captures the exact asks and corrections given while fixing the app and evolving the
brains, in order, with what shipped. (Quotes are the owner's words.)

## 1. App was rough on mobile / the stream broke (the blockers)
**Asked:**
- Dashboard on the installed Android PWA: "only the side bar is visible half of the
  screen and its stuck and swiping side swipes … very less space to view anything."
- Listener: "the song only plays for one song … when the song is changed in the stream …
  i litrally have to refresh everytime a song is finished otherwise it just silence."
- UI: "show like a song card … keep the default image for now"; loop-count / next / updated
  "could show next song and updated at" on hover, sized "appropriate."

**Built (commit `9b60576`):**
- Sidebar → slide-in drawer on mobile (hamburger top bar, backdrop), static on desktop.
- Listener now plays the **whole loop client-side**, advancing on `<audio onEnded>`
  (native-loops a single-song channel; audioless tracks advance on a timer). `/loop`
  gained ordered `tracks[]` + `current_index`. No more silence/refresh. (errors **E007**)
- Now-playing **song card** (cover placeholder + title + artist); loop-count as a "live"
  pill; next-song + updated-at reveal on hover (desktop) / tap (mobile).
- (Seed scripts for the bulk audio + channels landed in commit `669d6f1`.)

## 2. Brain 4 — "same as the brains, for the sad songs"
**Asked:** "make brain 4 … whatever songs are in dprsh1 folder … paint their edge sad
blue and those nodes could be sea green."
**Then corrected (twice):**
- "you didn't get it, i want **still all songs of beam me up jesus, which are green** …
  just the songs in that if are in dprsh playlist, then those songs sea green & blue edges
  … **but i still want the green ones also.**"
- So Brain 4 = the **whole green Beam graph** with the **dprsh subset highlighted**, not a
  dprsh-only view.

**Built:** `/admin/graph4` scoped to the Beam folder, dprsh subset highlighted (commits
`55618e1` → reworked `becb651`).

## 3. "Why all-blue edges? what's there to learn?" + Brain 3 too
**Asked:** "i want same thing in brain 3" and "why do you make it like that, and what's to
observe and learn from it?"
**Decision (drives the model):** color each edge by its **playlist end** (not by the song)
— so a song in a dprsh **and** a green playlist shows **one blue + one green edge**. That
surfaces **bridge** songs (sad ↔ rest), which all-edges-blue had hidden. This per-edge
model is better and became the standard.
**Built:** Brain 3 dprsh coloring (commit `30827aa`); Brains 3+4 unified on the per-edge
scheme with a shared palette `src/lib/brain-colors.ts` (commit `c80b132`).

## 4. Bridges need a distinct color
**Asked:** "since songs are having blue and green edges both, the nodes … could have a
different color … some light green yellow blue type colour, only to those which have blue
and green edges both."
**Built (commit `b5711e0`):** bridge songs render **aqua `#5BEAD4`** (a blue↔green mix)
instead of sea green, so they pop. Renamed `BRAIN_SEA_GREEN` → `BRAIN_BRIDGE`. (Owner may
push it warmer/lime or brighter cyan — easy one-line tweak.)

## 5. Color artists too + repurpose the white ring
**Asked:** "mohan keenan sings sad songs, so his artist node could also be sad blue" …
and on the white ring: "i originally thought singers/songs who share … different genre …
**not shared means different playlists, that doesnt conclude anything**" → repurpose it:
"**white around those songs that belong to literally one genre only, and artists whose all
songs belong to one genre only**" (Mohan = blue + white ring; Kuch Kaam = blue + ring;
Shaan = mix/aqua, no ring).

**Built (commit `1242585`):**
- Artists are colored by genre (an artist's genres = the union over its songs):
  only-green → green, only-dprsh → blue, both → aqua.
- White ring redefined from `shared` (in >1 playlist) → `mono` (**belongs to exactly one
  genre**). Multi-genre bridges get no ring. Tooltip "⇄ shared" → "· one genre."
- **Note for owner:** with only 2 genres and green dominating, most nodes are monogenre →
  lots of white rings; the un-ringed aqua bridges are the standouts. Can be inverted if
  too busy. (Brain 4 still shows artists grey + has no rings — offered to mirror.)

## Standing decisions reaffirmed
- Add songs **without genre**; genre comes later via colored folders.
- Genre is **owner-decided** (a colored folder), not inferred from shared playlists.
- "Unknown" stays a real seeded artist for missing data.
