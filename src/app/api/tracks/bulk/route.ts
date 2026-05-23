import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { DEFAULT_TRACK_DURATION_MS } from "@/lib/constants";

interface BulkSong {
  title: string;
  artists?: string[];
  genre?: string | null;
}

// POST /api/tracks/bulk
// Body: { songs: [{ title, artists?: string[], genre? }], playlist_id?: number }
// Text-first bulk add: create many songs by title (+ optional artist names),
// optionally appending each to a playlist. Artists are find-or-created; a song
// with no artist falls back to the canonical "Unknown" artist (migration 013).
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can add tracks" }, { status: 403 });
  }

  let body: { songs?: BulkSong[]; playlist_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const songs = Array.isArray(body.songs) ? body.songs : [];
  if (songs.length === 0) {
    return NextResponse.json({ error: "songs[] is required" }, { status: 400 });
  }

  const { data: unknownArtist } = await db.artists.getIdBySlug(supabase, "unknown");
  const unknownId = unknownArtist?.id ?? null;

  let position = 0;
  if (body.playlist_id) {
    const { data: maxPos } = await db.playlists.getMaxPosition(supabase, body.playlist_id);
    position = (maxPos?.[0]?.position ?? -1) + 1;
  }

  const created: { id: number; title: string }[] = [];
  const errors: { title: string; error: string }[] = [];

  for (const song of songs) {
    const title = String(song?.title ?? "").trim();
    if (!title) {
      errors.push({ title: String(song?.title ?? ""), error: "missing title" });
      continue;
    }

    const artistIds: number[] = [];
    for (const raw of song.artists ?? []) {
      const name = String(raw ?? "").trim();
      if (!name || name.toLowerCase() === "unknown") continue;
      const { id } = await db.artists.findOrCreateByName(supabase, name);
      if (id) artistIds.push(id);
    }
    if (artistIds.length === 0 && unknownId) artistIds.push(unknownId);
    const primaryId = artistIds[0] ?? null;

    const { data: track, error } = await db.tracks.create(supabase, {
      title,
      artist_id: primaryId,
      duration_ms: DEFAULT_TRACK_DURATION_MS,
      genre: song.genre ?? null,
    });

    if (error || !track) {
      errors.push({ title, error: error?.message || "create failed" });
      continue;
    }

    if (artistIds.length > 0) {
      await db.trackArtists.setForTrack(
        supabase,
        track.id,
        artistIds.map((aid, i) => ({ artistId: aid, role: i === 0 ? "primary" : "featured", position: i }))
      );
    }

    if (body.playlist_id) {
      await db.playlists.addTrack(supabase, body.playlist_id, track.id, position++);
    }

    created.push({ id: track.id, title: track.title });
  }

  return NextResponse.json({ created, errors, count: created.length }, { status: 201 });
}
