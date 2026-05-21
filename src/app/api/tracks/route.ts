import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

export async function GET() {
  const supabase = await createClient();
  const { data: tracks, error } = await db.tracks.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: tracks || [] });
}

// Create a track with metadata only (no audio file required).
// Audio can be uploaded later via /api/tracks/upload.
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

  try {
    const body = await request.json();
    const { title, artist_id, album_id, duration_ms, genre, bpm, track_number, cover_url, isrc, spotify_uri, spotify_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data: track, error } = await db.tracks.create(supabase, {
      title: title.trim(),
      artist_id: artist_id ?? null,
      album_id: album_id ?? null,
      duration_ms: duration_ms ?? 0,
      genre: genre ?? null,
      bpm: bpm ?? null,
      track_number: track_number ?? null,
      cover_url: cover_url ?? null,
      isrc: isrc ?? null,
      spotify_uri: spotify_uri ?? null,
      spotify_id: spotify_id ?? null,
      // file_key and file_url intentionally omitted — audio upload is optional
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create track" },
      { status: 500 }
    );
  }
}
