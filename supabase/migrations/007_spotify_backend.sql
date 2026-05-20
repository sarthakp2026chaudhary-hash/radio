-- Migration: Spotify-like backend with artists, albums, playlists, channels
-- Replaces Google Drive with Cloudflare R2 storage

-- ============================================================================
-- ARTISTS
-- ============================================================================
create table artists (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  bio text,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index artists_slug_idx on artists (slug);
create index artists_name_idx on artists using gin (to_tsvector('english', name));

alter table artists enable row level security;

create policy "Anyone can view artists"
  on artists for select
  using (true);

create policy "Only host can manage artists"
  on artists for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- ============================================================================
-- ALBUMS
-- ============================================================================
create table albums (
  id bigint generated always as identity primary key,
  title text not null,
  artist_id bigint references artists(id) on delete cascade,
  year smallint,
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index albums_artist_idx on albums (artist_id);
create index albums_title_idx on albums using gin (to_tsvector('english', title));

alter table albums enable row level security;

create policy "Anyone can view albums"
  on albums for select
  using (true);

create policy "Only host can manage albums"
  on albums for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- ============================================================================
-- TRACKS - Add new columns for R2 storage and proper relations
-- ============================================================================
-- Add artist/album foreign keys
alter table tracks add column if not exists artist_id bigint references artists(id) on delete set null;
alter table tracks add column if not exists album_id bigint references albums(id) on delete set null;

-- R2 storage columns (replacing drive_file_id)
alter table tracks add column if not exists file_key text; -- R2 object key: "music/artist-slug/filename.mp3"
alter table tracks add column if not exists file_url text; -- Full R2 public URL

-- Additional metadata
alter table tracks add column if not exists genre text;
alter table tracks add column if not exists bpm smallint;
alter table tracks add column if not exists track_number smallint;

-- Make drive_file_id nullable (for transition period)
alter table tracks alter column drive_file_id drop not null;

create index tracks_artist_idx on tracks (artist_id);
create index tracks_album_idx on tracks (album_id);
create index tracks_genre_idx on tracks (genre);

-- ============================================================================
-- PLAYLISTS
-- ============================================================================
create table playlists (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  cover_url text,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index playlists_name_idx on playlists using gin (to_tsvector('english', name));

alter table playlists enable row level security;

create policy "Anyone can view public playlists"
  on playlists for select
  using (is_public = true);

create policy "Only host can manage playlists"
  on playlists for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- ============================================================================
-- PLAYLIST TRACKS (junction table with ordering)
-- ============================================================================
create table playlist_tracks (
  id bigint generated always as identity primary key,
  playlist_id bigint not null references playlists(id) on delete cascade,
  track_id bigint not null references tracks(id) on delete cascade,
  position integer not null,
  added_at timestamptz default now(),

  unique(playlist_id, track_id)
);

create index playlist_tracks_playlist_idx on playlist_tracks (playlist_id);
create index playlist_tracks_position_idx on playlist_tracks (playlist_id, position);

alter table playlist_tracks enable row level security;

create policy "Anyone can view playlist tracks"
  on playlist_tracks for select
  using (true);

create policy "Only host can manage playlist tracks"
  on playlist_tracks for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- ============================================================================
-- CHANNELS (radio stations)
-- ============================================================================
create table channels (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  description text,
  cover_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index channels_slug_idx on channels (slug);
create index channels_active_idx on channels (is_active) where is_active = true;

alter table channels enable row level security;

create policy "Anyone can view active channels"
  on channels for select
  using (is_active = true);

create policy "Only host can manage channels"
  on channels for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- ============================================================================
-- CHANNEL STATE (playback state per channel)
-- ============================================================================
create table channel_state (
  id bigint generated always as identity primary key,
  channel_id bigint unique not null references channels(id) on delete cascade,

  -- Current playback
  current_track_id bigint references tracks(id) on delete set null,
  is_playing boolean default false,
  playback_started_at timestamptz,
  position_ms bigint default 0,

  -- Source (what we're playing from)
  source_type text check (source_type in ('playlist', 'album', 'artist', 'queue')),
  source_id bigint, -- playlist_id, album_id, or artist_id depending on source_type
  source_position integer default 0, -- position in the source

  -- Queue (tracks added manually via "play next" or "add to queue")
  priority_queue bigint[] default '{}', -- "Play Next" - plays immediately after current
  user_queue bigint[] default '{}',     -- "Add to Queue" - plays after priority queue

  -- Playback settings
  shuffle_enabled boolean default false,
  shuffle_order bigint[] default '{}',  -- Pre-shuffled track order for consistent shuffle
  repeat_mode text default 'off' check (repeat_mode in ('off', 'all', 'one')),

  -- UI state
  color_scheme text default 'ember',

  updated_at timestamptz default now()
);

create index channel_state_channel_idx on channel_state (channel_id);

alter table channel_state enable row level security;

create policy "Anyone can view channel state"
  on channel_state for select
  using (true);

create policy "Only host can update channel state"
  on channel_state for update
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.is_host = true
    )
  );

-- Enable realtime for channel state
alter publication supabase_realtime add table channel_state;

-- ============================================================================
-- CHANNEL LISTENERS (for presence/count)
-- ============================================================================
create table channel_listeners (
  id bigint generated always as identity primary key,
  channel_id bigint not null references channels(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  joined_at timestamptz default now(),
  last_heartbeat timestamptz default now(),

  unique(channel_id, user_id)
);

create index channel_listeners_channel_idx on channel_listeners (channel_id);
create index channel_listeners_heartbeat_idx on channel_listeners (last_heartbeat);

alter table channel_listeners enable row level security;

create policy "Anyone can view listeners"
  on channel_listeners for select
  using (true);

create policy "Users can manage their own presence"
  on channel_listeners for all
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
      and users.id = channel_listeners.user_id
    )
  );

-- ============================================================================
-- DEFAULT COVER IMAGE
-- ============================================================================
-- Store a default cover URL that can be used when no cover is uploaded
insert into playlists (name, description, is_public)
values ('__defaults__', 'System defaults storage', false)
on conflict do nothing;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get next track in queue/playlist
create or replace function get_next_track(p_channel_id bigint)
returns bigint as $$
declare
  v_state channel_state%rowtype;
  v_next_track_id bigint;
  v_source_tracks bigint[];
  v_next_position integer;
begin
  select * into v_state from channel_state where channel_id = p_channel_id;

  if not found then
    return null;
  end if;

  -- 1. Check priority queue first
  if array_length(v_state.priority_queue, 1) > 0 then
    return v_state.priority_queue[1];
  end if;

  -- 2. Check user queue
  if array_length(v_state.user_queue, 1) > 0 then
    return v_state.user_queue[1];
  end if;

  -- 3. Get from source (playlist/album)
  if v_state.source_type = 'playlist' then
    if v_state.shuffle_enabled and array_length(v_state.shuffle_order, 1) > 0 then
      v_next_position := v_state.source_position + 1;
      if v_next_position <= array_length(v_state.shuffle_order, 1) then
        return v_state.shuffle_order[v_next_position];
      elsif v_state.repeat_mode = 'all' then
        return v_state.shuffle_order[1];
      end if;
    else
      select track_id into v_next_track_id
      from playlist_tracks
      where playlist_id = v_state.source_id
        and position = v_state.source_position + 1;

      if v_next_track_id is not null then
        return v_next_track_id;
      elsif v_state.repeat_mode = 'all' then
        select track_id into v_next_track_id
        from playlist_tracks
        where playlist_id = v_state.source_id
        order by position
        limit 1;
        return v_next_track_id;
      end if;
    end if;
  elsif v_state.source_type = 'album' then
    select id into v_next_track_id
    from tracks
    where album_id = v_state.source_id
      and track_number = (
        select track_number + 1 from tracks where id = v_state.current_track_id
      );
    return v_next_track_id;
  end if;

  return null;
end;
$$ language plpgsql;

-- Function to advance to next track
create or replace function advance_channel_track(p_channel_id bigint)
returns void as $$
declare
  v_state channel_state%rowtype;
  v_next_track_id bigint;
begin
  select * into v_state from channel_state where channel_id = p_channel_id for update;

  if not found then
    return;
  end if;

  -- Handle repeat one
  if v_state.repeat_mode = 'one' then
    update channel_state
    set position_ms = 0,
        playback_started_at = now(),
        updated_at = now()
    where channel_id = p_channel_id;
    return;
  end if;

  v_next_track_id := get_next_track(p_channel_id);

  if v_next_track_id is null then
    -- No more tracks, stop playing
    update channel_state
    set is_playing = false,
        updated_at = now()
    where channel_id = p_channel_id;
    return;
  end if;

  -- Pop from appropriate queue and update state
  if array_length(v_state.priority_queue, 1) > 0 then
    update channel_state
    set current_track_id = v_next_track_id,
        priority_queue = v_state.priority_queue[2:],
        position_ms = 0,
        playback_started_at = now(),
        updated_at = now()
    where channel_id = p_channel_id;
  elsif array_length(v_state.user_queue, 1) > 0 then
    update channel_state
    set current_track_id = v_next_track_id,
        user_queue = v_state.user_queue[2:],
        position_ms = 0,
        playback_started_at = now(),
        updated_at = now()
    where channel_id = p_channel_id;
  else
    update channel_state
    set current_track_id = v_next_track_id,
        source_position = v_state.source_position + 1,
        position_ms = 0,
        playback_started_at = now(),
        updated_at = now()
    where channel_id = p_channel_id;
  end if;
end;
$$ language plpgsql;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger artists_updated_at before update on artists
  for each row execute function update_updated_at();

create trigger albums_updated_at before update on albums
  for each row execute function update_updated_at();

create trigger playlists_updated_at before update on playlists
  for each row execute function update_updated_at();

create trigger channels_updated_at before update on channels
  for each row execute function update_updated_at();

create trigger channel_state_updated_at before update on channel_state
  for each row execute function update_updated_at();
