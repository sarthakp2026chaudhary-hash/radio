import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

export async function GET() {
  const supabase = await createClient();
  const { data: playlists, error } = await db.playlists.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = playlists?.map((p: any) => ({
    ...p,
    track_count: p.playlist_tracks?.length || 0,
    total_duration_ms: p.playlist_tracks?.reduce(
      (acc: number, pt: any) => acc + (pt.tracks?.duration_ms || 0),
      0
    ) || 0,
  }));

  return NextResponse.json({ playlists: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can create playlists" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, cover_url, is_public = true } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: playlist, error } = await db.playlists.create(supabase, {
    name: name.trim(),
    description: description?.trim() || null,
    cover_url: cover_url || null,
    is_public,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlist }, { status: 201 });
}
