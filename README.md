# Radio - Real-time Music Broadcasting

A private radio app where one host broadcasts music to friends in real-time. Listeners stay perfectly synced and can react with audio stickers and vote for upcoming songs.

## Features

- Real-time audio sync between host and listeners
- Google Drive integration for music library
- Voting system for song recommendations  
- Sticker reactions (ephemeral, real-time)
- Personal listening history for each user
- Host dashboard with playback controls

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Storage:** Google Drive API for music files

## Local Development

1. Clone the repo:
```bash
git clone https://github.com/sarthakp2026chaudhary-hash/radio.git
cd radio
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your `.env.local` with actual values (see Environment Variables below)

5. Run the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Set these in Vercel Dashboard > Settings > Environment Variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., `https://your-app.vercel.app`) |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |

## Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/new)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard
5. Deploy!

**Important:** Update `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL after first deploy.

### Google OAuth Setup for Production

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Add your Vercel domain to authorized JavaScript origins
3. Add `https://your-app.vercel.app/api/drive/callback` to authorized redirect URIs

## Database Migrations

Run migrations on your Supabase instance:
```bash
supabase db push
```

Or manually execute the SQL files in `supabase/migrations/` in order.

## License

Private project.
