-- Stickers table for ephemeral audio reactions
CREATE TABLE stickers (
  id bigint generated always as identity primary key,
  drive_file_id text unique not null,
  name text not null,           -- "bestest-friend"
  label text not null,          -- "Send Love"
  created_at timestamptz default now()
);

-- Add queue columns to playback_state for "Next Song" feature
ALTER TABLE playback_state ADD COLUMN IF NOT EXISTS queue_track_ids bigint[] DEFAULT '{}';
ALTER TABLE playback_state ADD COLUMN IF NOT EXISTS queue_position integer DEFAULT 0;

-- RLS for stickers
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view stickers" ON stickers
  FOR SELECT USING (true);

CREATE POLICY "Host can manage stickers" ON stickers
  FOR ALL USING ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

-- Index for fast sticker lookup
CREATE INDEX idx_stickers_name ON stickers(name);
