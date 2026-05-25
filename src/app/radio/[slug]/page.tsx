"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface LoopTrack {
  id: number;
  title: string;
  artist: string | null;
  file_url: string | null;
  cover_url: string | null;
  duration_ms: number;
}
interface LoopData {
  channel: { name: string; slug: string; updated_at: string | null };
  is_playing: boolean;
  loop_count: number;
  current_index: number;
  current_position_ms: number;
  current_track: LoopTrack | null;
  next_track: { id: number; title: string; artist: string | null } | null;
  tracks: LoopTrack[];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

const POLL_MS = 20000;

// Listener view. Once "tuned in", the client plays through the WHOLE loop locally
// — advancing on the audio `ended` event (and natively looping a single-song
// channel) — so it never goes silent between songs. The server is polled only to
// (1) align a fresh listener to the broadcast playhead and (2) pick up changes to
// the loop composition; a poll never restarts the song that's currently playing.
export default function ChannelLoopPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<LoopData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tunedIn, setTunedIn] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [metaOpen, setMetaOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const tracksRef = useRef<LoopTrack[]>([]);
  const indexRef = useRef(0);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tunedInRef = useRef(false);
  const dataRef = useRef<LoopData | null>(null);

  const fetchLoop = useCallback(async (): Promise<LoopData | null> => {
    try {
      const res = await fetch(`/api/channels/${slug}/loop`);
      if (!res.ok) {
        setNotFound(true);
        return null;
      }
      const json = (await res.json()) as LoopData;
      setData(json);
      return json;
    } catch {
      return null; // transient — keep last known state
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchLoop();
    const id = setInterval(fetchLoop, POLL_MS);
    return () => clearInterval(id);
  }, [fetchLoop]);

  const clearSilence = () => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const setMediaSession = useCallback((t: LoopTrack, channelName: string) => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist ?? channelName,
        album: channelName,
        ...(t.cover_url ? { artwork: [{ src: t.cover_url, sizes: "512x512" }] } : {}),
      });
    } catch {
      /* MediaMetadata unsupported — ignore */
    }
  }, []);

  // Imperative player. Reads refs only, so it's stable across renders.
  const playAt = useCallback(
    (i: number, positionMs = 0) => {
      const audio = audioRef.current;
      const tracks = tracksRef.current;
      if (!audio || tracks.length === 0) return;
      const idx = ((i % tracks.length) + tracks.length) % tracks.length;
      indexRef.current = idx;
      setPlayingIndex(idx);
      clearSilence();

      const t = tracks[idx];
      audio.loop = tracks.length === 1 && !!t.file_url;

      if (t.file_url) {
        if (audio.src !== t.file_url) audio.src = t.file_url;
        try {
          audio.currentTime = Math.max(0, positionMs / 1000);
        } catch {
          /* seek may throw before metadata loads — harmless */
        }
        audio.play().catch(() => {});
        setMediaSession(t, dataRef.current?.channel.name ?? "");
      } else {
        // Audioless track: stay silent but keep the loop's timeline moving.
        audio.removeAttribute("src");
        audio.load();
        const remain = Math.max(1000, (t.duration_ms || 180000) - positionMs);
        silenceTimer.current = setTimeout(() => playAt(indexRef.current + 1, 0), remain);
      }
    },
    [setMediaSession]
  );

  // Tune in / out.
  useEffect(() => {
    tunedInRef.current = tunedIn;
    const audio = audioRef.current;
    if (!tunedIn) {
      clearSilence();
      audio?.pause();
      return;
    }
    const d = dataRef.current;
    if (d) {
      tracksRef.current = d.tracks || [];
      playAt(d.current_index || 0, d.current_position_ms || 0);
    }
  }, [tunedIn, playAt]);

  // Resync from each poll — but never restart the song currently playing.
  useEffect(() => {
    if (!data) return;
    dataRef.current = data;
    if (!tunedInRef.current) return;

    const oldTracks = tracksRef.current;
    const newTracks = data.tracks || [];
    const sameComposition =
      oldTracks.map((t) => t.id).join(",") === newTracks.map((t) => t.id).join(",");
    if (sameComposition) {
      tracksRef.current = newTracks; // refresh fields (e.g. a file_url appeared) without restarting
      return;
    }
    const playingId = oldTracks[indexRef.current]?.id;
    tracksRef.current = newTracks;
    const stillThere = newTracks.findIndex((t) => t.id === playingId);
    if (stillThere >= 0) {
      indexRef.current = stillThere;
      setPlayingIndex(stillThere); // keep playing the same song, new position in the order
    } else {
      playAt(data.current_index || 0, data.current_position_ms || 0);
    }
  }, [data, playAt]);

  // Cleanup on unmount.
  useEffect(() => () => clearSilence(), []);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading…</span>
        </div>
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <p className="text-text-secondary">Channel not found.</p>
      </main>
    );
  }

  const localTrack = tunedIn ? tracksRef.current[playingIndex] ?? null : null;
  const shown = localTrack ?? data.current_track;
  const shownNext =
    tunedIn && tracksRef.current.length
      ? tracksRef.current[(playingIndex + 1) % tracksRef.current.length]
      : data.next_track;
  const anyAudio = (data.tracks || []).some((t) => t.file_url) || !!data.current_track?.file_url;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-void px-6 py-10">
      <audio ref={audioRef} onEnded={() => playAt(indexRef.current + 1, 0)} />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at 50% 70%, var(--ember-subtle, rgba(255,107,53,0.16)) 0%, transparent 55%)" }}
        />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-2 h-2 rounded-full ${data.is_playing ? "bg-green-500 animate-pulse" : "bg-text-muted"}`} />
          <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary">
            {data.is_playing ? "On air" : "Paused"}
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-text-primary mb-6">{data.channel.name}</h1>

        {/* Now-playing card */}
        <div className="w-full rounded-3xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
          <div
            className="relative w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: shown?.cover_url
                ? `center / cover no-repeat url(${shown.cover_url})`
                : "linear-gradient(140deg, var(--surface-3) 0%, var(--surface-2) 55%, rgba(255,107,53,0.25) 140%)",
            }}
          >
            {!shown?.cover_url && (
              <svg className="w-16 h-16 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l11-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {tunedIn && shown?.file_url && (
              <span className="absolute bottom-3 left-3 flex items-end gap-[3px] h-4" aria-hidden>
                <span className="w-[3px] bg-ember animate-[pulse_1s_ease-in-out_infinite] h-2" />
                <span className="w-[3px] bg-ember animate-[pulse_1.3s_ease-in-out_infinite] h-4" />
                <span className="w-[3px] bg-ember animate-[pulse_0.8s_ease-in-out_infinite] h-3" />
              </span>
            )}
          </div>

          <div className="mt-4 min-h-[2.5rem]">
            <p className="text-lg font-semibold text-text-primary truncate" title={shown?.title ?? undefined}>
              {shown?.title ?? "Nothing playing"}
            </p>
            <p className="text-sm text-text-tertiary truncate">{shown?.artist ?? "—"}</p>
          </div>
        </div>

        {/* Meta cluster — loop count is the always-visible "this is live/fresh" signal;
            next song + updated-at reveal on hover (desktop) or tap (mobile). */}
        <div
          className="relative mt-5"
          onMouseEnter={() => setMetaOpen(true)}
          onMouseLeave={() => setMetaOpen(false)}
        >
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-text-secondary transition-colors hover:text-text-primary"
            style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
            aria-expanded={metaOpen}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${data.is_playing ? "bg-green-500" : "bg-text-muted"}`} />
            <span className="tabular-nums font-medium text-text-primary">{data.loop_count}</span>
            <span className="text-text-tertiary">song{data.loop_count === 1 ? "" : "s"} on loop</span>
            <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${metaOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {metaOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 rounded-2xl p-4 text-left z-10 shadow-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
            >
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Up next</div>
              <div className="mt-0.5 text-sm text-text-secondary truncate">{shownNext?.title ?? "—"}</div>
              <div className="mt-3 text-[11px] uppercase tracking-wide text-text-muted">Updated</div>
              <div className="mt-0.5 text-sm text-text-secondary">{relativeTime(data.channel.updated_at)}</div>
            </div>
          )}
        </div>

        {anyAudio && (
          <button
            onClick={() => setTunedIn((v) => !v)}
            className={`mt-7 px-8 py-3 rounded-full font-medium transition-opacity hover:opacity-90 ${
              tunedIn ? "text-text-secondary" : "bg-ember text-white"
            }`}
            style={tunedIn ? { border: "1px solid var(--surface-3)", background: "var(--surface-1)" } : undefined}
          >
            {tunedIn ? "Stop" : "Tune in"}
          </button>
        )}
        {!anyAudio && <p className="mt-7 text-xs text-text-muted">No audio on this loop yet.</p>}
      </div>
    </main>
  );
}
