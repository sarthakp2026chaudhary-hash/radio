import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: playlistId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can modify playlists" }, { status: 403 });
  }

  const body = await request.json();
  const { track_id, position } = body;

  if (!track_id) {
    return NextResponse.json({ error: "track_id is required" }, { status: 400 });
  }

  const { data: existing } = await db.playlists.getMaxPosition(supabase, parseInt(playlistId));
  const nextPosition = position ?? ((existing?.[0]?.position ?? -1) + 1);

  const { data: playlistTrack, error } = await db.playlists.addTrack(
    supabase,
    parseInt(playlistId),
    parseInt(track_id),
    nextPosition
  );

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Track already in playlist" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlistTrack }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: playlistId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can modify playlists" }, { status: 403 });
  }

  const body = await request.json();
  const { track_ids } = body;

  if (!Array.isArray(track_ids)) {
    return NextResponse.json({ error: "track_ids array is required" }, { status: 400 });
  }

  const { error } = await db.playlists.reorderTracks(supabase, parseInt(playlistId), track_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, order: track_ids });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: playlistId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can modify playlists" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("track_id");

  if (!trackId) {
    return NextResponse.json({ error: "track_id query param is required" }, { status: 400 });
  }

  const { error } = await db.playlists.removeTrack(supabase, parseInt(playlistId), parseInt(trackId));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
