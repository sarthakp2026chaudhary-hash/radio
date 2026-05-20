"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TrackStats {
  trackId: number;
  totalPlays: number;
  hostPlays: number;
  lastPlayedAt: string | null;
}

interface ArtistStats {
  artistId: number;
  totalPlays: number;
  hostPlays: number;
  trackCount: number;
}

interface TopTrack {
  track_id: number;
  total_plays: number;
  host_plays: number;
  last_played_at: string | null;
  track: {
    id: number;
    title: string;
    cover_url: string | null;
    artists: { id: number; name: string } | null;
  } | null;
}

export function useTrackStats(trackId?: number) {
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!trackId) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/listening/stats?track_id=${trackId}`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch track stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [trackId]);

  return { stats, isLoading };
}

export function useArtistStats(artistId?: number) {
  const [stats, setStats] = useState<ArtistStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!artistId) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/listening/stats?artist_id=${artistId}`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch artist stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [artistId]);

  return { stats, isLoading };
}

export function useTopTracks() {
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopTracks = async () => {
      try {
        const res = await fetch("/api/listening/stats");
        const data = await res.json();
        setTracks(data.topTracks || []);
      } catch (err) {
        console.error("Failed to fetch top tracks:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopTracks();
  }, []);

  return { tracks, isLoading };
}

export function useListeningRecorder(channelId?: number) {
  const currentTrackRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const recordPlay = useCallback(
    async (trackId: number, durationMs: number, completed: boolean) => {
      try {
        await fetch("/api/listening/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track_id: trackId,
            channel_id: channelId,
            duration_listened_ms: durationMs,
            completed,
          }),
        });
      } catch (err) {
        console.error("Failed to record play:", err);
      }
    },
    [channelId]
  );

  const startTracking = useCallback((trackId: number) => {
    if (currentTrackRef.current && startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      recordPlay(currentTrackRef.current, duration, false);
    }
    currentTrackRef.current = trackId;
    startTimeRef.current = Date.now();
  }, [recordPlay]);

  const completeTrack = useCallback(() => {
    if (currentTrackRef.current && startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      recordPlay(currentTrackRef.current, duration, true);
      currentTrackRef.current = null;
      startTimeRef.current = null;
    }
  }, [recordPlay]);

  const stopTracking = useCallback(() => {
    if (currentTrackRef.current && startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      recordPlay(currentTrackRef.current, duration, false);
      currentTrackRef.current = null;
      startTimeRef.current = null;
    }
  }, [recordPlay]);

  return { startTracking, completeTrack, stopTracking };
}
