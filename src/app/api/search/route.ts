import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TrackRow {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  artists: { id: number; name: string } | null;
}

interface PlaylistRow {
  id: number;
  name: string;
  playlist_tracks: { track_id: number }[];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const type = url.searchParams.get("type") || "all";
  const limit = parseInt(url.searchParams.get("limit") || "20");

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const results: {
    tracks?: TrackRow[];
    artists?: { id: number; name: string; track_count?: number }[];
    playlists?: { id: number; name: string; track_count?: number }[];
  } = {};

  if (type === "all" || type === "tracks") {
    const { data: tracksData } = await supabase
      .from("tracks")
      .select("id, title, duration_ms, cover_url, artists:artist_id(id, name)")
      .ilike("title", `%${query}%`)
      .limit(limit);

    results.tracks = (tracksData || []) as TrackRow[];
  }

  if (type === "all" || type === "artists") {
    const { data: artistsData } = await supabase
      .from("artists")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(limit);

    results.artists = (artistsData || []) as { id: number; name: string }[];
  }

  if (type === "all" || type === "playlists") {
    const { data: playlistsData } = await supabase
      .from("playlists")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(limit);

    results.playlists = (playlistsData || []) as { id: number; name: string }[];
  }

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { track_id } = body;

  if (!track_id) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const { data: playlistsData } = await supabase
    .from("playlists")
    .select(`
      id,
      name,
      playlist_tracks!inner(track_id)
    `)
    .eq("playlist_tracks.track_id", track_id);

  const playlists = (playlistsData || []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));

  return NextResponse.json({ playlists, trackId: track_id });
}
