import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/tracks/[id]/playlists
// Returns every playlist (with its folder) and whether this song is in it —
// powers the "add to playlist / where have I put this song" sheet.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const trackId = parseInt(id);
  const supabase = await createClient();

  const [plRes, memRes, folderRes] = await Promise.all([
    supabase.from("playlists").select("id, name, folder_id").neq("name", "__defaults__").order("name"),
    supabase.from("playlist_tracks").select("playlist_id").eq("track_id", trackId),
    supabase.from("folders").select("id, name, parent_id").order("position"),
  ]);

  if (plRes.error) {
    return NextResponse.json({ error: plRes.error.message }, { status: 500 });
  }

  const memberIds = new Set((memRes.data || []).map((m: { playlist_id: number }) => m.playlist_id));
  const playlists = (plRes.data || []).map((p: { id: number; name: string; folder_id: number | null }) => ({
    id: p.id,
    name: p.name,
    folder_id: p.folder_id,
    in: memberIds.has(p.id),
  }));

  return NextResponse.json({ playlists, folders: folderRes.data || [] });
}
