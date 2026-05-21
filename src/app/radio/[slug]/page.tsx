"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AudioSyncEngine, type SyncStatus } from "@/lib/sync";
import { LiveBanner } from "@/components/radio/LiveIndicator";
import { useHostPresence } from "@/hooks/useHostPresence";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useListeningRecorder } from "@/hooks/useListeningStats";
import { AddToLibrary } from "@/components/radio/AddToLibrary";
import { formatDuration } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface User {
  id: number;
  display_name: string;
  is_host: boolean;
  is_host_listener: boolean;
}

interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
}

interface Track {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  file_url: string | null;
  artists: { id: number; name: string } | null;
}

interface ChannelState {
  channel_id: number;
  current_track_id: number | null;
  is_playing: boolean;
  playback_started_at: string | null;
  position_ms: number;
  broadcast_mode: "automated" | "live";
  current_track: Track | null;
}

export default function ChannelRadioPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [user, setUser] = useState<User | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelState, setChannelState] = useState<ChannelState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [isLoading, setIsLoading] = useState(true);
  const [audioStarted, setAudioStarted] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const syncEngineRef = useRef<AudioSyncEngine | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const { startListening, stopListening } = useHostPresence(channel?.id);
  const { startTracking, completeTrack, stopTracking } = useListeningRecorder(channel?.id);

  useColorScheme();

  const fetchChannelData = useCallback(async () => {
    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, display_name, is_host, is_host_listener")
      .eq("auth_id", authUser.id)
      .single();

    if (profile) {
      setUser(profile as User);
    }

    const res = await fetch(`/api/channels/${slug}`);
    const data = await res.json();

    if (!res.ok || !data.channel) {
      router.push("/radio");
      return;
    }

    setChannel(data.channel);
    setChannelState(data.channel.channel_state);
    setIsLoading(false);
  }, [slug, router]);

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  useEffect(() => {
    if (!channel) return;

    const supabase = createClient();
    subscriptionRef.current = supabase
      .channel(`channel_state:${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_state",
          filter: `channel_id=eq.${channel.id}`,
        },
        async () => {
          const res = await fetch(`/api/channels/${slug}/playback`);
          const data = await res.json();
          if (data.state) {
            setChannelState(data.state);
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [channel, slug]);

  useEffect(() => {
    if (!user?.is_host_listener || !channel) return;

    startListening(channel.id);

    return () => {
      stopListening();
    };
  }, [user?.is_host_listener, channel, startListening, stopListening]);

  useEffect(() => {
    if (!channelState?.is_playing || !channelState.playback_started_at) {
      setCurrentPosition(channelState?.position_ms || 0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - new Date(channelState.playback_started_at!).getTime();
      setCurrentPosition((channelState.position_ms || 0) + elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [channelState?.is_playing, channelState?.playback_started_at, channelState?.position_ms]);

  const handleStartAudio = async () => {
    if (!audioRef.current || !channelState?.current_track?.file_url) return;

    try {
      audioRef.current.src = channelState.current_track.file_url;

      syncEngineRef.current = new AudioSyncEngine({
        onSyncStatus: setSyncStatus,
      });

      await syncEngineRef.current.initialize(audioRef.current);

      syncEngineRef.current.onPlaybackStateChange({
        is_playing: channelState.is_playing,
        playback_started_at: channelState.playback_started_at,
        position_at_timestamp: channelState.position_ms,
        current_track_id: channelState.current_track_id,
        volume: 1,
      });

      await audioRef.current.play();
      setAudioStarted(true);
    } catch (err) {
      console.error("Failed to start audio:", err);
    }
  };

  const prevTrackIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioStarted || !channelState?.current_track?.file_url || !audioRef.current) return;

    const currentSrc = audioRef.current.src;
    const newSrc = channelState.current_track.file_url;

    if (currentSrc !== newSrc) {
      if (prevTrackIdRef.current && prevTrackIdRef.current !== channelState.current_track_id) {
        completeTrack();
      }
      if (channelState.current_track_id) {
        startTracking(channelState.current_track_id);
        prevTrackIdRef.current = channelState.current_track_id;
      }
      audioRef.current.src = newSrc;
      audioRef.current.play().catch(console.error);
    }

    syncEngineRef.current?.onPlaybackStateChange({
      is_playing: channelState.is_playing,
      playback_started_at: channelState.playback_started_at,
      position_at_timestamp: channelState.position_ms,
      current_track_id: channelState.current_track_id,
      volume: 1,
    });
  }, [audioStarted, channelState, startTracking, completeTrack]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading...</span>
        </div>
      </main>
    );
  }

  const track = channelState?.current_track;
  const progress = track ? (currentPosition / track.duration_ms) * 100 : 0;

  return (
    <main className="relative min-h-screen flex flex-col bg-void">
      <LiveBanner channelId={channel?.id} />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse at 50% 80%, var(--ember-subtle) 0%, transparent 50%)`,
          }}
        />
      </div>

      <audio ref={audioRef} />

      <div className="relative flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium text-text-primary">{channel?.name}</h1>
          {channel?.description && (
            <p className="text-sm text-text-tertiary mt-1">{channel.description}</p>
          )}
          {channelState?.broadcast_mode === "live" && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {track ? (
          <div className="flex flex-col items-center">
            <div
              className="w-64 h-64 md:w-80 md:h-80 rounded-2xl flex items-center justify-center mb-8 shadow-2xl"
              style={{ background: "var(--surface-1)" }}
            >
              {track.cover_url ? (
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <svg className="w-24 h-24 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
              )}
            </div>

            <h2 className="text-2xl font-semibold text-text-primary text-center">{track.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-text-tertiary">{track.artists?.name || "Unknown Artist"}</p>
              <AddToLibrary trackId={track.id} channelId={channel?.id} size="sm" />
            </div>

            <div className="w-full max-w-sm mt-6">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--surface-3)" }}
              >
                <div
                  className="h-full bg-ember transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-muted tabular-nums">
                <span>{formatDuration(currentPosition)}</span>
                <span>{formatDuration(track.duration_ms)}</span>
              </div>
            </div>

            {!audioStarted && track?.file_url && (
              <button
                onClick={handleStartAudio}
                className="mt-8 px-8 py-3 rounded-full bg-ember text-white font-medium hover:bg-ember/90 transition-colors"
              >
                Start Listening
              </button>
            )}

            {!track?.file_url && (
              <p className="mt-6 text-sm text-text-muted italic">Audio not available yet</p>
            )}

            {audioStarted && (
              <div className="mt-6 flex items-center gap-2 text-sm text-text-tertiary">
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === "synced" ? "bg-green-500" :
                    syncStatus === "syncing" ? "bg-yellow-500 animate-pulse" :
                    "bg-red-500"
                  }`}
                />
                {syncStatus === "synced" ? "Synced" : syncStatus === "syncing" ? "Syncing..." : "Out of sync"}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div
              className="w-32 h-32 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-1)" }}
            >
              <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <p className="text-text-secondary">Nothing playing right now</p>
            <p className="text-sm text-text-muted mt-1">Check back later</p>
          </div>
        )}
      </div>

      <div className="relative p-4 flex justify-center">
        <button
          onClick={() => router.push("/radio")}
          className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          ← Back to channels
        </button>
      </div>
    </main>
  );
}
