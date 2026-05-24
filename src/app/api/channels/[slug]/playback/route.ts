import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: channel } = await db.channels.getBySlug(supabase, slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  let { data: state, error } = await db.channelState.get(supabase, channel.id);

  if (!state && !error) {
    await db.channelState.create(supabase, channel.id);
    const result = await db.channelState.get(supabase, channel.id);
    state = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let currentPositionMs = state?.position_ms || 0;
  if (state?.is_playing && state?.playback_started_at) {
    const elapsed = Date.now() - new Date(state.playback_started_at).getTime();
    currentPositionMs = (state.position_ms || 0) + elapsed;
  }

  return NextResponse.json({
    state: {
      ...state,
      current_position_ms: currentPositionMs,
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can control playback" }, { status: 403 });
  }

  const { data: channel } = await db.channels.getBySlug(supabase, slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action, track_id, playlist_id, album_id, position_ms } = body;

  let { data: currentState } = await db.channelState.get(supabase, channel.id);

  if (!currentState) {
    await db.channelState.create(supabase, channel.id);
    const result = await db.channelState.get(supabase, channel.id);
    currentState = result.data;
  }

  if (!currentState) {
    return NextResponse.json({ error: "Failed to initialize channel state" }, { status: 500 });
  }

  switch (action) {
    case "play": {
      const updates: Record<string, unknown> = {
        is_playing: true,
        playback_started_at: new Date().toISOString(),
      };
      if (position_ms !== undefined) {
        updates.position_ms = position_ms;
      }
      await db.channelState.update(supabase, channel.id, updates);
      return NextResponse.json({ success: true, action: "play" });
    }

    case "pause": {
      let currentPos = currentState.position_ms || 0;
      if (currentState.playback_started_at) {
        const elapsed = Date.now() - new Date(currentState.playback_started_at).getTime();
        currentPos += elapsed;
      }
      await db.channelState.update(supabase, channel.id, {
        is_playing: false,
        position_ms: currentPos,
        playback_started_at: null,
      });
      return NextResponse.json({ success: true, action: "pause", position_ms: currentPos });
    }

    case "play_track": {
      if (!track_id) {
        return NextResponse.json({ error: "track_id required" }, { status: 400 });
      }
      await db.channelState.update(supabase, channel.id, {
        current_track_id: track_id,
        is_playing: true,
        playback_started_at: new Date().toISOString(),
        position_ms: 0,
        source_type: "queue",
        source_id: null,
        source_position: 0,
      });
      return NextResponse.json({ success: true, action: "play_track", track_id });
    }

    case "play_playlist": {
      if (!playlist_id) {
        return NextResponse.json({ error: "playlist_id required" }, { status: 400 });
      }
      const { data: playlist } = await db.playlists.get(supabase, playlist_id);
      const firstTrack = playlist?.playlist_tracks?.[0];
      if (!firstTrack) {
        return NextResponse.json({ error: "Playlist is empty" }, { status: 400 });
      }
      await db.channelState.update(supabase, channel.id, {
        current_track_id: firstTrack.tracks?.id,
        is_playing: true,
        playback_started_at: new Date().toISOString(),
        position_ms: 0,
        source_type: "playlist",
        source_id: playlist_id,
        source_position: 0,
        priority_queue: [],
        user_queue: [],
      });
      return NextResponse.json({ success: true, action: "play_playlist", playlist_id });
    }

    case "play_next": {
      if (!track_id) {
        return NextResponse.json({ error: "track_id required" }, { status: 400 });
      }
      const newPriorityQueue = [...(currentState.priority_queue || []), track_id];
      await db.channelState.update(supabase, channel.id, { priority_queue: newPriorityQueue });
      return NextResponse.json({ success: true, action: "play_next", track_id });
    }

    case "add_to_queue": {
      if (!track_id) {
        return NextResponse.json({ error: "track_id required" }, { status: 400 });
      }
      const newUserQueue = [...(currentState.user_queue || []), track_id];
      await db.channelState.update(supabase, channel.id, { user_queue: newUserQueue });
      return NextResponse.json({ success: true, action: "add_to_queue", track_id });
    }

    case "skip": {
      // Get next track from queue or playlist
      let nextTrackId: number | null = null;
      let newState: Record<string, unknown> = {};

      if (currentState.priority_queue?.length > 0) {
        nextTrackId = currentState.priority_queue[0];
        newState.priority_queue = currentState.priority_queue.slice(1);
      } else if (currentState.user_queue?.length > 0) {
        nextTrackId = currentState.user_queue[0];
        newState.user_queue = currentState.user_queue.slice(1);
      } else if (currentState.source_type === "playlist" && currentState.source_id) {
        const { data: playlist } = await db.playlists.get(supabase, currentState.source_id);
        const tracks = playlist?.playlist_tracks || [];
        const nextPos = (currentState.source_position || 0) + 1;

        if (currentState.shuffle_enabled && currentState.shuffle_order?.length > 0) {
          if (nextPos < currentState.shuffle_order.length) {
            nextTrackId = currentState.shuffle_order[nextPos];
            newState.source_position = nextPos;
          } else if (currentState.repeat_mode === "all") {
            nextTrackId = currentState.shuffle_order[0];
            newState.source_position = 0;
          }
        } else {
          if (nextPos < tracks.length) {
            nextTrackId = tracks[nextPos]?.tracks?.id;
            newState.source_position = nextPos;
          } else if (currentState.repeat_mode === "all" && tracks.length > 0) {
            nextTrackId = tracks[0]?.tracks?.id;
            newState.source_position = 0;
          }
        }
      }

      if (nextTrackId) {
        await db.channelState.update(supabase, channel.id, {
          ...newState,
          current_track_id: nextTrackId,
          position_ms: 0,
          playback_started_at: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, action: "skip", next_track_id: nextTrackId });
      } else {
        await db.channelState.update(supabase, channel.id, { is_playing: false });
        return NextResponse.json({ success: true, action: "skip", stopped: true });
      }
    }

    case "seek": {
      if (position_ms === undefined) {
        return NextResponse.json({ error: "position_ms required" }, { status: 400 });
      }
      await db.channelState.update(supabase, channel.id, {
        position_ms,
        playback_started_at: currentState.is_playing ? new Date().toISOString() : null,
      });
      return NextResponse.json({ success: true, action: "seek", position_ms });
    }

    case "shuffle": {
      const shuffleEnabled = !currentState.shuffle_enabled;
      let shuffleOrder: number[] = [];

      if (shuffleEnabled && currentState.source_type === "playlist" && currentState.source_id) {
        const { data: playlist } = await db.playlists.get(supabase, currentState.source_id);
        const tracks = playlist?.playlist_tracks || [];
        shuffleOrder = tracks.map((t: any) => t.tracks?.id).filter(Boolean);
        for (let i = shuffleOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
        }
      }

      await db.channelState.update(supabase, channel.id, {
        shuffle_enabled: shuffleEnabled,
        shuffle_order: shuffleOrder,
        source_position: 0,
      });
      return NextResponse.json({ success: true, action: "shuffle", enabled: shuffleEnabled });
    }

    case "repeat": {
      const modes = ["off", "all", "one"] as const;
      const currentIndex = modes.indexOf(currentState.repeat_mode as typeof modes[number]);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      await db.channelState.update(supabase, channel.id, { repeat_mode: nextMode });
      return NextResponse.json({ success: true, action: "repeat", mode: nextMode });
    }

    case "clear_queue": {
      await db.channelState.update(supabase, channel.id, {
        priority_queue: [],
        user_queue: [],
      });
      return NextResponse.json({ success: true, action: "clear_queue" });
    }

    case "toggle_skip": {
      if (!track_id) {
        return NextResponse.json({ error: "track_id required" }, { status: 400 });
      }
      const set = new Set<number>((currentState.skipped_track_ids as number[]) || []);
      if (set.has(track_id)) set.delete(track_id);
      else set.add(track_id);
      const skipped = Array.from(set);
      await db.channelState.setSkipped(supabase, channel.id, skipped);
      return NextResponse.json({ success: true, action: "toggle_skip", skipped });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
