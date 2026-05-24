import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { DEFAULT_TRACK_DURATION_MS } from "@/lib/constants";

type RouteParams = { params: Promise<{ slug: string }> };

// Minimal, audio-optional "what's on loop" view for listeners.
// The loop is the channel's source playlist (all tracks) or its single current track.
// Current + next are computed from elapsed time over the loop's cumulative durations
// (default when unknown) — repeat-all, computed on read, no background job.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: channel } = await db.channels.getBySlug(supabase, slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const state = channel.channel_state;

  let loopTracks: any[] = [];
  if (state?.source_type === "playlist" && state?.source_id) {
    const { data: playlist } = await db.playlists.get(supabase, state.source_id);
    loopTracks = (playlist?.playlist_tracks || [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((pt: any) => pt.tracks)
      .filter(Boolean);
  } else if (state?.current_track) {
    loopTracks = [state.current_track];
  }

  // Hidden ("−") tracks are skipped: they drop out of the rotation entirely.
  const skipped = new Set<number>((state?.skipped_track_ids as number[]) || []);
  const effective = loopTracks.filter((t) => t && !skipped.has(t.id));

  const loopCount = effective.length;
  let currentIdx = 0;
  let positionMs = 0;

  if (loopCount > 0 && state?.is_playing && state?.playback_started_at) {
    const durations = effective.map((t) => t?.duration_ms || DEFAULT_TRACK_DURATION_MS);
    const total = durations.reduce((a, b) => a + b, 0);
    const elapsed = Date.now() - new Date(state.playback_started_at).getTime();
    if (total > 0) {
      let loopPos = ((elapsed % total) + total) % total;
      for (let i = 0; i < loopCount; i++) {
        if (loopPos < durations[i]) {
          currentIdx = i;
          positionMs = loopPos;
          break;
        }
        loopPos -= durations[i];
      }
    }
  }

  const current = effective[currentIdx] || null;
  const next = loopCount > 0 ? effective[(currentIdx + 1) % loopCount] : null;

  return NextResponse.json({
    channel: {
      name: channel.name,
      slug: channel.slug,
      updated_at: state?.updated_at ?? channel.updated_at,
    },
    is_playing: !!state?.is_playing,
    loop_count: loopCount,
    current_position_ms: positionMs,
    // current_track is exposed for optional audio playback; the listener UI decides
    // what (if anything) to display about it.
    current_track: current
      ? {
          id: current.id,
          title: current.title,
          file_url: current.file_url ?? null,
          duration_ms: current.duration_ms ?? DEFAULT_TRACK_DURATION_MS,
        }
      : null,
    next_track: next ? { id: next.id, title: next.title } : null,
    // Full ordered loop (including hidden) with flags — powers the host's queue toggles.
    loop: loopTracks.map((t) => ({
      id: t.id,
      title: t.title,
      skipped: skipped.has(t.id),
      is_current: !!current && t.id === current.id,
    })),
  });
}
