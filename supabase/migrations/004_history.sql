-- History Feature: Track broadcast attendance, song of the day, and daily posts

-- 1. Track when users join broadcast each day
CREATE TABLE broadcast_attendance (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  session_date date not null default current_date,
  joined_at timestamptz default now(),
  UNIQUE(user_id, session_date)
);

-- 2. Song of the Day (auto-captured, last song played each day)
CREATE TABLE song_of_day (
  id bigint generated always as identity primary key,
  session_date date not null unique,
  track_id bigint not null references tracks(id) on delete cascade,
  captured_at timestamptz default now()
);

-- 3. Host's daily posts (quote + image)
CREATE TABLE daily_posts (
  id bigint generated always as identity primary key,
  session_date date not null unique,
  quote text default 'if ya nasty',
  image_url text,  -- null = use default app logo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for fast queries
CREATE INDEX idx_attendance_user ON broadcast_attendance(user_id);
CREATE INDEX idx_attendance_date ON broadcast_attendance(session_date);
CREATE INDEX idx_song_of_day_date ON song_of_day(session_date);
CREATE INDEX idx_daily_posts_date ON daily_posts(session_date);

-- Enable RLS
ALTER TABLE broadcast_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_of_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_posts ENABLE ROW LEVEL SECURITY;

-- Attendance: users can see and insert their own
CREATE POLICY "Users see own attendance" ON broadcast_attendance
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own attendance" ON broadcast_attendance
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Song of day: all authenticated users can view
CREATE POLICY "All can view song of day" ON song_of_day
  FOR SELECT TO authenticated
  USING (true);

-- Song of day: host can insert/update/delete
CREATE POLICY "Host can insert song of day" ON song_of_day
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Host can update song of day" ON song_of_day
  FOR UPDATE TO authenticated
  USING ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Host can delete song of day" ON song_of_day
  FOR DELETE TO authenticated
  USING ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

-- Daily posts: all authenticated users can view
CREATE POLICY "All can view daily posts" ON daily_posts
  FOR SELECT TO authenticated
  USING (true);

-- Daily posts: host can insert/update/delete
CREATE POLICY "Host can insert daily posts" ON daily_posts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Host can update daily posts" ON daily_posts
  FOR UPDATE TO authenticated
  USING ((SELECT is_host FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Host can delete daily posts" ON daily_posts
  FOR DELETE TO authenticated
  USING ((SELECT is_host FROM users WHERE auth_id = auth.uid()));
