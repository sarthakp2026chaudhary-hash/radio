"use client";

import { useState, useEffect, useCallback } from "react";
import type { Playlist } from "@/lib/supabase/types";

interface PlaylistWithMeta extends Playlist {
  track_count: number;
  total_duration_ms: number;
  playlist_tracks?: any[];
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<PlaylistWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch playlists");
      }

      setPlaylists(data.playlists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPlaylist = useCallback(async (name: string, description?: string) => {
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create playlist");
    }

    await fetchPlaylists();
    return data.playlist;
  }, [fetchPlaylists]);

  const getPlaylist = useCallback(async (id: number) => {
    const res = await fetch(`/api/playlists/${id}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch playlist");
    }

    return data.playlist;
  }, []);

  const updatePlaylist = useCallback(async (id: number, updates: Partial<Playlist> & { folder_id?: number | null }) => {
    const res = await fetch(`/api/playlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update playlist");
    }

    await fetchPlaylists();
    return data.playlist;
  }, [fetchPlaylists]);

  const deletePlaylist = useCallback(async (id: number) => {
    const res = await fetch(`/api/playlists/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete playlist");
    }

    await fetchPlaylists();
  }, [fetchPlaylists]);

  const addTrack = useCallback(async (playlistId: number, trackId: number, position?: number) => {
    const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id: trackId, position }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to add track");
    }

    return data.playlistTrack;
  }, []);

  const removeTrack = useCallback(async (playlistId: number, trackId: number) => {
    const res = await fetch(`/api/playlists/${playlistId}/tracks?track_id=${trackId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove track");
    }
  }, []);

  const reorderTracks = useCallback(async (playlistId: number, trackIds: number[]) => {
    const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to reorder tracks");
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return {
    playlists,
    isLoading,
    error,
    fetchPlaylists,
    createPlaylist,
    getPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrack,
    removeTrack,
    reorderTracks,
  };
}
