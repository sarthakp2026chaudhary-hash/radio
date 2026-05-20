import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Track, Artist, Album } from "@/lib/supabase/types";

type TrackWithRelations = Track & { artists: Artist | null; albums: Album | null };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: "Maximum 100 tracks per request" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tracks")
    .select("*, artists:artist_id(id, name, slug), albums:album_id(id, title)")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tracks = data as TrackWithRelations[] | null;
  const trackMap: Record<number, TrackWithRelations> = {};
  for (const track of tracks || []) {
    trackMap[track.id] = track;
  }

  const orderedTracks = ids
    .map((id: number) => trackMap[id])
    .filter(Boolean);

  return NextResponse.json({ tracks: orderedTracks });
}
