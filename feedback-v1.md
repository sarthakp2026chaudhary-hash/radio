# Feedback v1 — Radio App Vision & Immediate Tasks

Date: 2026-05-21

---

## Core Philosophy

This is a **friends interaction app** first, music streaming app second.
Music (audio files) are optional — track metadata, info, and all UI should work without an uploaded MP3.
The listening/social layer must function independently of whether audio is present.

---

## Immediate Priorities

### 1. Music-Agnostic Architecture
- Tracks can exist in the DB without an R2 audio file (`r2_key` can be null)
- UI must gracefully handle no-audio tracks: show metadata, don't crash/break
- Adding artists, albums, tracks, playlists — all should work without uploading any MP3
- The social features (reactions, votes, queue, chat) work regardless of audio state

### 2. Google Drive — Comment Out
- Google Drive integration is redundant now that R2 is the storage layer
- Comment out `src/lib/google-drive/` and `src/app/api/drive/` rather than deleting
- Keep as a dormant fallback option (can be re-enabled if R2 has issues)
- Remove Drive-related UI from admin

### 3. Test Channel: "getFatpls"
- Genre: Motivational
- Song: "Fogwell's Gym" by John Paesano (file: Fogwell's Gym - John Paesano.mp3)
- Schedule: **Tuesday 9 PM**
- Until further notice: **play this song on repeat** (test the sync engine end-to-end)
- This channel proves the app works before seeding full data

---

## Spotify-Style Navigation (Future)

The Spotify folder model the user uses:
- Folders contain playlists (e.g. "Beam me up, jesus." has 5 playlists + 3 folders)
- Double-clicking a folder queues ALL songs across all playlists inside it
- Shuffle across the entire folder's tracks
- This is the mental model for how radio channels + playlists should work

### Features to Add (in order of priority)
1. **Lyrics view** — display lyrics for currently playing track
2. **Queue view** — see what's coming up (priority queue + user queue + playlist order)
3. **Connect to device** — cross-device playback hand-off
4. Folder-style playlist grouping with bulk-queue

---

## Other Repositories to Analyze

*(User to share — compare feature coverage before extended plan)*

---

## Extended Plan

*(To be discussed after test channel is live and seed data is added)*

---

## Seed Data Plan (minimal, user to provide)
- A few channels
- A few songs per channel
- Scheduling per channel
- Will be provided incrementally

---

## Notes
- Vercel deployment: https://radio-one-topaz.vercel.app
- The app is currently live; changes should not break the live deploy
- Supabase project: eyljbqnglfbkbflwpkxv
- R2 bucket: radio-music (APAC region)
