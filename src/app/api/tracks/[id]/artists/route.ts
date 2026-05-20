import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { requireHost, parseIdParam, notFound, serverError } from "@/lib/api/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseIdParam(id);
  if (!trackId) return notFound("Invalid track ID");

  const supabase = await createClient();
  const { data: artists, error } = await db.trackArtists.list(supabase, trackId);

  if (error) return serverError(error);

  return NextResponse.json({ artists });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseIdParam(id);
  if (!trackId) return notFound("Invalid track ID");

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { artist_id, role = "primary" } = body;

  if (!artist_id) {
    return NextResponse.json({ error: "artist_id required" }, { status: 400 });
  }

  const { data: existing } = await db.trackArtists.list(auth.supabase, trackId);
  const position = existing?.length || 0;

  const { data: trackArtist, error } = await db.trackArtists.add(auth.supabase, {
    track_id: trackId,
    artist_id,
    role,
    position,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Artist already added to this track" }, { status: 409 });
    }
    return serverError(error);
  }

  return NextResponse.json({ track_artist: trackArtist }, { status: 201 });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseIdParam(id);
  if (!trackId) return notFound("Invalid track ID");

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { artists } = body;

  if (!Array.isArray(artists)) {
    return NextResponse.json({ error: "artists array required" }, { status: 400 });
  }

  const formatted = artists.map((a: { artist_id: number; role?: string }, index: number) => ({
    artistId: a.artist_id,
    role: (a.role || "primary") as "primary" | "featured" | "producer" | "remixer",
    position: index,
  }));

  const { error } = await db.trackArtists.setForTrack(auth.supabase, trackId, formatted);

  if (error) return serverError(error);

  const { data: updated } = await db.trackArtists.list(auth.supabase, trackId);

  return NextResponse.json({ artists: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseIdParam(id);
  if (!trackId) return notFound("Invalid track ID");

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const artistId = parseIdParam(searchParams.get("artist_id") || "");

  if (!artistId) {
    return NextResponse.json({ error: "artist_id required" }, { status: 400 });
  }

  const { error } = await db.trackArtists.remove(auth.supabase, trackId, artistId);

  if (error) return serverError(error);

  return NextResponse.json({ success: true });
}
