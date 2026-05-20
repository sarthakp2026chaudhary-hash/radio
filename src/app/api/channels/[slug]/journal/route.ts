import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface JournalEntry {
  id: number;
  position: number;
  played_at: string;
  added_by: string;
  track_id: number;
  session_date: string;
}

interface ChannelRow {
  id: number;
  name: string;
}

interface UserRow {
  id: number;
  is_host: boolean;
}

interface PlaylistRow {
  id: number;
  name: string;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: channelData } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", slug)
    .single();

  const channel = channelData as ChannelRow | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const { data: journal, error } = await supabase
    .from("queue_journal" as any)
    .select(`
      id,
      position,
      played_at,
      added_by,
      tracks:track_id (
        id,
        title,
        duration_ms,
        cover_url,
        artists:artist_id (id, name)
      )
    `)
    .eq("channel_id", channel.id)
    .eq("session_date", date)
    .order("position", { ascending: true });

  if (error) {
    console.error("Failed to fetch journal:", error);
    return NextResponse.json({ error: "Failed to fetch journal" }, { status: 500 });
  }

  const { data: datesData } = await supabase
    .from("queue_journal" as any)
    .select("session_date")
    .eq("channel_id", channel.id)
    .order("session_date", { ascending: false });

  const dates = datesData as { session_date: string }[] | null;
  const uniqueDates = [...new Set(dates?.map((d) => d.session_date) || [])];

  return NextResponse.json({
    journal,
    date,
    availableDates: uniqueDates,
    channelId: channel.id,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("id, is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  const { data: channelData } = await supabase
    .from("channels")
    .select("id, name")
    .eq("slug", slug)
    .single();

  const channel = channelData as ChannelRow | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await request.json();
  const { date, name } = body;

  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  const { data: journalData, error: journalError } = await supabase
    .from("queue_journal" as any)
    .select("track_id, position")
    .eq("channel_id", channel.id)
    .eq("session_date", date)
    .order("position", { ascending: true });

  const journalEntries = journalData as JournalEntry[] | null;

  if (journalError || !journalEntries?.length) {
    return NextResponse.json({ error: "No journal entries for this date" }, { status: 400 });
  }

  const playlistName = name || `${channel.name} - ${date}`;

  const { data: playlistData, error: playlistError } = await supabase
    .from("playlists")
    .insert({
      name: playlistName,
      description: `Auto-saved from ${channel.name} broadcast on ${date}`,
      is_public: false,
      created_by: profile.id,
    } as any)
    .select()
    .single();

  const playlist = playlistData as PlaylistRow | null;

  if (playlistError || !playlist) {
    console.error("Failed to create playlist:", playlistError);
    return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
  }

  const playlistTracks = journalEntries.map((entry, index) => ({
    playlist_id: playlist.id,
    track_id: entry.track_id,
    position: index,
  }));

  const { error: tracksError } = await supabase
    .from("playlist_tracks")
    .insert(playlistTracks as any);

  if (tracksError) {
    console.error("Failed to add tracks to playlist:", tracksError);
    await supabase.from("playlists").delete().eq("id", playlist.id);
    return NextResponse.json({ error: "Failed to add tracks" }, { status: 500 });
  }

  return NextResponse.json({
    playlist,
    trackCount: journalEntries.length,
  });
}
