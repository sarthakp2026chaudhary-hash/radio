"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Artist, Track } from "@/lib/supabase/types";

interface ArtistWithTracks extends Artist {
  tracks: Track[];
}

export function useArtists() {
  const [artists, setArtists] = useState<ArtistWithTracks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/artists");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch artists");
      }

      setArtists(data.artists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createArtist = useCallback(async (name: string, bio?: string) => {
    const res = await fetch("/api/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create artist");
    }

    await fetchArtists();
    return data.artist;
  }, [fetchArtists]);

  const updateArtist = useCallback(async (id: number, updates: Partial<Artist>) => {
    const res = await fetch(`/api/artists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to update artist");
    }

    await fetchArtists();
    return data.artist;
  }, [fetchArtists]);

  const deleteArtist = useCallback(async (id: number) => {
    const res = await fetch(`/api/artists/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete artist");
    }

    await fetchArtists();
  }, [fetchArtists]);

  const getArtistWithTracks = useCallback(async (id: number) => {
    const res = await fetch(`/api/artists/${id}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch artist");
    }

    return data.artist as ArtistWithTracks;
  }, []);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  return {
    artists,
    isLoading,
    error,
    fetchArtists,
    createArtist,
    updateArtist,
    deleteArtist,
    getArtistWithTracks,
  };
}
