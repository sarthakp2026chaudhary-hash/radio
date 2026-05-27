import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { DEFAULT_TRACK_DURATION_MS } from "@/lib/constants";
import { searchTracks } from "@/lib/search/search-tracks";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 100);

  if (q && q.length >= 2) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAudioParam = request.nextUrl.searchParams.get("has_audio");
    const hasAudio =
      hasAudioParam === "1" || hasAudioParam === "true"
        ? true
        : hasAudioParam === "0" || hasAudioParam === "false"
          ? false
          : undefined;

    const tracks = await searchTracks(supabase, q, { limit, hasAudio });
    return NextResponse.json({ tracks });
  }

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
    const {
      title, artist_id, artists, album_id, duration_ms,
      genre, bpm, track_number, cover_url, isrc, spotify_uri, spotify_id,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Resolve artists: explicit names → find/create; else legacy artist_id; else "Unknown".
    let artistIds: number[] = [];
    if (Array.isArray(artists)) {
      for (const raw of artists) {
        const name = String(raw ?? "").trim();
        if (!name || name.toLowerCase() === "unknown") continue;
        const { id } = await db.artists.findOrCreateByName(supabase, name);
        if (id) artistIds.push(id);
      }
    }
    if (artistIds.length === 0 && artist_id) artistIds = [artist_id];
    if (artistIds.length === 0) {
      const { data: unknown } = await db.artists.getIdBySlug(supabase, "unknown");
      if (unknown?.id) artistIds = [unknown.id];
    }
    const primaryId = artistIds[0] ?? null;

    const { data: track, error } = await db.tracks.create(supabase, {
      title: title.trim(),
      artist_id: primaryId,
      album_id: album_id ?? null,
      duration_ms: duration_ms ?? DEFAULT_TRACK_DURATION_MS,
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

    // Persist full multi-artist credits (primary + featured) on the join table.
    if (track && artistIds.length > 0) {
      await db.trackArtists.setForTrack(
        supabase,
        track.id,
        artistIds.map((aid, i) => ({ artistId: aid, role: i === 0 ? "primary" : "featured", position: i }))
      );
    }

    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create track" },
      { status: 500 }
    );
  }
}
