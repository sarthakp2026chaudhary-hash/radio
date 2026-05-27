-- Channel-scoped song requests/votes (replaces legacy folder-based track_votes for channels)

CREATE TABLE IF NOT EXISTS channel_track_votes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  track_id bigint NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (channel_id, track_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_track_votes_channel ON channel_track_votes(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_track_votes_track ON channel_track_votes(track_id);

ALTER TABLE channel_track_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own channel votes"
  ON channel_track_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own channel votes"
  ON channel_track_votes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Authenticated users can view channel votes"
  ON channel_track_votes FOR SELECT
  TO authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE channel_track_votes;
