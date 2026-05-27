import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchTracks } from "@/lib/search/search-tracks";

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
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const hasAudioParam = url.searchParams.get("has_audio");

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const hasAudio =
    hasAudioParam === "1" || hasAudioParam === "true"
      ? true
      : hasAudioParam === "0" || hasAudioParam === "false"
        ? false
        : undefined;

  const results: {
    tracks?: Awaited<ReturnType<typeof searchTracks>>;
    artists?: { id: number; name: string }[];
    playlists?: { id: number; name: string }[];
  } = {};

  if (type === "all" || type === "tracks") {
    results.tracks = await searchTracks(supabase, query, { limit, hasAudio });
  }

  if (type === "all" || type === "artists") {
    const { data: artistsData } = await supabase
      .from("artists")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(limit);

    results.artists = artistsData ?? [];
  }

  if (type === "all" || type === "playlists") {
    const { data: playlistsData } = await supabase
      .from("playlists")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(limit);

    results.playlists = playlistsData ?? [];
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

  const playlists = (playlistsData ?? []).map((p: { id: number; name: string }) => ({
    id: p.id,
    name: p.name,
  }));

  return NextResponse.json({ playlists, trackId: track_id });
}
