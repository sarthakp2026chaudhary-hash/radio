# Errors log

Precise record of bugs hit and how they were solved — symptom, cause, fix. Newest first.
(Plain-English mirror of the working notes; kept in the repo so it's not lost.)

---

## E008 — A "private" channel was still visible to friends
- **Symptom:** A channel created with `is_public: false` (Rakesh) still appeared in the
  channel list for anonymous/non-host users, and `/api/channels/<slug>/loop` returned its
  full data (HTTP 200). "Private" was set but not honored.
- **Cause:** `GET /api/channels` filtered only `is_active`, never `is_public`/access; the
  `/loop` route never checked access; and the `channels` table is anon-readable by RLS (so
  the flag alone hides nothing).
- **Fix:** `GET /api/channels` now returns private channels only to the **host** (or a
  member); `GET /api/channels/[slug]/loop` **404s** a private channel unless the requester
  is host/member. Access uses `db.users.isHost` + `channel_members`. Commit `5ae89fd`.
- **Lesson:** `is_public` is just a column — enforce it in the API (list + per-channel
  read). Don't rely on the UI or on RLS that's intentionally anon-readable.

## E007 — Listener stream plays one song then goes silent (had to refresh to rejoin)
- **Symptom:** On the installed Android PWA, a channel played the current song, then went
  silent when the loop should advance; the listener had to refresh + re-tap "Tune in".
- **Cause:** The listener only swapped the audio source when the server's computed
  `current_track.id` *changed*, with **no `ended` handler**. A single-song "repeat one"
  channel never changes id → never replays. Multi-song had an up-to-15s gap until the next
  poll, and the delayed `audio.play()` is blocked by mobile autoplay (no longer in a user
  gesture).
- **Fix:** Once tuned in, the client plays the **whole loop locally** and advances on
  `<audio onEnded>` (sets `audio.loop` for a 1-track channel; audioless tracks advance via
  a timer). `/api/channels/[slug]/loop` now returns the ordered `tracks[]`
  (`file_url`/`duration_ms`/`artist`/`cover_url`) + `current_index`; the 20s poll only
  resyncs the loop *composition*, never restarts the playing song. Commit `9b60576`.
- **Lesson:** drive continuous audio from the media element's own `ended` event inside the
  already-gesture-unlocked element — don't rely on a server poll to swap `src`.

## E006 — A song "uploaded" but plays nothing (the MP3 on disk was 0 bytes)
- **Symptom:** In a batch attach, "Pas de Deux" (Tchaikovsky) created a track + reported a
  successful R2 upload, but nothing plays. The batch log read `(0.00 MB, 180s)`.
- **Cause:** The source download in `~/Downloads` was 0 bytes. `existsSync` passed,
  `readFileSync` returned an empty buffer, so an empty object was PUT to R2 and `file_url`
  set. (180s = the `DEFAULT_TRACK_DURATION_MS` fallback because metadata had no duration.)
- **Fix:** Nulled `file_url`/`file_key`/`file_size_bytes` on the track (now clean
  text-only); re-download the real MP3 and re-run `attach-batch.mjs`.
- **Guard:** check `buffer.length` before upload (skip/warn on 0). Audit a live file with
  `curl -s -o /dev/null -w '%{http_code}' -r 0-0 <url>` → **206** = good, **416** = empty.

## E005 — Graph showed an artist with fewer songs than they have (silent 1000-row cap)
- **Symptom:** Lewis Capaldi showed 2 songs in the graph when the DB had 3; ~42 song↔artist
  links were silently missing.
- **Cause:** `/api/graph` fetched whole tables in one call. **Supabase/PostgREST caps a
  single response at 1000 rows and returns them with no error.** `track_artists` had 1042
  rows → ~42 dropped.
- **Fix:** paginate every full-table read with `.range(from, to)` in a loop until a short
  page. Commit `407cd17`.
- **Lesson:** ANY query meant to read a whole table must paginate (or use a `count`
  aggregate). These bugs stay invisible until a table crosses 1000 rows.

## E004 — Channel page hard-crashes ("This page couldn't load"), even in incognito
- **Symptom:** Opening `/radio/<slug>` replaced the page with Chrome's error screen; home +
  channel list were fine; failed the same in incognito.
- **Cause:** `useHostPresence` mounted twice on the page (page + `<LiveBanner>`), both
  opening a Supabase realtime channel with the **same static name**
  `"host_presence_changes"`. Supabase only allows `.on()` **before** `.subscribe()`; the
  second mount bound after subscribe → uncaught throw → React render crash.
- **Fix:** unique channel name per mount in `useHostPresence.ts`. Commit `1152a2a`.
- **Lesson:** EVERY Supabase realtime `.channel(name)` must use a UNIQUE name (hooks mount
  multiple times). For a blank/crashed page, check the **F12 console first** — a client
  crash leaves no server log.

## E003 — Login bounces you to /radio instead of the page you wanted
- **Symptom:** A friend deep-linking to `/radio/<slug>` logs in and lands on `/radio` (or a
  host on `/admin`) instead of the channel.
- **Cause:** `login/page.tsx` read the `redirect` param but ignored it (hard-coded pushes).
- **Fix:** honor `?redirect=` (and `?next=` in `auth/callback`). Commit `16a3b5c`.

## E002 — Host kicked to /admin when visiting their own channel page
- **Symptom:** Host opens `/radio/<slug>` and is immediately redirected to `/admin`.
- **Cause:** middleware used `pathname.startsWith("/radio")`, matching both the list and a
  channel page.
- **Fix:** match the list exactly: `pathname === "/radio"`. Commit `6ecb4b7`.

## E001 — Seed script crashes: Cannot find package '@aws-sdk/client-s3'
- **Symptom:** `node scripts/seed/*.mjs` throws `ERR_MODULE_NOT_FOUND`.
- **Cause:** dependencies not installed in a fresh clone.
- **Fix:** `npm install` from the repo root, then re-run.

## E000 — GitHub push denied
- **Symptom:** `git push` fails with permission denied to the wrong user.
- **Cause:** `origin` HTTPS remote without/with wrong credentials.
- **Fix:** push works via Windows Credential Manager once the right account is cached;
  otherwise embed the PAT in the push URL once, then restore the clean remote.
