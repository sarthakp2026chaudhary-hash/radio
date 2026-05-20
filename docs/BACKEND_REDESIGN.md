# Backend Redesign: Spotify-like Music System

## What's Been Built

### 1. Database Schema (Migration 007)

New tables for a proper music catalog:

```
artists          → name, slug, bio, image_url
    ↓
albums           → title, year, cover_url (belongs to artist)
    ↓
tracks           → title, duration, genre, bpm, file_url (belongs to artist + album)
    ↓
playlists        → name, description, cover_url
playlist_tracks  → playlist_id, track_id, position (ordering)
    ↓
channels         → name, slug, description (radio stations)
channel_state    → playback state per channel (track, position, queue, shuffle, repeat)
```

### 2. R2 Storage Integration

- **Location**: `src/lib/r2/index.ts`
- **Features**: Upload, delete, signed URLs, public URLs
- **File structure**: `music/{artist-slug}/{timestamp}-{filename}.mp3`

### 3. API Routes

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/artists` | GET, POST | List/create artists |
| `/api/artists/[id]` | GET, PATCH, DELETE | Artist CRUD |
| `/api/tracks/upload` | POST | Upload track with metadata extraction |
| `/api/playlists` | GET, POST | List/create playlists |
| `/api/playlists/[id]` | GET, PATCH, DELETE | Playlist CRUD |
| `/api/playlists/[id]/tracks` | POST, PATCH, DELETE | Add/reorder/remove tracks |
| `/api/channels` | GET, POST | List/create channels |
| `/api/channels/[slug]` | GET, PATCH, DELETE | Channel CRUD |
| `/api/channels/[slug]/playback` | GET, POST | Playback control |

### 4. Playback Actions

The `/api/channels/[slug]/playback` endpoint supports:

- `play` / `pause` - Resume/pause playback
- `play_track` - Play specific track immediately
- `play_playlist` - Start playing from playlist
- `play_next` - Add track to priority queue (Spotify's "Play Next")
- `add_to_queue` - Add track to user queue (Spotify's "Add to Queue")
- `skip` - Skip to next track
- `seek` - Seek to position
- `shuffle` - Toggle shuffle mode
- `repeat` - Cycle repeat mode (off → all → one)
- `clear_queue` - Clear both queues

---

## Setup Required

### 1. Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create bucket named `radio-music`
3. Enable public access (Settings → Public Access → Allow)
4. Create API token (R2 → Manage R2 API Tokens → Create)
5. Copy your Account ID from the dashboard URL

### 2. Environment Variables

Add to `.env.local`:

```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=radio-music
R2_PUBLIC_URL=https://pub-xxx.r2.dev  # or custom domain
```

### 3. Run Migration

```bash
# Link to your Supabase project (if not already)
npx supabase link --project-ref eyljbqnglfbkbflwpkxv

# Push the new migration
npx supabase db push
```

---

## Usage Flow

### As Admin (You)

1. **Create Artist**
   ```bash
   POST /api/artists
   { "name": "Artist Name", "bio": "Optional bio" }
   ```

2. **Upload Track**
   ```bash
   POST /api/tracks/upload
   FormData: file (MP3), artist_id, album_id (optional), title (optional)
   ```
   - Metadata extracted automatically from MP3 tags
   - File uploaded to R2

3. **Create Playlist**
   ```bash
   POST /api/playlists
   { "name": "Chill Vibes" }
   ```

4. **Add Tracks to Playlist**
   ```bash
   POST /api/playlists/[id]/tracks
   { "track_id": 1 }
   ```

5. **Create Channel**
   ```bash
   POST /api/channels
   { "name": "Late Night Radio" }
   ```

6. **Start Playing**
   ```bash
   POST /api/channels/late-night-radio/playback
   { "action": "play_playlist", "playlist_id": 1 }
   ```

### Queue Management (Spotify-style)

```bash
# Play this track next (after current song)
{ "action": "play_next", "track_id": 5 }

# Add to end of queue
{ "action": "add_to_queue", "track_id": 6 }

# Play order: Current → Priority Queue → User Queue → Playlist
```

---

## What's Next

### Phase 2: Admin UI

- [ ] Artist management page
- [ ] Drag-drop track upload
- [ ] Playlist builder with drag-drop ordering
- [ ] Channel creation/management
- [ ] Playback controls with queue visualization

### Phase 3: Listener Experience

- [ ] Channel selector (tune into different stations)
- [ ] Now playing with album art
- [ ] Real-time sync per channel
- [ ] Reactions/presence per channel

---

## Cost Estimate

| Service | Monthly |
|---------|---------|
| Cloudflare R2 (50GB) | ~$0.75 |
| Supabase (Free tier) | $0 |
| **Total** | **<$1/month** |
