"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface LoopData {
  channel: { name: string; slug: string; updated_at: string | null };
  is_playing: boolean;
  loop_count: number;
  current_position_ms: number;
  current_track: { id: number; title: string; file_url: string | null; duration_ms: number } | null;
  next_track: { id: number; title: string } | null;
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

const POLL_MS = 15000;

// Minimal, audio-optional listener view. Deliberately shows only:
//   (1) number of songs on loop, (2) channel updated-at, (3) next song.
// The currently-playing song's name/artist is intentionally NOT shown.
export default function ChannelLoopPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<LoopData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tunedIn, setTunedIn] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentIdRef = useRef<number | null>(null);

  const fetchLoop = useCallback(async () => {
    try {
      const res = await fetch(`/api/channels/${slug}/loop`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = (await res.json()) as LoopData;
      setData(json);
    } catch {
      // transient network error — keep the last known state
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchLoop();
    const id = setInterval(fetchLoop, POLL_MS);
    return () => clearInterval(id);
  }, [fetchLoop]);

  // Optional audio: only when tuned in AND the current song actually has a file.
  // Audioless songs simply produce no sound while the loop advances on its timer.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!tunedIn) {
      audio.pause();
      return;
    }
    const cur = data?.current_track;
    if (!cur?.file_url) {
      audio.pause();
      return;
    }
    if (currentIdRef.current !== cur.id) {
      currentIdRef.current = cur.id;
      audio.src = cur.file_url;
      audio.currentTime = Math.max(0, (data?.current_position_ms ?? 0) / 1000);
      audio.play().catch(() => {});
    }
  }, [tunedIn, data]);

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

  const hasAudio = !!data.current_track?.file_url;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-void p-8">
      <audio ref={audioRef} />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at 50% 75%, var(--ember-subtle, rgba(255,107,53,0.15)) 0%, transparent 55%)" }}
        />
      </div>

      <div className="relative w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${data.is_playing ? "bg-green-500 animate-pulse" : "bg-text-muted"}`} />
          <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary">
            {data.is_playing ? "On air" : "Paused"}
          </span>
        </div>

        <h1 className="text-3xl font-semibold text-text-primary">{data.channel.name}</h1>

        <div className="mt-10 flex flex-col gap-4">
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)" }}>
            <div className="text-5xl font-semibold text-ember tabular-nums">{data.loop_count}</div>
            <div className="mt-1 text-sm text-text-tertiary">
              song{data.loop_count === 1 ? "" : "s"} on loop
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 rounded-2xl p-4 text-left" style={{ background: "var(--surface-1)" }}>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Updated</div>
              <div className="mt-1 text-sm text-text-secondary">{relativeTime(data.channel.updated_at)}</div>
            </div>
            <div className="flex-1 rounded-2xl p-4 text-left overflow-hidden" style={{ background: "var(--surface-1)" }}>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Up next</div>
              <div className="mt-1 text-sm text-text-secondary truncate">{data.next_track?.title ?? "—"}</div>
            </div>
          </div>
        </div>

        {hasAudio && (
          <button
            onClick={() => setTunedIn((v) => !v)}
            className="mt-10 px-8 py-3 rounded-full bg-ember text-white font-medium hover:opacity-90 transition-opacity"
          >
            {tunedIn ? "Stop" : "Tune in"}
          </button>
        )}
      </div>
    </main>
  );
}
