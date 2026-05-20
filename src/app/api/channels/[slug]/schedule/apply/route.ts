import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface ScheduleRow {
  id: number;
  playlist_id: number | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface ChannelStateRow {
  source_type: string | null;
  source_id: number | null;
  broadcast_mode: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const { data: channelData } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", slug)
    .single();

  const channel = channelData as { id: number } | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const { data: stateData } = await supabase
    .from("channel_state")
    .select("source_type, source_id, broadcast_mode")
    .eq("channel_id", channel.id)
    .single();

  const channelState = stateData as ChannelStateRow | null;

  if (channelState?.broadcast_mode === "live") {
    return NextResponse.json({
      applied: false,
      reason: "Channel is in live broadcast mode",
    });
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  const { data: schedulesData } = await supabase
    .from("channel_schedules" as any)
    .select("id, playlist_id, day_of_week, start_time, end_time, is_active")
    .eq("channel_id", channel.id)
    .eq("is_active", true)
    .order("start_time");

  const schedules = (schedulesData || []) as ScheduleRow[];

  const activeSchedule = schedules.find((s) => {
    const dayMatches = s.day_of_week === null || s.day_of_week === currentDay;
    const timeMatches = currentTime >= s.start_time && currentTime < s.end_time;
    return dayMatches && timeMatches;
  });

  if (!activeSchedule) {
    return NextResponse.json({
      applied: false,
      reason: "No active schedule for current time",
      currentTime,
      currentDay,
    });
  }

  if (!activeSchedule.playlist_id) {
    return NextResponse.json({
      applied: false,
      reason: "Schedule has no playlist assigned",
      scheduleId: activeSchedule.id,
    });
  }

  if (
    channelState?.source_type === "playlist" &&
    channelState?.source_id === activeSchedule.playlist_id
  ) {
    return NextResponse.json({
      applied: false,
      reason: "Playlist already playing",
      playlistId: activeSchedule.playlist_id,
    });
  }

  const { data: playlistTracksData } = await supabase
    .from("playlist_tracks")
    .select("track_id")
    .eq("playlist_id", activeSchedule.playlist_id)
    .order("position");

  const playlistTracks = playlistTracksData as { track_id: number }[] | null;

  if (!playlistTracks?.length) {
    return NextResponse.json({
      applied: false,
      reason: "Playlist is empty",
      playlistId: activeSchedule.playlist_id,
    });
  }

  const firstTrackId = playlistTracks[0].track_id;

  const { error: updateError } = await (supabase as any)
    .from("channel_state")
    .update({
      source_type: "playlist",
      source_id: activeSchedule.playlist_id,
      source_position: 0,
      current_track_id: firstTrackId,
      is_playing: true,
      playback_started_at: new Date().toISOString(),
      position_ms: 0,
    })
    .eq("channel_id", channel.id);

  if (updateError) {
    console.error("Failed to apply schedule:", updateError);
    return NextResponse.json({ error: "Failed to apply schedule" }, { status: 500 });
  }

  return NextResponse.json({
    applied: true,
    scheduleId: activeSchedule.id,
    playlistId: activeSchedule.playlist_id,
  });
}
