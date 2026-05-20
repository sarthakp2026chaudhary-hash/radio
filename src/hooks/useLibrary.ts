"use client";

import { useState, useEffect, useCallback } from "react";

interface Artist {
  id: number;
  name: string;
}

interface Track {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  artists: Artist | null;
}

interface SourceChannel {
  id: number;
  name: string;
}

interface LibraryEntry {
  id: number;
  track_id: number;
  added_at: string;
  source_channel_id: number | null;
  track: Track;
  source_channel?: SourceChannel | null;
}

export function useLibrary() {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async (limit = 50, offset = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/library?limit=${limit}&offset=${offset}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch library");
      }

      setLibrary(data.library || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addToLibrary = useCallback(async (trackId: number, sourceChannelId?: number) => {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track_id: trackId,
        source_channel_id: sourceChannelId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to add to library");
    }

    setLibrary((prev) => [data.entry, ...prev]);
    setTotal((prev) => prev + 1);

    return data.entry;
  }, []);

  const removeFromLibrary = useCallback(async (trackId: number) => {
    const res = await fetch(`/api/library?track_id=${trackId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove from library");
    }

    setLibrary((prev) => prev.filter((e) => e.track_id !== trackId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const isInLibrary = useCallback(
    (trackId: number) => library.some((e) => e.track_id === trackId),
    [library]
  );

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  return {
    library,
    total,
    isLoading,
    error,
    fetchLibrary,
    addToLibrary,
    removeFromLibrary,
    isInLibrary,
  };
}

export function useLibraryStatus(trackId?: number) {
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!trackId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/library?limit=1000`);
      const data = await res.json();
      const inLibrary = (data.library || []).some(
        (e: LibraryEntry) => e.track_id === trackId
      );
      setIsInLibrary(inLibrary);
    } catch (err) {
      console.error("Failed to check library status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [trackId]);

  const toggle = useCallback(async (sourceChannelId?: number) => {
    if (!trackId) return;

    setIsLoading(true);
    try {
      if (isInLibrary) {
        await fetch(`/api/library?track_id=${trackId}`, { method: "DELETE" });
        setIsInLibrary(false);
      } else {
        await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track_id: trackId, source_channel_id: sourceChannelId }),
        });
        setIsInLibrary(true);
      }
    } catch (err) {
      console.error("Failed to toggle library:", err);
    } finally {
      setIsLoading(false);
    }
  }, [trackId, isInLibrary]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { isInLibrary, isLoading, toggle, refresh: checkStatus };
}
