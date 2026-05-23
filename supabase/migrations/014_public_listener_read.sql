-- 014_public_listener_read.sql
-- Channels are public, shareable links: a logged-out visitor can view a channel's
-- minimal loop (count / updated-at / next song) without logging in.
-- channels + channel_state are already anon-readable; this opens read on the
-- track-side tables the loop view needs. Song metadata (titles) is low-sensitivity
-- and consistent with `artists` already being publicly viewable.
-- (Scope note: this is a broad public read of track metadata, not scoped to public
--  channels only — chosen for simplicity; can be tightened later if needed.)

drop policy if exists "Anyone can view tracks" on public.tracks;
create policy "Anyone can view tracks" on public.tracks for select using (true);

drop policy if exists "Anyone can view playlist_tracks" on public.playlist_tracks;
create policy "Anyone can view playlist_tracks" on public.playlist_tracks for select using (true);

drop policy if exists "Anyone can view track_artists" on public.track_artists;
create policy "Anyone can view track_artists" on public.track_artists for select using (true);
