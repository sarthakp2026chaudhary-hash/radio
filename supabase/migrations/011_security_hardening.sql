-- Migration 011: Security Hardening & Race Condition Fixes
-- Fixes critical issues identified in migration 010 review
-- IDEMPOTENT: Safe to re-run

-- ============================================
-- PART 1: Fix RLS FOR ALL Policies
-- Drop ALL old AND new policies first to ensure clean slate
-- ============================================

-- Drop old overly permissive policies
DROP POLICY IF EXISTS "Hosts can manage track artists" ON track_artists;
DROP POLICY IF EXISTS "Host listener can update presence" ON host_presence;
DROP POLICY IF EXISTS "Users can manage own library" ON user_library;
DROP POLICY IF EXISTS "Hosts can manage schedules" ON channel_schedules;
DROP POLICY IF EXISTS "System can insert listening history" ON listening_history;

-- Drop new policies if they exist (for re-runs)
DROP POLICY IF EXISTS "Hosts can insert track artists" ON track_artists;
DROP POLICY IF EXISTS "Hosts can update track artists" ON track_artists;
DROP POLICY IF EXISTS "Hosts can delete track artists" ON track_artists;
DROP POLICY IF EXISTS "Host users can insert own presence" ON host_presence;
DROP POLICY IF EXISTS "Host users can update own presence" ON host_presence;
DROP POLICY IF EXISTS "Host users can delete own presence" ON host_presence;
DROP POLICY IF EXISTS "Users can read own library" ON user_library;
DROP POLICY IF EXISTS "Users can insert own library" ON user_library;
DROP POLICY IF EXISTS "Users can update own library" ON user_library;
DROP POLICY IF EXISTS "Users can delete from own library" ON user_library;
DROP POLICY IF EXISTS "Hosts can insert schedules" ON channel_schedules;
DROP POLICY IF EXISTS "Hosts can update schedules" ON channel_schedules;
DROP POLICY IF EXISTS "Hosts can delete schedules" ON channel_schedules;
DROP POLICY IF EXISTS "Users can insert own listening history" ON listening_history;

-- track_artists: Split into explicit policies
CREATE POLICY "Hosts can insert track artists" ON track_artists
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

CREATE POLICY "Hosts can update track artists" ON track_artists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

CREATE POLICY "Hosts can delete track artists" ON track_artists
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

-- host_presence: Split into explicit policies with proper ownership
CREATE POLICY "Host users can insert own presence" ON host_presence
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND (is_host = true OR is_host_listener = true))
  );

CREATE POLICY "Host users can update own presence" ON host_presence
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND (is_host = true OR is_host_listener = true))
  );

CREATE POLICY "Host users can delete own presence" ON host_presence
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND (is_host = true OR is_host_listener = true))
  );

-- user_library: Split into explicit policies with ownership check
CREATE POLICY "Users can read own library" ON user_library
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own library" ON user_library
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own library" ON user_library
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete from own library" ON user_library
  FOR DELETE TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- channel_schedules: Split into explicit policies
CREATE POLICY "Hosts can insert schedules" ON channel_schedules
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

CREATE POLICY "Hosts can update schedules" ON channel_schedules
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

CREATE POLICY "Hosts can delete schedules" ON channel_schedules
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true));

-- listening_history: Fix INSERT policy to restrict to own user_id
CREATE POLICY "Users can insert own listening history" ON listening_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================
-- PART 2: Fix Queue Journal Race Condition
-- Use identity column and epoch timestamp for ordering
-- ============================================

-- Add identity column for guaranteed unique ordering (idempotent)
ALTER TABLE queue_journal ADD COLUMN IF NOT EXISTS
  journal_order bigint GENERATED ALWAYS AS IDENTITY;

-- Add current_track_source to channel_state (idempotent)
ALTER TABLE channel_state ADD COLUMN IF NOT EXISTS
  current_track_source text DEFAULT 'source';

-- Add check constraint separately (handle if already exists)
DO $$
BEGIN
  ALTER TABLE channel_state ADD CONSTRAINT channel_state_track_source_check
    CHECK (current_track_source IN ('source', 'priority', 'user', 'host'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update trigger to use epoch timestamp for position (race-safe)
CREATE OR REPLACE FUNCTION record_queue_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_track_id IS DISTINCT FROM OLD.current_track_id
     AND NEW.current_track_id IS NOT NULL THEN
    INSERT INTO queue_journal (channel_id, track_id, position, added_by)
    VALUES (
      NEW.channel_id,
      NEW.current_track_id,
      EXTRACT(EPOCH FROM now())::bigint,
      COALESCE(NEW.current_track_source, 'source')
    )
    ON CONFLICT (channel_id, session_date, position) DO UPDATE SET
      track_id = EXCLUDED.track_id,
      played_at = now(),
      added_by = EXCLUDED.added_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: Fix Realtime Publication Idempotency
-- ============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE host_presence;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE queue_journal;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PART 4: Update track_artists Unique Constraint
-- Allow same artist with multiple roles (producer AND featured)
-- ============================================

-- Drop old constraint and add new one including role (idempotent)
ALTER TABLE track_artists DROP CONSTRAINT IF EXISTS track_artists_track_id_artist_id_key;
ALTER TABLE track_artists DROP CONSTRAINT IF EXISTS track_artists_unique_with_role;
ALTER TABLE track_artists ADD CONSTRAINT track_artists_unique_with_role
  UNIQUE (track_id, artist_id, role);

-- Add credit_name for display flexibility
ALTER TABLE track_artists ADD COLUMN IF NOT EXISTS
  credit_name text;

-- Add is_main flag to distinguish main vs credited artists
ALTER TABLE track_artists ADD COLUMN IF NOT EXISTS
  is_main boolean DEFAULT true;

-- ============================================
-- PART 5: Performance Indexes
-- ============================================

-- Index for queue_journal ordering by journal_order
CREATE INDEX IF NOT EXISTS idx_queue_journal_order
  ON queue_journal(channel_id, session_date, journal_order);

-- Index for channel_state source lookups
CREATE INDEX IF NOT EXISTS idx_channel_state_source
  ON channel_state(current_track_source) WHERE current_track_source IS NOT NULL;
