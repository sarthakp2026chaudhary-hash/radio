"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AudioSyncEngine, type PlaybackState, type SyncStatus } from "@/lib/sync";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { NextSongPreview } from "@/components/radio/NextSongPreview";
import { RecommendationCircles } from "@/components/radio/RecommendationCircles";
import { ReactButton } from "@/components/radio/ReactButton";
import { useReactionChannel } from "@/hooks/useReactionChannel";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface User {
  id: number;
  display_name: string;
  avatar_url: string | null;
  is_host: boolean;
}

interface FriendMessage {
  welcome_title: string;
  welcome_subtitle: string;
  custom_color: string | null;
}

interface Track {
  id: number;
  title: string;
  artist: string | null;
  cover_url: string | null;
  duration_ms: number;
  drive_file_id: string;
}

interface VoteableTrack {
  id: number;
  title: string;
  artist: string | null;
  voteCount: number;
}

export default function RadioPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [friendMessage, setFriendMessage] = useState<FriendMessage | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [isLoading, setIsLoading] = useState(true);
  const [audioStarted, setAudioStarted] = useState(false);
  const [voteableTracks, setVoteableTracks] = useState<VoteableTrack[]>([]);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [nextTrack, setNextTrack] = useState<{ title: string; artist: string | null } | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const syncEngineRef = useRef<AudioSyncEngine | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const votesChannelRef = useRef<RealtimeChannel | null>(null);

  // Reaction channel for sending stickers
  const { sendSticker } = useReactionChannel();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Fetch user profile
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", authUser.id)
        .single() as { data: User | null };

      if (profile) {
        setUser(profile as User);

        // Fetch personalized welcome message (if exists)
        const { data: message } = await supabase
          .from("friend_messages")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle() as { data: FriendMessage | null };

        if (message) {
          setFriendMessage(message as FriendMessage);
        }
      }

      // Fetch current playback state
      const { data: state } = await supabase
        .from("playback_state")
        .select("*")
        .eq("id", 1)
        .single() as { data: PlaybackState | null };

      if (state) {
        setPlaybackState(state as PlaybackState);

        // Fetch current track if playing
        if (state.current_track_id) {
          const { data: track } = await supabase
            .from("tracks")
            .select("*")
            .eq("id", state.current_track_id)
            .single() as { data: Track | null };

          if (track) {
            setCurrentTrack(track as Track);
          }
        }
      }

      setIsLoading(false);

      // Subscribe to realtime playback changes (only if not already subscribed)
      if (!channelRef.current) {
        channelRef.current = supabase
          .channel("playback")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "playback_state",
              filter: "id=eq.1",
            },
            async (payload) => {
              const newState = payload.new as PlaybackState & { current_track_id: number | null };
              setPlaybackState(newState);

              // Update sync engine
              if (syncEngineRef.current) {
                syncEngineRef.current.onPlaybackStateChange(newState);
              }

              // Fetch new track if changed
              if (newState.current_track_id) {
                const { data: track } = await supabase
                  .from("tracks")
                  .select("*")
                  .eq("id", newState.current_track_id)
                  .single();

                if (track) {
                  setCurrentTrack(track);
                }
              } else {
                setCurrentTrack(null);
              }
            }
          )
          .subscribe();
      }
    }

    init();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (votesChannelRef.current) {
        votesChannelRef.current.unsubscribe();
        votesChannelRef.current = null;
      }
      syncEngineRef.current?.destroy();
    };
  }, []);

  // Initialize sync engine when audio element is ready
  useEffect(() => {
    if (audioRef.current && !syncEngineRef.current) {
      syncEngineRef.current = new AudioSyncEngine({
        onSyncStatus: setSyncStatus,
      });
      syncEngineRef.current.initialize(audioRef.current);
    }
  }, []);

  // Fetch next track based on queue
  useEffect(() => {
    async function fetchNextTrack() {
      const supabase = createClient();
      const { data: state } = await supabase
        .from("playback_state")
        .select("queue_track_ids, queue_position")
        .eq("id", 1)
        .single() as { data: { queue_track_ids: number[] | null; queue_position: number | null } | null };

      if (!state?.queue_track_ids?.length) {
        setNextTrack(null);
        return;
      }

      const nextPosition = (state.queue_position ?? 0) + 1;
      if (nextPosition >= state.queue_track_ids.length) {
        setNextTrack(null);
        return;
      }

      const nextTrackId = state.queue_track_ids[nextPosition];
      const { data: track } = await supabase
        .from("tracks")
        .select("title, artist")
        .eq("id", nextTrackId)
        .single() as { data: { title: string; artist: string | null } | null };

      setNextTrack(track);
    }

    if (playbackState?.is_playing) {
      fetchNextTrack();
    }
  }, [playbackState?.current_track_id, playbackState?.is_playing]);

  // Pass playback state to sync engine when state changes or audio starts
  useEffect(() => {
    if (syncEngineRef.current && playbackState && audioStarted) {
      syncEngineRef.current.onPlaybackStateChange(playbackState);
    }
  }, [playbackState, audioStarted]);

  // Direct pause/resume handling (works alongside sync engine)
  useEffect(() => {
    if (!audioRef.current || !audioStarted) return;

    const audio = audioRef.current;

    if (playbackState?.is_playing) {
      // Resume: seek to saved position and play
      if (audio.paused) {
        const positionSec = (playbackState.position_at_timestamp || 0) / 1000;
        if (positionSec > 0 && Math.abs(audio.currentTime - positionSec) > 1) {
          audio.currentTime = positionSec;
        }
        audio.play().catch(console.error);
      }
    } else {
      // Pause
      if (!audio.paused) {
        audio.pause();
        // Seek to the paused position
        const positionSec = (playbackState?.position_at_timestamp || 0) / 1000;
        if (positionSec > 0) {
          audio.currentTime = positionSec;
        }
      }
    }
  }, [playbackState?.is_playing, playbackState?.position_at_timestamp, audioStarted]);

  // Set audio source when track changes
  useEffect(() => {
    if (audioRef.current && currentTrack?.drive_file_id) {
      const streamUrl = `/api/drive/stream/${currentTrack.drive_file_id}`;
      if (audioRef.current.src !== window.location.origin + streamUrl) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();

        // If audio was already started and should be playing, play it
        if (audioStarted && playbackState?.is_playing) {
          audioRef.current.play().catch(console.error);
        }
      }
    }
  }, [currentTrack?.drive_file_id, audioStarted, playbackState?.is_playing]);

  // Fetch voteable tracks when folder changes
  const fetchVoteableTracks = async () => {
    try {
      const response = await fetch("/api/votes");
      const data = await response.json();
      if (data.tracks) {
        setVoteableTracks(data.tracks);
        setCurrentFolderId(data.currentFolderId);
      }
    } catch (err) {
      console.error("Failed to fetch voteable tracks:", err);
    }
  };

  // Fetch user's existing votes
  const fetchUserVotes = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: votes } = await supabase
      .from("track_votes")
      .select("track_id")
      .eq("user_id", user.id);

    if (votes) {
      setUserVotes(new Set(votes.map((v: { track_id: number }) => v.track_id)));
    }
  };

  // Subscribe to vote changes
  useEffect(() => {
    if (!currentFolderId) return;

    const supabase = createClient();

    if (votesChannelRef.current) {
      votesChannelRef.current.unsubscribe();
    }

    votesChannelRef.current = supabase
      .channel("votes-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "track_votes",
          filter: `folder_id=eq.${currentFolderId}`,
        },
        () => {
          fetchVoteableTracks();
        }
      )
      .subscribe();

    return () => {
      if (votesChannelRef.current) {
        votesChannelRef.current.unsubscribe();
        votesChannelRef.current = null;
      }
    };
  }, [currentFolderId]);

  // Fetch votes when playback state changes (folder might have changed)
  useEffect(() => {
    if (playbackState?.is_playing) {
      fetchVoteableTracks();
      fetchUserVotes();
    }
  }, [playbackState?.is_playing, playbackState?.current_track_id, user]);

  // Vote for a track
  const toggleVote = async (trackId: number) => {
    const hasVoted = userVotes.has(trackId);

    try {
      if (hasVoted) {
        await fetch("/api/votes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        });
        setUserVotes((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      } else {
        await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        });
        setUserVotes((prev) => new Set(prev).add(trackId));
      }
      fetchVoteableTracks();
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  // Start audio playback (requires user interaction)
  const startAudio = async () => {
    if (!audioRef.current || !currentTrack?.drive_file_id) return;

    try {
      const streamUrl = `/api/drive/stream/${currentTrack.drive_file_id}`;

      // Always set source to ensure it's correct (handles "Leave Broadcast" -> rejoin)
      if (!audioRef.current.src.includes(currentTrack.drive_file_id)) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
      }

      await audioRef.current.play();
      setAudioStarted(true);

      // Record attendance for today's broadcast
      fetch("/api/history/attendance", { method: "POST" }).catch(console.error);

      // Sync to current position
      if (syncEngineRef.current && playbackState) {
        syncEngineRef.current.onPlaybackStateChange(playbackState);
      }
    } catch (err) {
      console.error("Failed to start audio:", err);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading radio...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col bg-void">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at 50% 80%, var(--ember-subtle) 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-surface-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              playbackState?.is_playing ? "bg-success animate-pulse" : "bg-text-muted"
            }`}
          />
          <span className="text-text-secondary text-sm">
            {playbackState?.is_playing ? "Live" : "Offline"}
          </span>
        </div>

        <Dropdown
          trigger={
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
              <span className="text-text-secondary text-sm">{user?.display_name}</span>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-8 h-8 rounded-full border border-surface-3"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
                  <span className="text-text-secondary text-sm font-medium">
                    {user?.display_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          }
          align="right"
        >
          <DropdownItem
            onClick={() => router.push("/history")}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            My History
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
              }
              setAudioStarted(false);
            }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
            }
          >
            Leave Broadcast
          </DropdownItem>
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
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Welcome message */}
        {friendMessage && (
          <div className="text-center mb-12 animate-fade-in">
            <h1
              className="text-3xl md:text-4xl font-semibold mb-2"
              style={{
                fontFamily: "var(--font-playfair)",
                color: friendMessage.custom_color || "var(--text-primary)",
              }}
            >
              {friendMessage.welcome_title}
            </h1>
            <p
              className="text-xl md:text-2xl text-ember"
              style={{ fontFamily: "var(--font-caveat)" }}
            >
              {friendMessage.welcome_subtitle}
            </p>
          </div>
        )}

        {/* Now Playing */}
        {currentTrack ? (
          <div
            className="w-full max-w-md p-8 rounded-3xl text-center"
            style={{
              background: "var(--surface-1)",
              boxShadow: "var(--shadow-4)",
            }}
          >
            {/* Album art */}
            <div className="relative mx-auto w-48 h-48 md:w-64 md:h-64 mb-8">
              {currentTrack.cover_url ? (
                <img
                  src={currentTrack.cover_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover rounded-2xl"
                  style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
                />
              ) : (
                <div
                  className="w-full h-full rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--surface-2)" }}
                >
                  <svg
                    className="w-16 h-16 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>
              )}

              {/* Playing indicator */}
              {playbackState?.is_playing && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-ember rounded-full animate-wave"
                      style={{
                        height: "16px",
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Track info */}
            <h2 className="text-xl font-semibold text-text-primary mb-1">
              {currentTrack.title}
            </h2>
            <p className="text-text-secondary">{currentTrack.artist || "Unknown Artist"}</p>


            {/* Join button or sync status */}
            {!audioStarted && playbackState?.is_playing ? (
              <button
                onClick={startAudio}
                className="mt-6 px-8 py-3 rounded-xl font-medium transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: "var(--ember)",
                  color: "var(--void)",
                  boxShadow: "0 0 20px var(--ember-subtle)",
                }}
              >
                Join Broadcast
              </button>
            ) : (
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-tertiary">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === "synced"
                      ? "bg-success"
                      : syncStatus === "syncing"
                      ? "bg-warning animate-pulse"
                      : syncStatus === "drifted"
                      ? "bg-warning"
                      : "bg-error"
                  }`}
                />
                <span>
                  {syncStatus === "synced"
                    ? "In sync"
                    : syncStatus === "syncing"
                    ? "Syncing..."
                    : syncStatus === "drifted"
                    ? "Resyncing..."
                    : "Offline"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-48 h-48 mx-auto mb-8 rounded-2xl bg-surface-1 flex items-center justify-center">
              <svg
                className="w-16 h-16 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.536 8.464a5 5 0 010 7.072M12 12h.01M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728"
                />
              </svg>
            </div>
            <p className="text-text-secondary text-lg">Waiting for host to play something...</p>
            <p
              className="text-ember mt-2"
              style={{ fontFamily: "var(--font-caveat)" }}
            >
              Check back soon!
            </p>
          </div>
        )}

        {/* Next Song Preview */}
        {audioStarted && nextTrack && (
          <NextSongPreview nextTrack={nextTrack} />
        )}

        {/* Recommendation Circles (subtle voting) */}
        {audioStarted && voteableTracks.length > 0 && (
          <RecommendationCircles
            tracks={voteableTracks}
            userVotes={userVotes}
            onVote={toggleVote}
          />
        )}
      </div>

      {/* React Button (floating sticker picker) */}
      {audioStarted && (
        <ReactButton
          onSend={(stickerId, label) => {
            if (user) {
              sendSticker(label, user.display_name, user.id);
            }
          }}
        />
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </main>
  );
}
