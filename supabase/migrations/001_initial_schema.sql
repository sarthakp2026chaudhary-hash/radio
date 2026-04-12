-- Radio App Database Schema
-- A personal radio station for friends

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
create table users (
  id bigint generated always as identity primary key,
  auth_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  is_host boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one host allowed
create unique index users_single_host on users (is_host) where is_host = true;

-- ============================================================================
-- FRIEND MESSAGES TABLE
-- Personalized welcome messages per friend
-- ============================================================================
create table friend_messages (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  welcome_title text not null,
  welcome_subtitle text not null,
  custom_color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- ============================================================================
-- TRACKS TABLE
-- Metadata about tracks from Google Drive
-- ============================================================================
create table tracks (
  id bigint generated always as identity primary key,
  drive_file_id text unique not null,
  title text not null,
  artist text,
  album text,
  duration_ms bigint not null,
  cover_url text,
  file_size_bytes bigint,
  mime_type text default 'audio/mpeg',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- PLAYBACK STATE TABLE (Singleton)
-- ============================================================================
create table playback_state (
  id bigint generated always as identity primary key,
  current_track_id bigint references tracks(id) on delete set null,
  is_playing boolean default false,
  playback_started_at timestamptz,
  position_at_timestamp bigint default 0,
  queue_track_ids bigint[] default '{}',
  queue_position int default 0,
  volume numeric(3,2) default 1.0 check (volume >= 0 and volume <= 1),
  updated_at timestamptz default now(),
  constraint single_playback_state check (id = 1)
);

-- Initialize singleton row
insert into playback_state (id) overriding system value values (1);

-- ============================================================================
-- POSTS TABLE
-- Notes from the host
-- ============================================================================
create table posts (
  id bigint generated always as identity primary key,
  content text not null,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- RECOMMENDATIONS TABLE
-- Async song drops for friends
-- ============================================================================
create table recommendations (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks(id) on delete cascade,
  message text not null,
  target_user_id bigint references users(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
create table notifications (
  id bigint generated always as identity primary key,
  type text not null check (type in ('online', 'message', 'recommendation')),
  title text not null,
  body text,
  target_user_id bigint references users(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- VISIBILITY RULES TABLE
-- Instagram-style hide from / show only
-- ============================================================================
create table visibility_rules (
  id bigint generated always as identity primary key,
  rule_type text not null check (rule_type in ('hide_from', 'show_only')),
  context text not null,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============================================================================
-- GALLERY ENTRIES TABLE
-- Archive of past shows
-- ============================================================================
create table gallery_entries (
  id bigint generated always as identity primary key,
  title text,
  note text,
  image_url text,
  track_id bigint references tracks(id) on delete set null,
  session_date date not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- DRIVE CREDENTIALS TABLE
-- Host's Google Drive OAuth tokens
-- ============================================================================
create table drive_credentials (
  id bigint generated always as identity primary key,
  user_id bigint unique not null references users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  drive_folder_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index tracks_title_idx on tracks using gin (to_tsvector('english', title));
create index posts_created_at_idx on posts (created_at desc);
create index posts_pinned_idx on posts (is_pinned) where is_pinned = true;
create index recommendations_target_idx on recommendations (target_user_id);
create index recommendations_unread_idx on recommendations (is_read) where is_read = false;
create index notifications_target_idx on notifications (target_user_id);
create index notifications_unread_idx on notifications (is_read) where is_read = false;
create index gallery_date_idx on gallery_entries (session_date desc);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Users
alter table users enable row level security;

create policy "Users are viewable by authenticated users"
  on users for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on users for update
  to authenticated
  using (auth_id = auth.uid());

-- Friend messages
alter table friend_messages enable row level security;

create policy "Friend messages are viewable by authenticated users"
  on friend_messages for select
  to authenticated
  using (true);

create policy "Only host can manage friend messages"
  on friend_messages for all
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Tracks
alter table tracks enable row level security;

create policy "Tracks are viewable by authenticated users"
  on tracks for select
  to authenticated
  using (true);

create policy "Only host can manage tracks"
  on tracks for all
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Playback state
alter table playback_state enable row level security;

create policy "Playback state is viewable by authenticated users"
  on playback_state for select
  to authenticated
  using (true);

create policy "Only host can update playback state"
  on playback_state for update
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Posts
alter table posts enable row level security;

create policy "Posts are viewable by authenticated users"
  on posts for select
  to authenticated
  using (true);

create policy "Only host can manage posts"
  on posts for all
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Recommendations
alter table recommendations enable row level security;

create policy "Recommendations viewable by target or if public"
  on recommendations for select
  to authenticated
  using (
    target_user_id is null or
    target_user_id = (select id from users where auth_id = auth.uid()) or
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

create policy "Only host can create recommendations"
  on recommendations for insert
  to authenticated
  with check (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

create policy "Users can mark own recommendations as read"
  on recommendations for update
  to authenticated
  using (
    target_user_id = (select id from users where auth_id = auth.uid())
  );

-- Notifications
alter table notifications enable row level security;

create policy "Notifications viewable by target or if broadcast"
  on notifications for select
  to authenticated
  using (
    target_user_id is null or
    target_user_id = (select id from users where auth_id = auth.uid()) or
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

create policy "Only host can create notifications"
  on notifications for insert
  to authenticated
  with check (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

create policy "Users can mark own notifications as read"
  on notifications for update
  to authenticated
  using (
    target_user_id = (select id from users where auth_id = auth.uid())
  );

-- Visibility rules
alter table visibility_rules enable row level security;

create policy "Only host can manage visibility rules"
  on visibility_rules for all
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Gallery entries
alter table gallery_entries enable row level security;

create policy "Gallery is viewable by authenticated users"
  on gallery_entries for select
  to authenticated
  using (true);

create policy "Only host can manage gallery"
  on gallery_entries for all
  to authenticated
  using (
    exists (select 1 from users where auth_id = auth.uid() and is_host = true)
  );

-- Drive credentials
alter table drive_credentials enable row level security;

create policy "Only owner can access drive credentials"
  on drive_credentials for all
  to authenticated
  using (
    user_id = (select id from users where auth_id = auth.uid())
  );

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
alter publication supabase_realtime add table playback_state;
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table notifications;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on users
  for each row execute function update_updated_at();

create trigger friend_messages_updated_at before update on friend_messages
  for each row execute function update_updated_at();

create trigger tracks_updated_at before update on tracks
  for each row execute function update_updated_at();

create trigger playback_state_updated_at before update on playback_state
  for each row execute function update_updated_at();

create trigger posts_updated_at before update on posts
  for each row execute function update_updated_at();

create trigger drive_credentials_updated_at before update on drive_credentials
  for each row execute function update_updated_at();
