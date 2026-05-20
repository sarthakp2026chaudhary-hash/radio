-- Add public/private visibility to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true NOT NULL;

-- Channel membership for private channels
CREATE TABLE IF NOT EXISTS channel_members (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'listener' CHECK (role IN ('listener', 'moderator')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- RLS policies
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Hosts can manage all memberships
CREATE POLICY "Hosts can manage channel members"
  ON channel_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_host = true)
  );

-- Users can see their own memberships
CREATE POLICY "Users can view own memberships"
  ON channel_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Moderators can add listeners to their channels
CREATE POLICY "Moderators can add listeners"
  ON channel_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
    )
    AND role = 'listener'
  );

-- Function to check channel access
CREATE OR REPLACE FUNCTION can_access_channel(p_channel_id integer, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_public boolean;
  v_is_host boolean;
  v_is_member boolean;
BEGIN
  -- Check if channel is public
  SELECT is_public INTO v_is_public FROM channels WHERE id = p_channel_id;
  IF v_is_public THEN
    RETURN true;
  END IF;

  -- Check if user is a host
  SELECT EXISTS (SELECT 1 FROM users WHERE auth_id = p_user_id AND is_host = true) INTO v_is_host;
  IF v_is_host THEN
    RETURN true;
  END IF;

  -- Check if user is a member
  SELECT EXISTS (
    SELECT 1 FROM channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  ) INTO v_is_member;

  RETURN v_is_member;
END;
$$;
