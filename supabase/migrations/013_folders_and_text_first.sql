-- 013_folders_and_text_first.sql
-- Text-first DJ foundation:
--   1. Nestable folders that group playlists (genre/vibe organization, the "brain")
--   2. playlists.folder_id link
--   3. Canonical "Unknown" artist for songs with no/Unknown artist
-- Additive and idempotent. No destructive changes.

-- 1. Nestable folders ---------------------------------------------------------
create table if not exists public.folders (
  id          bigint generated always as identity primary key,
  name        text   not null,
  parent_id   bigint references public.folders(id) on delete cascade,
  position    integer not null default 0,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_folders_parent on public.folders(parent_id);

-- 2. Link playlists to a folder (nullable; a playlist may be loose) ------------
alter table public.playlists
  add column if not exists folder_id bigint references public.folders(id) on delete set null;
create index if not exists idx_playlists_folder on public.playlists(folder_id);

-- 3. RLS for folders (mirror playlists: viewable by all, only host manages) ----
alter table public.folders enable row level security;

drop policy if exists "Anyone can view folders" on public.folders;
create policy "Anyone can view folders"
  on public.folders for select
  using (true);

drop policy if exists "Only host can manage folders" on public.folders;
create policy "Only host can manage folders"
  on public.folders for all
  using (exists (select 1 from public.users
                 where users.auth_id = auth.uid() and users.is_host = true))
  with check (exists (select 1 from public.users
                      where users.auth_id = auth.uid() and users.is_host = true));

-- 4. updated_at trigger (reuse existing helper) -------------------------------
drop trigger if exists folders_updated_at on public.folders;
create trigger folders_updated_at
  before update on public.folders
  for each row execute function public.update_updated_at();

-- 5. Canonical "Unknown" artist (text-first fallback) -------------------------
insert into public.artists (name, slug)
values ('Unknown', 'unknown')
on conflict (slug) do nothing;
