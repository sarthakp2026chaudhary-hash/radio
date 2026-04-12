"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { NotificationStack, type Notification } from "@/components/ui/notification-stack";
import { useReactionChannel, type StickerPayload } from "@/hooks/useReactionChannel";
import { ColorSchemePicker } from "@/components/admin/ColorSchemePicker";
import { useColorScheme } from "@/hooks/useColorScheme";

interface User {
  id: number;
  display_name: string;
  is_host: boolean;
}

interface PlaybackState {
  current_track_id: number | null;
  is_playing: boolean;
  playback_started_at: string | null;
  position_at_timestamp: number;
  volume: number;
  current_folder_id: string | null;
}

interface Track {
  id: number;
  title: string;
  artist: string | null;
  duration_ms: number;
  cover_url: string | null;
  drive_file_id: string;
  folder_id: string | null;
  folder_name: string | null;
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const supabase = createClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const votesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Color scheme sync (admin can change, changes broadcast to all)
  useColorScheme();

  // Listen for sticker reactions from listeners
  const handleStickerReceived = useCallback((payload: StickerPayload) => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [
      ...prev,
      { id, text: `${payload.senderName} sent ${payload.stickerLabel}!` },
    ]);
  }, []);

  useReactionChannel(handleStickerReceived);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const checkDriveConnection = useCallback(async () => {
    setLoadingDrive(true);
    try {
      const response = await fetch("/api/drive/files");
      const data = await response.json();
      setDriveConnected(!data.needsAuth);
    } catch {
      setDriveConnected(false);
    } finally {
      setLoadingDrive(false);
    }
  }, []);

  const syncFromDrive = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/drive/sync", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        // Refresh tracks list
        const { data: allTracks } = await supabase
          .from("tracks")
          .select("*")
          .order("folder_name", { ascending: true });

        if (allTracks) setTracks(allTracks as Track[]);

        alert(`Synced! Imported ${data.imported} new tracks, ${data.skipped} already existed.`);
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Sync failed:", err);
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const clearAndResync = async () => {
    if (!confirm("This will clear all tracks and votes, then re-import from Drive. Continue?")) {
      return;
    }
    setSyncing(true);
    try {
      // Reset first
      const resetRes = await fetch("/api/drive/reset", { method: "POST" });
      if (!resetRes.ok) {
        alert("Failed to clear tracks");
        return;
      }

      // Clear local state
      setTracks([]);
      setCurrentTrack(null);
      setVoteCounts({});

      // Now sync
      const syncRes = await fetch("/api/drive/sync", { method: "POST" });
      const data = await syncRes.json();

      if (syncRes.ok) {
        const { data: allTracks } = await supabase
          .from("tracks")
          .select("*")
          .order("folder_name", { ascending: true });

        if (allTracks) setTracks(allTracks as Track[]);

        alert(`Re-synced! Imported ${data.imported} tracks.`);
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Clear & resync failed:", err);
      alert("Operation failed");
    } finally {
      setSyncing(false);
    }
  };

  const connectDrive = () => {
    window.location.href = "/api/drive/auth";
  };

  useEffect(() => {
    async function init() {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", authUser.id)
        .single() as { data: User | null };

      if (!profile?.is_host) {
        // Not a host, redirect to radio
        router.push("/radio");
        return;
      }

      setUser(profile as User);

      // Fetch playback state
      const { data: state } = await supabase
        .from("playback_state")
        .select("*")
        .eq("id", 1)
        .single() as { data: PlaybackState | null };

      if (state) {
        setPlaybackState(state as PlaybackState);

        if (state.current_track_id) {
          const { data: track } = await supabase
            .from("tracks")
            .select("*")
            .eq("id", state.current_track_id)
            .single() as { data: Track | null };

          if (track) setCurrentTrack(track as Track);
        }
      }

      // Fetch all tracks ordered by folder
      const { data: allTracks } = await supabase
        .from("tracks")
        .select("*")
        .order("folder_name", { ascending: true })
        .order("title", { ascending: true }) as { data: Track[] | null };

      if (allTracks) setTracks(allTracks as Track[]);

      setIsLoading(false);
    }

    init();

    // Subscribe to playback state changes (for sync across tabs/refreshes)
    if (!playbackChannelRef.current) {
      playbackChannelRef.current = supabase
        .channel("admin-playback")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "playback_state",
            filter: "id=eq.1",
          },
          async (payload) => {
            const newState = payload.new as PlaybackState;
            setPlaybackState(newState);

            // Fetch track if changed
            if (newState.current_track_id) {
              const { data: track } = await supabase
                .from("tracks")
                .select("*")
                .eq("id", newState.current_track_id)
                .single();
              if (track) setCurrentTrack(track as Track);
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (playbackChannelRef.current) {
        playbackChannelRef.current.unsubscribe();
        playbackChannelRef.current = null;
      }
    };
  }, []);

  // Check for drive connection status from URL
  useEffect(() => {
    if (searchParams.get("drive_connected") === "true") {
      setDriveConnected(true);
    }
  }, [searchParams]);

  // Initial drive connection check
  useEffect(() => {
    if (!isLoading && user) {
      checkDriveConnection();
    }
  }, [isLoading, user, checkDriveConnection]);

  // Fetch vote counts for current folder
  const fetchVoteCounts = async () => {
    try {
      const response = await fetch("/api/votes");
      const data = await response.json();
      if (data.tracks) {
        const counts: Record<number, number> = {};
        data.tracks.forEach((t: { id: number; voteCount: number }) => {
          counts[t.id] = t.voteCount;
        });
        setVoteCounts(counts);
      }
    } catch (err) {
      console.error("Failed to fetch vote counts:", err);
    }
  };

  // Subscribe to vote changes
  useEffect(() => {
    // Fetch votes initially and whenever folder changes
    if (playbackState?.current_folder_id) {
      fetchVoteCounts();
    }

    // Clean up previous subscription
    if (votesChannelRef.current) {
      votesChannelRef.current.unsubscribe();
      votesChannelRef.current = null;
    }

    // Subscribe to ALL vote changes (simpler, more reliable)
    votesChannelRef.current = supabase
      .channel(`admin-votes-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "track_votes",
        },
        () => {
          fetchVoteCounts();
        }
      )
      .subscribe();

    return () => {
      if (votesChannelRef.current) {
        votesChannelRef.current.unsubscribe();
        votesChannelRef.current = null;
      }
    };
  }, [playbackState?.current_folder_id]);

  // Handle audio playback for host preview
  useEffect(() => {
    if (!audioRef.current || !currentTrack?.drive_file_id) return;

    const audio = audioRef.current;
    const streamUrl = `/api/drive/stream/${currentTrack.drive_file_id}`;

    if (audio.src !== window.location.origin + streamUrl) {
      audio.src = streamUrl;
      audio.load();
    }

    if (playbackState?.is_playing) {
      // Seek to saved position when resuming (if significantly different)
      const targetSec = playbackState.position_at_timestamp / 1000;
      if (targetSec > 0 && Math.abs(audio.currentTime - targetSec) > 1) {
        audio.currentTime = targetSec;
      }
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [currentTrack?.drive_file_id, playbackState?.is_playing, playbackState?.position_at_timestamp]);


  const togglePlayback = async () => {
    if (!playbackState) return;
    setIsUpdating(true);

    const now = new Date().toISOString();
    // Capture actual audio position when pausing
    const currentPositionMs = audioRef.current?.currentTime
      ? audioRef.current.currentTime * 1000
      : 0;

    const newState = {
      is_playing: !playbackState.is_playing,
      playback_started_at: !playbackState.is_playing ? now : null,
      // When pausing, save actual position; when playing, start from saved position
      position_at_timestamp: playbackState.is_playing
        ? currentPositionMs
        : playbackState.position_at_timestamp,
    };

    // Use fresh client to avoid stale session issues
    const freshClient = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (freshClient.from("playback_state") as any)
      .update(newState)
      .eq("id", 1);

    if (error) {
      console.error("Failed to update playback state:", error);
      setIsUpdating(false);
      return;
    }

    setPlaybackState({ ...playbackState, ...newState });
    setIsUpdating(false);
  };

  const selectTrack = async (track: Track) => {
    setIsUpdating(true);
    console.log("[SELECT TRACK] Playing:", track.title, "ID:", track.id);

    const folderChanged = track.folder_id !== playbackState?.current_folder_id;

    // Clear all votes if folder/mood changed (uses admin API to bypass RLS)
    if (folderChanged && playbackState?.current_folder_id) {
      console.log("[SELECT TRACK] Folder changed, clearing all votes for folder:", playbackState.current_folder_id);
      const folderRes = await fetch("/api/votes/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: playbackState.current_folder_id }),
      });
      console.log("[SELECT TRACK] Folder clear response:", await folderRes.json());
    }

    // Clear votes for the track being played (uses admin API to bypass RLS)
    console.log("[SELECT TRACK] Clearing votes for track:", track.id);
    const trackRes = await fetch("/api/votes/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: track.id }),
    });
    console.log("[SELECT TRACK] Track clear response:", await trackRes.json());

    // Update Song of the Day (last song played today wins)
    fetch("/api/history/song-of-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: track.id }),
    }).catch(console.error);

    // Build queue from tracks in the same folder
    const folderTracks = tracks
      .filter((t) => t.folder_id === track.folder_id)
      .sort((a, b) => a.title.localeCompare(b.title));
    const queueTrackIds = folderTracks.map((t) => t.id);
    const queuePosition = folderTracks.findIndex((t) => t.id === track.id);

    // Use fresh client to avoid stale session issues
    const freshClient = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (freshClient.from("playback_state") as any)
      .update({
        current_track_id: track.id,
        current_folder_id: track.folder_id,
        is_playing: true,
        playback_started_at: new Date().toISOString(),
        position_at_timestamp: 0,
        queue_track_ids: queueTrackIds,
        queue_position: queuePosition,
      })
      .eq("id", 1);

    setCurrentTrack(track);
    setPlaybackState((prev) =>
      prev
        ? {
            ...prev,
            current_track_id: track.id,
            current_folder_id: track.folder_id,
            is_playing: true,
            position_at_timestamp: 0,
          }
        : null
    );
    setIsUpdating(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Host Dashboard
            </h1>
            <p className="text-text-tertiary text-sm">
              Welcome back, {user?.display_name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  playbackState?.is_playing
                    ? "bg-success animate-pulse"
                    : "bg-text-muted"
                }`}
              />
              <span className="text-text-secondary text-sm">
                {playbackState?.is_playing ? "Live" : "Offline"}
              </span>
            </div>

            {/* Profile Dropdown */}
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-ember flex items-center justify-center">
                    <span className="text-void text-sm font-medium">
                      {user?.display_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              }
              align="right"
            >
              <DropdownItem
                onClick={() => router.push("/admin/post")}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                }
              >
                Post
              </DropdownItem>
              <DropdownItem
                onClick={() => router.push("/admin/history")}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                My History
              </DropdownItem>
              {playbackState?.is_playing && (
                <>
                  <DropdownDivider />
                  <DropdownItem
                    onClick={async () => {
                      if (audioRef.current) {
                        audioRef.current.pause();
                      }
                      await (supabase.from("playback_state") as any)
                        .update({
                          is_playing: false,
                          playback_started_at: null,
                        })
                        .eq("id", 1);
                      setPlaybackState(prev => prev ? { ...prev, is_playing: false } : null);
                    }}
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                      </svg>
                    }
                  >
                    Stop Broadcast
                  </DropdownItem>
                </>
              )}
              <DropdownDivider />
              <DropdownItem
                onClick={handleLogout}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                }
              >
                Logout
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Now Playing / Player */}
          <div className="lg:col-span-2">
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--surface-3)",
              }}
            >
              <h2 className="text-lg font-semibold mb-6">Now Playing</h2>

              {currentTrack ? (
                <div className="flex items-start gap-6">
                  {/* Album art */}
                  <div className="w-32 h-32 flex-shrink-0">
                    {currentTrack.cover_url ? (
                      <img
                        src={currentTrack.cover_url}
                        alt={currentTrack.title}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-xl flex items-center justify-center"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <svg
                          className="w-10 h-10 text-text-muted"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Track info */}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-text-primary">
                      {currentTrack.title}
                    </h3>
                    <p className="text-text-secondary mt-1">
                      {currentTrack.artist || "Unknown Artist"}
                    </p>
                    {/* Controls */}
                    <div className="flex items-center gap-4 mt-4">
                      <Button
                        onClick={togglePlayback}
                        disabled={isUpdating}
                        variant="primary"
                        size="lg"
                      >
                        {playbackState?.is_playing ? (
                          <span className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                            Pause
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Play
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No track selected</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    Select a track from the library to start playing
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div>
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--surface-3)",
              }}
            >
              <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-text-tertiary text-sm">Total Tracks</p>
                  <p className="text-2xl font-semibold">{tracks.length}</p>
                </div>
                <div>
                  <p className="text-text-tertiary text-sm">Status</p>
                  <p className="text-lg">
                    {playbackState?.is_playing ? (
                      <span className="text-success">Broadcasting</span>
                    ) : (
                      <span className="text-text-muted">Offline</span>
                    )}
                  </p>
                </div>

                {/* Color Scheme Picker */}
                <div className="pt-4 border-t border-surface-3">
                  <ColorSchemePicker />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Track Library */}
        <div className="mt-8">
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-3)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Track Library</h2>
              <div className="flex items-center gap-3">
                {driveConnected ? (
                  <>
                    <Button
                      onClick={clearAndResync}
                      disabled={syncing}
                      variant="ghost"
                      size="sm"
                    >
                      {syncing ? "Working..." : "Clear & Resync"}
                    </Button>
                    <Button
                      onClick={syncFromDrive}
                      disabled={syncing}
                      variant="ghost"
                      size="sm"
                    >
                      {syncing ? "Syncing..." : "Sync from Drive"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={connectDrive} variant="primary" size="sm">
                    Connect Google Drive
                  </Button>
                )}
              </div>
            </div>

            {/* Folder tree view */}
            {tracks.length > 0 ? (
              <div className="space-y-1">
                {Array.from(new Set(tracks.map(t => t.folder_name || "Uncategorized"))).map((folderName) => {
                  const folderTracks = tracks.filter(t => (t.folder_name || "Uncategorized") === folderName);
                  const isExpanded = expandedFolders.has(folderName);
                  const toggleFolder = () => {
                    setExpandedFolders(prev => {
                      const next = new Set(prev);
                      if (next.has(folderName)) {
                        next.delete(folderName);
                      } else {
                        next.add(folderName);
                      }
                      return next;
                    });
                  };

                  return (
                    <div key={folderName}>
                      {/* Folder header */}
                      <button
                        onClick={toggleFolder}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 text-twilight transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="w-5 h-5 text-twilight" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                        <span className="flex-1 text-left font-medium text-text-primary">{folderName}</span>
                        <span className="text-text-tertiary text-sm">{folderTracks.length} songs</span>
                      </button>

                      {/* Songs inside folder */}
                      {isExpanded && (
                        <div className="ml-8 mt-1 space-y-1">
                          {folderTracks.map((track) => (
                            <button
                              key={track.id}
                              onClick={() => selectTrack(track)}
                              disabled={isUpdating}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-surface-2 ${
                                currentTrack?.id === track.id
                                  ? "bg-ember/10 border border-ember/30"
                                  : "bg-transparent"
                              }`}
                            >
                              <div className="w-10 h-10 flex-shrink-0">
                                {track.cover_url ? (
                                  <img
                                    src={track.cover_url}
                                    alt={track.title}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full rounded-lg flex items-center justify-center"
                                    style={{ background: "var(--surface-3)" }}
                                  >
                                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="font-medium text-text-primary truncate">{track.title}</p>
                                <p className="text-sm text-text-secondary truncate">{track.artist || "Unknown Artist"}</p>
                              </div>
                              {/* Vote count badge */}
                              {voteCounts[track.id] > 0 && currentTrack?.id !== track.id && (
                                <div
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                                  style={{ background: "var(--ember-subtle)", color: "var(--ember)" }}
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 15l7-7 7 7" />
                                  </svg>
                                  {voteCounts[track.id]}
                                </div>
                              )}
                              {currentTrack?.id === track.id && playbackState?.is_playing && (
                                <div className="flex items-center gap-0.5">
                                  {[...Array(3)].map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-0.5 bg-ember rounded-full animate-wave"
                                      style={{ height: "12px", animationDelay: `${i * 0.15}s` }}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-text-secondary">No tracks yet</p>
                <p className="text-text-tertiary text-sm mt-1">
                  Click &quot;Sync from Drive&quot; to import your music
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reaction notifications */}
      <NotificationStack
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* Hidden audio element for host preview */}
      <audio ref={audioRef} />
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-void">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
            <span className="text-text-secondary">Loading dashboard...</span>
          </div>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
