"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Badge, Modal, Input, EmptyState, EmptyStateIcon } from "@/components/ui";
import { useChannels } from "@/hooks/useChannels";
import { usePlaylists } from "@/hooks/usePlaylists";
import { QueueManager } from "@/components/admin/QueueManager";
import { QueueJournal } from "@/components/admin/QueueJournal";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { LiveIndicator } from "@/components/radio/LiveIndicator";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatTime } from "@/lib/utils";
import type { Track, Artist, RepeatMode, ChannelMember } from "@/lib/supabase/types";

interface MemberWithUser extends ChannelMember {
  user: { email: string; raw_user_meta_data?: { display_name?: string } };
}

interface PlaybackState {
  channel_id: number;
  current_track_id: number | null;
  is_playing: boolean;
  playback_started_at: string | null;
  position_ms: number;
  current_position_ms: number;
  source_type: string | null;
  source_id: number | null;
  source_position: number;
  priority_queue: number[];
  user_queue: number[];
  shuffle_enabled: boolean;
  shuffle_order: number[];
  repeat_mode: RepeatMode;
  broadcast_mode: "automated" | "live";
  live_host_user_id: number | null;
}

interface QueueItem {
  id: number;
  track: Track & { artists?: Artist | null };
  queueType: "priority" | "user" | "source";
}

async function fetchTracksBatch(ids: number[]): Promise<(Track & { artists?: Artist | null })[]> {
  if (ids.length === 0) return [];
  const res = await fetch("/api/tracks/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json();
  return data.tracks || [];
}

export default function ChannelControlPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { getChannel, getPlaybackState, controlPlayback, updateChannel, getMembers, addMember, removeMember } = useChannels();
  const { playlists } = usePlaylists();

  const [channel, setChannel] = useState<any>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<(Track & { artists?: Artist | null }) | null>(null);
  const [priorityQueue, setPriorityQueue] = useState<QueueItem[]>([]);
  const [userQueue, setUserQueue] = useState<QueueItem[]>([]);
  const [sourceQueue, setSourceQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);

  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const channelIdRef = useRef<number | null>(null);

  const fetchChannel = useCallback(async () => {
    try {
      const data = await getChannel(slug);
      setChannel(data);
      channelIdRef.current = data.id;
    } catch (err) {
      console.error(err);
    }
  }, [slug, getChannel]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await getMembers(slug);
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  }, [slug, getMembers]);

  const handleToggleVisibility = async () => {
    if (!channel) return;
    setIsUpdating(true);
    try {
      await updateChannel(slug, { is_public: !channel.is_public });
      setChannel({ ...channel, is_public: !channel.is_public });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/channels/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to add member");
        return;
      }

      await fetchMembers();
      setNewMemberEmail("");
      setShowAddMember(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add member");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setIsUpdating(true);
    try {
      await removeMember(slug, userId);
      setMembers(members.filter((m) => m.user_id !== userId));
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchPlaybackState = useCallback(async () => {
    try {
      const state = await getPlaybackState(slug);
      setPlaybackState(state);

      const allTrackIds: number[] = [];
      if (state?.current_track_id) allTrackIds.push(state.current_track_id);
      if (state?.priority_queue?.length) allTrackIds.push(...state.priority_queue);
      if (state?.user_queue?.length) allTrackIds.push(...state.user_queue);

      const uniqueIds = [...new Set(allTrackIds)];
      const tracks = await fetchTracksBatch(uniqueIds);
      const trackMap = new Map(tracks.map((t) => [t.id, t]));

      if (state?.current_track_id) {
        setCurrentTrack(trackMap.get(state.current_track_id) || null);
      } else {
        setCurrentTrack(null);
      }

      if (state?.priority_queue?.length) {
        setPriorityQueue(
          state.priority_queue
            .map((id) => trackMap.get(id))
            .filter(Boolean)
            .map((track) => ({ id: track!.id, track: track!, queueType: "priority" as const }))
        );
      } else {
        setPriorityQueue([]);
      }

      if (state?.user_queue?.length) {
        setUserQueue(
          state.user_queue
            .map((id) => trackMap.get(id))
            .filter(Boolean)
            .map((track) => ({ id: track!.id, track: track!, queueType: "user" as const }))
        );
      } else {
        setUserQueue([]);
      }

      if (state?.source_type === "playlist" && state.source_id) {
        const playlistRes = await fetch(`/api/playlists/${state.source_id}`);
        const playlistData = await playlistRes.json();
        const playlistTracks = playlistData.playlist?.playlist_tracks || [];
        const upcoming = playlistTracks
          .slice(state.source_position + 1, state.source_position + 11)
          .map((pt: any) => ({
            id: pt.tracks.id,
            track: pt.tracks,
            queueType: "source" as const,
          }));
        setSourceQueue(upcoming);
      } else {
        setSourceQueue([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [slug, getPlaybackState]);

  useEffect(() => {
    fetchChannel();
    fetchPlaybackState();
  }, [fetchChannel, fetchPlaybackState]);

  useEffect(() => {
    if (channel && !channel.is_public) {
      fetchMembers();
    }
  }, [channel?.is_public, fetchMembers]);

  useEffect(() => {
    if (!channelIdRef.current) return;

    const supabase = createClient();
    const subscription = supabase
      .channel(`channel_state:${channelIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_state",
          filter: `channel_id=eq.${channelIdRef.current}`,
        },
        () => {
          fetchPlaybackState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchPlaybackState]);

  useEffect(() => {
    if (!playbackState?.is_playing) {
      setCurrentPosition(playbackState?.position_ms || 0);
      return;
    }

    const interval = setInterval(() => {
      if (playbackState?.playback_started_at) {
        const elapsed = Date.now() - new Date(playbackState.playback_started_at).getTime();
        setCurrentPosition((playbackState.position_ms || 0) + elapsed);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playbackState?.is_playing, playbackState?.playback_started_at, playbackState?.position_ms]);

  const handlePlayPause = async () => {
    try {
      await controlPlayback(slug, { action: playbackState?.is_playing ? "pause" : "play" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkip = async () => {
    try {
      await controlPlayback(slug, { action: "skip" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleShuffle = async () => {
    try {
      await controlPlayback(slug, { action: "shuffle" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepeat = async () => {
    try {
      await controlPlayback(slug, { action: "repeat" });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayPlaylist = async (playlistId: number) => {
    try {
      await controlPlayback(slug, { action: "play_playlist", playlist_id: playlistId });
      setShowPlaylistPicker(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearQueue = async () => {
    try {
      await controlPlayback(slug, { action: "clear_queue" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const position = Math.floor(percent * currentTrack.duration_ms);
    try {
      await controlPlayback(slug, { action: "seek", position_ms: position });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
      </div>
    );
  }

  const progress = currentTrack ? (currentPosition / currentTrack.duration_ms) * 100 : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/admin/channels")}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-secondary"
            aria-label="Back to channels"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              {channel?.name}
            </h1>
            <p className="text-text-tertiary mt-1 flex items-center gap-2 flex-wrap">
              {channel?.id && <LiveIndicator channelId={channel.id} size="sm" />}
              <Badge variant={channel?.is_active ? "ember" : "default"}>
                {channel?.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant={channel?.is_public ? "default" : "warning"}>
                {channel?.is_public ? "Public" : "Private"}
              </Badge>
              {playbackState?.broadcast_mode === "live" && (
                <Badge variant="ember">Broadcasting</Badge>
              )}
              {channel?.listener_count > 0 && (
                <span className="text-sm">
                  {channel.listener_count} {channel.listener_count === 1 ? "listener" : "listeners"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowSettings(true)} aria-label="Channel settings">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Button>
            <Button variant="secondary" onClick={() => setShowPlaylistPicker(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              <span className="hidden sm:inline">Select Source</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--surface-3)",
              }}
            >
              {currentTrack ? (
                <>
                  <div className="flex items-center gap-5 mb-6">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {currentTrack.cover_url ? (
                        <img
                          src={currentTrack.cover_url}
                          alt={currentTrack.title}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <svg className="w-10 h-10 md:w-12 md:h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate">
                        {currentTrack.title}
                      </h2>
                      <p className="text-text-tertiary mt-1 truncate">
                        {currentTrack.artists?.name || "Unknown Artist"}
                      </p>
                      {playbackState?.source_type === "playlist" && (
                        <p className="text-sm text-text-muted mt-2">
                          Playing from playlist
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div
                      className="h-1.5 rounded-full cursor-pointer overflow-hidden"
                      style={{ background: "var(--surface-3)" }}
                      onClick={handleSeek}
                      role="slider"
                      aria-label="Seek"
                      aria-valuemin={0}
                      aria-valuemax={currentTrack.duration_ms}
                      aria-valuenow={currentPosition}
                    >
                      <div
                        className="h-full bg-ember transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-text-muted tabular-nums">
                      <span>{formatTime(currentPosition)}</span>
                      <span>{formatTime(currentTrack.duration_ms)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 md:gap-4">
                    <button
                      onClick={handleShuffle}
                      aria-label={playbackState?.shuffle_enabled ? "Disable shuffle" : "Enable shuffle"}
                      aria-pressed={playbackState?.shuffle_enabled}
                      className={`p-2 md:p-2.5 rounded-lg transition-colors ${
                        playbackState?.shuffle_enabled
                          ? "text-ember bg-ember/10"
                          : "text-text-muted hover:text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                      </svg>
                    </button>

                    <button
                      onClick={handlePlayPause}
                      aria-label={playbackState?.is_playing ? "Pause" : "Play"}
                      className="p-3 md:p-4 rounded-full bg-ember text-white hover:bg-ember/90 transition-colors"
                    >
                      {playbackState?.is_playing ? (
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={handleSkip}
                      aria-label="Skip to next"
                      className="p-2 md:p-2.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                      </svg>
                    </button>

                    <button
                      onClick={handleRepeat}
                      aria-label={`Repeat: ${playbackState?.repeat_mode || "off"}`}
                      aria-pressed={playbackState?.repeat_mode !== "off"}
                      className={`p-2 md:p-2.5 rounded-lg transition-colors ${
                        playbackState?.repeat_mode !== "off"
                          ? "text-ember bg-ember/10"
                          : "text-text-muted hover:text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      {playbackState?.repeat_mode === "one" ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                          <text x="12" y="14" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="bold">1</text>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={
                    <EmptyStateIcon>
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                    </EmptyStateIcon>
                  }
                  title="Nothing playing"
                  description="Select a playlist to start broadcasting"
                  action={
                    <Button variant="primary" onClick={() => setShowPlaylistPicker(true)}>
                      Select Playlist
                    </Button>
                  }
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <QueueManager
              currentTrack={currentTrack}
              priorityQueue={priorityQueue}
              userQueue={userQueue}
              sourceQueue={sourceQueue}
              shuffleEnabled={playbackState?.shuffle_enabled || false}
              repeatMode={playbackState?.repeat_mode || "off"}
              onClearQueue={handleClearQueue}
            />
            <QueueJournal channelSlug={slug} />
            <ScheduleEditor channelSlug={slug} />
          </div>
        </div>
      </div>

      {showPlaylistPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPlaylistPicker(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-sm animate-slide-in-right overflow-auto"
            style={{
              background: "var(--surface-1)",
              borderLeft: "1px solid var(--surface-3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Select Playlist</h2>
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-2"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {playlists.length === 0 ? (
                <EmptyState
                  title="No playlists"
                  description="Create a playlist first"
                />
              ) : (
                <div className="space-y-2">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handlePlayPlaylist(playlist.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors text-left"
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: "var(--surface-3)" }}
                      >
                        {playlist.cover_url ? (
                          <img
                            src={playlist.cover_url}
                            alt={playlist.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{playlist.name}</p>
                        <p className="text-sm text-text-tertiary">
                          {playlist.track_count} {playlist.track_count === 1 ? "track" : "tracks"}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-sm animate-slide-in-right overflow-auto"
            style={{
              background: "var(--surface-1)",
              borderLeft: "1px solid var(--surface-3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Channel Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-2"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div>
                    <p className="font-medium text-text-primary">Visibility</p>
                    <p className="text-sm text-text-tertiary mt-0.5">
                      {channel?.is_public ? "Anyone can join" : "Invite only"}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleVisibility}
                    disabled={isUpdating}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      channel?.is_public ? "bg-ember" : "bg-surface-3"
                    } ${isUpdating ? "opacity-50" : ""}`}
                    role="switch"
                    aria-checked={channel?.is_public}
                    aria-label="Public channel"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        channel?.is_public ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {!channel?.is_public && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-text-primary">Members</h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddMember(true)}>
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add
                      </Button>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-4">
                        No members yet. Add users to grant access.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 rounded-xl"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-text-primary truncate">
                                {member.user.raw_user_meta_data?.display_name || member.user.email}
                              </p>
                              <p className="text-xs text-text-tertiary capitalize">{member.role}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                              aria-label="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Add Member"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="User Email"
            type="email"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            placeholder="user@example.com"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddMember(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddMember}
              disabled={!newMemberEmail.trim() || isUpdating}
            >
              {isUpdating ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
