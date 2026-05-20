import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PlayCountRow {
  track_id: number;
  total_plays: number;
  host_plays: number;
  last_played_at: string | null;
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
  const trackId = url.searchParams.get("track_id");
  const artistId = url.searchParams.get("artist_id");

  if (trackId) {
    const { data: playCount } = await supabase
      .from("track_play_counts" as any)
      .select("*")
      .eq("track_id", parseInt(trackId))
      .single();

    const stats = playCount as PlayCountRow | null;

    return NextResponse.json({
      trackId: parseInt(trackId),
      totalPlays: stats?.total_plays || 0,
      hostPlays: stats?.host_plays || 0,
      lastPlayedAt: stats?.last_played_at || null,
    });
  }

  if (artistId) {
    const { data: tracksData } = await supabase
      .from("tracks")
      .select("id")
      .eq("artist_id", parseInt(artistId));

    const tracks = tracksData as { id: number }[] | null;

    if (!tracks?.length) {
      return NextResponse.json({
        artistId: parseInt(artistId),
        totalPlays: 0,
        hostPlays: 0,
        trackCount: 0,
      });
    }

    const trackIds = tracks.map((t) => t.id);

    const { data: playCounts } = await supabase
      .from("track_play_counts" as any)
      .select("total_plays, host_plays")
      .in("track_id", trackIds);

    const counts = playCounts as { total_plays: number; host_plays: number }[] || [];

    const totalPlays = counts.reduce((sum, c) => sum + (c.total_plays || 0), 0);
    const hostPlays = counts.reduce((sum, c) => sum + (c.host_plays || 0), 0);

    return NextResponse.json({
      artistId: parseInt(artistId),
      totalPlays,
      hostPlays,
      trackCount: tracks.length,
    });
  }

  const { data: topTracks } = await supabase
    .from("track_play_counts" as any)
    .select(`
      track_id,
      total_plays,
      host_plays,
      last_played_at
    `)
    .order("total_plays", { ascending: false })
    .limit(20);

  if (!topTracks?.length) {
    return NextResponse.json({ topTracks: [] });
  }

  const trackIds = (topTracks as PlayCountRow[]).map((t) => t.track_id);

  interface TrackDetail {
    id: number;
    title: string;
    cover_url: string | null;
    artists: { id: number; name: string } | null;
  }

  const { data: trackDetailsData } = await supabase
    .from("tracks")
    .select("id, title, cover_url, artists:artist_id(id, name)")
    .in("id", trackIds);

  const trackDetails = trackDetailsData as TrackDetail[] | null;

  const tracksWithStats = (topTracks as PlayCountRow[]).map((stat) => ({
    ...stat,
    track: trackDetails?.find((t) => t.id === stat.track_id),
  }));

  return NextResponse.json({ topTracks: tracksWithStats });
}
