-- 015_channel_skipped_tracks.sql
-- Per-channel "hide in this queue" (the "−"): track ids the host toggled off.
-- The timer loop/playhead skips these until the host removes them — session-scoped,
-- never a delete. Additive, idempotent.
alter table public.channel_state
  add column if not exists skipped_track_ids bigint[] not null default '{}';
