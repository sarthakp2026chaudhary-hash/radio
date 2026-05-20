import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseInt(id);

  if (isNaN(trackId)) {
    return NextResponse.json({ error: "Invalid track ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: track, error } = await db.tracks.get(supabase, trackId);

  if (error || !track) {
    return NextResponse.json({ error: error?.message || "Track not found" }, { status: 404 });
  }

  return NextResponse.json({ track });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseInt(id);

  if (isNaN(trackId)) {
    return NextResponse.json({ error: "Invalid track ID" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can update tracks" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.artist_id !== undefined) updates.artist_id = body.artist_id;
  if (body.album_id !== undefined) updates.album_id = body.album_id;
  if (body.genre !== undefined) updates.genre = body.genre;
  if (body.bpm !== undefined) updates.bpm = body.bpm;
  if (body.track_number !== undefined) updates.track_number = body.track_number;

  const { data: track, error } = await db.tracks.update(supabase, trackId, updates);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ track });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseInt(id);

  if (isNaN(trackId)) {
    return NextResponse.json({ error: "Invalid track ID" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can delete tracks" }, { status: 403 });
  }

  const { error } = await db.tracks.delete(supabase, trackId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
