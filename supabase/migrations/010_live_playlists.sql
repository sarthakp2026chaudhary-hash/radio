-- Migration 010: Live Playlists Feature Set
-- Phase 1: Multi-Artist, Live Broadcasting, Queue Journal, Listening Stats

-- ============================================
-- PART 1: Multi-Artist Support
-- ============================================

-- Junction table for tracks with multiple artists
CREATE TABLE IF NOT EXISTS track_artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  track_id bigint NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id bigint NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'featured', 'producer', 'remixer')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(track_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_track_artists_track ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id);

-- Migrate existing artist_id relationships to junction table
INSERT INTO track_artists (track_id, artist_id, role, position)
SELECT id, artist_id, 'primary', 0
FROM tracks
WHERE artist_id IS NOT NULL
ON CONFLICT (track_id, artist_id) DO NOTHING;

-- ============================================
-- PART 2: User Account Types
-- ============================================

-- Add is_host_listener to identify the listening account (separate from orchestrator)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_host_listener boolean DEFAULT false;

-- Only one host listener allowed
CREATE UNIQUE INDEX IF NOT EXISTS users_single_host_listener
  ON users (is_host_listener) WHERE is_host_listener = true;

-- ============================================
-- PART 3: Live Broadcasting / Host Presence
-- ============================================

-- Track which channel the host listener is actively on
CREATE TABLE IF NOT EXISTS host_presence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id bigint REFERENCES channels(id) ON DELETE SET NULL,
  is_listening boolean DEFAULT false,
  last_heartbeat timestamptz DEFAULT now(),
  session_started_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_host_presence_channel
  ON host_presence(channel_id) WHERE is_listening = true;

-- Add broadcast mode to channel state
ALTER TABLE channel_state ADD COLUMN IF NOT EXISTS
  broadcast_mode text DEFAULT 'automated' CHECK (broadcast_mode IN ('automated', 'live'));
ALTER TABLE channel_state ADD COLUMN IF NOT EXISTS
  live_host_user_id bigint REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE channel_state ADD COLUMN IF NOT EXISTS
  live_started_at timestamptz;

-- Add status and ownership to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived'));
ALTER TABLE channels ADD COLUMN IF NOT EXISTS
  for_user_id bigint REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS
  archived_as_playlist_id bigint REFERENCES playlists(id) ON DELETE SET NULL;

-- Add created_by to playlists for tracking who created them
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS
  created_by bigint REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- PART 4: Queue Journal
-- ============================================

-- Log what was played per channel per day
CREATE TABLE IF NOT EXISTS queue_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  track_id bigint NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position integer NOT NULL,
  played_at timestamptz DEFAULT now(),
  added_by text DEFAULT 'source' CHECK (added_by IN ('source', 'priority', 'user', 'host')),
  UNIQUE(channel_id, session_date, position)
);

CREATE INDEX IF NOT EXISTS idx_queue_journal_channel_date
  ON queue_journal(channel_id, session_date);

-- Trigger to auto-record journal entries when track changes
CREATE OR REPLACE FUNCTION record_queue_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_track_id IS DISTINCT FROM OLD.current_track_id
     AND NEW.current_track_id IS NOT NULL THEN
    INSERT INTO queue_journal (channel_id, track_id, position, added_by)
    SELECT
      NEW.channel_id,
      NEW.current_track_id,
      COALESCE(
        (SELECT MAX(position) + 1 FROM queue_journal
         WHERE channel_id = NEW.channel_id AND session_date = CURRENT_DATE),
        1
      ),
      CASE
        WHEN array_length(OLD.priority_queue, 1) > 0 THEN 'priority'
        WHEN array_length(OLD.user_queue, 1) > 0 THEN 'user'
        ELSE 'source'
      END
    ON CONFLICT (channel_id, session_date, position) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS channel_state_journal_trigger ON channel_state;
CREATE TRIGGER channel_state_journal_trigger
  AFTER UPDATE ON channel_state
  FOR EACH ROW
  EXECUTE FUNCTION record_queue_journal();

-- ============================================
-- PART 5: Listening History & Play Counts
-- ============================================

-- Detailed listening history
CREATE TABLE IF NOT EXISTS listening_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id bigint NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  channel_id bigint REFERENCES channels(id) ON DELETE SET NULL,
  played_at timestamptz DEFAULT now(),
  duration_listened_ms bigint DEFAULT 0,
  completed boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_listening_history_user ON listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_track ON listening_history(track_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_played_at ON listening_history(played_at DESC);

-- Aggregated play counts (materialized for performance)
CREATE TABLE IF NOT EXISTS track_play_counts (
  track_id bigint PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  total_plays bigint DEFAULT 0,
  host_plays bigint DEFAULT 0,
  last_played_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Trigger to update play counts
CREATE OR REPLACE FUNCTION update_track_play_count()
RETURNS TRIGGER AS $$
DECLARE
  v_is_host_listener boolean;
BEGIN
  -- Check if this user is the host listener
  SELECT is_host_listener INTO v_is_host_listener
  FROM users WHERE id = NEW.user_id;

  INSERT INTO track_play_counts (track_id, total_plays, host_plays, last_played_at)
  VALUES (NEW.track_id, 1, CASE WHEN v_is_host_listener THEN 1 ELSE 0 END, now())
  ON CONFLICT (track_id) DO UPDATE SET
    total_plays = track_play_counts.total_plays + 1,
    host_plays = track_play_counts.host_plays + CASE WHEN v_is_host_listener THEN 1 ELSE 0 END,
    last_played_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listening_history_count_trigger ON listening_history;
CREATE TRIGGER listening_history_count_trigger
  AFTER INSERT ON listening_history
  FOR EACH ROW
  EXECUTE FUNCTION update_track_play_count();

-- ============================================
-- PART 6: User Library (Friends' Saved Tracks)
-- ============================================

CREATE TABLE IF NOT EXISTS user_library (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id bigint NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  source_channel_id bigint REFERENCES channels(id) ON DELETE SET NULL,
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);

-- ============================================
-- PART 7: Channel Schedules
-- ============================================

CREATE TABLE IF NOT EXISTS channel_schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id bigint NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  playlist_id bigint REFERENCES playlists(id) ON DELETE SET NULL,
  day_of_week smallint CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_channel_schedules_channel ON channel_schedules(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_schedules_active
  ON channel_schedules(is_active) WHERE is_active = true;

-- ============================================
-- PART 8: Realtime Subscriptions
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE host_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_journal;

-- ============================================
-- PART 9: RLS Policies
-- ============================================

-- track_artists: Anyone can read, hosts can manage
ALTER TABLE track_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read track artists" ON track_artists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hosts can manage track artists" ON track_artists
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

-- host_presence: Anyone can read, host listener can update own
ALTER TABLE host_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read host presence" ON host_presence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Host listener can update presence" ON host_presence
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND (is_host = true OR is_host_listener = true)
  ));

-- queue_journal: Anyone can read, system inserts via trigger
ALTER TABLE queue_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read queue journal" ON queue_journal
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert journal" ON queue_journal
  FOR INSERT TO authenticated WITH CHECK (true);

-- listening_history: Users can read own, system inserts
ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own listening history" ON listening_history
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "System can insert listening history" ON listening_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- track_play_counts: Anyone can read
ALTER TABLE track_play_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read play counts" ON track_play_counts
  FOR SELECT TO authenticated USING (true);

-- user_library: Users manage own library
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own library" ON user_library
  FOR ALL TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- channel_schedules: Anyone can read, hosts can manage
ALTER TABLE channel_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedules" ON channel_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hosts can manage schedules" ON channel_schedules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));
