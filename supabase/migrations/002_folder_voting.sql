-- Migration: Add folder-based voting system
-- Tracks which folder songs belong to, and allows friends to upvote next song

-- Add folder_id to tracks (Google Drive folder ID)
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS folder_id text;

-- Add current_folder_id to playback_state
ALTER TABLE playback_state ADD COLUMN IF NOT EXISTS current_folder_id text;

-- Create votes table
CREATE TABLE IF NOT EXISTS track_votes (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  folder_id text not null,
  created_at timestamptz default now(),
  UNIQUE(track_id, user_id, folder_id)
);

-- Index for fast vote queries by folder
CREATE INDEX IF NOT EXISTS idx_track_votes_folder ON track_votes(folder_id);
CREATE INDEX IF NOT EXISTS idx_track_votes_track ON track_votes(track_id);

-- Enable RLS
ALTER TABLE track_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert own votes"
  ON track_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own votes"
  ON track_votes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "All users can view votes"
  ON track_votes FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime for votes table
ALTER PUBLICATION supabase_realtime ADD TABLE track_votes;
