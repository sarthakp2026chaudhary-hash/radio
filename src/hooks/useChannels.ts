"use client";

import { useState, useEffect, useCallback } from "react";
import type { Channel, ChannelState, ChannelMember, RepeatMode, Track, Artist } from "@/lib/supabase/types";

interface ChannelWithMeta extends Channel {
  listener_count: number;
  channel_state?: ChannelState | null;
}

interface PlaybackState extends ChannelState {
  current_position_ms: number;
  current_track?: (Track & { artists?: Artist | null }) | null;
}

type PlaybackAction =
  | { action: "play"; position_ms?: number }
  | { action: "pause" }
  | { action: "play_track"; track_id: number }
  | { action: "play_playlist"; playlist_id: number }
  | { action: "play_next"; track_id: number }
  | { action: "add_to_queue"; track_id: number }
  | { action: "skip" }
  | { action: "seek"; position_ms: number }
  | { action: "shuffle" }
  | { action: "repeat" }
  | { action: "clear_queue" };

export function useChannels() {
  const [channels, setChannels] = useState<ChannelWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/channels");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch channels");
      }

      setChannels(data.channels || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createChannel = useCallback(async (
    name: string,
    description?: string,
    is_public = true,
    for_user_id?: number
  ) => {
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, is_public, for_user_id }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create channel");
    }

    await fetchChannels();
    return data.channel;
  }, [fetchChannels]);

  const getChannel = useCallback(async (slug: string): Promise<ChannelWithMeta> => {
    const res = await fetch(`/api/channels/${slug}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch channel");
    }

    return data.channel;
  }, []);

  const updateChannel = useCallback(async (slug: string, updates: Partial<Channel>) => {
    const res = await fetch(`/api/channels/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update channel");
    }

    await fetchChannels();
    return data.channel;
  }, [fetchChannels]);

  const deleteChannel = useCallback(async (slug: string) => {
    const res = await fetch(`/api/channels/${slug}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete channel");
    }

    await fetchChannels();
  }, [fetchChannels]);

  const getPlaybackState = useCallback(async (slug: string): Promise<PlaybackState | null> => {
    const res = await fetch(`/api/channels/${slug}/playback`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch playback state");
    }

    return data.state;
  }, []);

  const controlPlayback = useCallback(async (slug: string, action: PlaybackAction) => {
    const res = await fetch(`/api/channels/${slug}/playback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to control playback");
    }

    return data;
  }, []);

  const getMembers = useCallback(async (slug: string): Promise<(ChannelMember & { user: { email: string; raw_user_meta_data?: { display_name?: string } } })[]> => {
    const res = await fetch(`/api/channels/${slug}/members`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch members");
    }

    return data.members || [];
  }, []);

  const addMember = useCallback(async (slug: string, userId: string, role: "listener" | "moderator" = "listener") => {
    const res = await fetch(`/api/channels/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to add member");
    }

    return data.member;
  }, []);

  const removeMember = useCallback(async (slug: string, userId: string) => {
    const res = await fetch(`/api/channels/${slug}/members?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove member");
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return {
    channels,
    isLoading,
    error,
    fetchChannels,
    createChannel,
    getChannel,
    updateChannel,
    deleteChannel,
    getPlaybackState,
    controlPlayback,
    getMembers,
    addMember,
    removeMember,
  };
}
