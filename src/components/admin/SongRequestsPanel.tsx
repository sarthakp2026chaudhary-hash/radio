"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

interface SongRequest {
  id: number;
  title: string;
  artist: string | null;
  duration_ms: number;
  vote_count: number;
  has_audio: boolean;
}

interface SongRequestsPanelProps {
  channelSlug: string;
  onAddToQueue: (trackId: number, title: string) => void;
}

export function SongRequestsPanel({ channelSlug, onAddToQueue }: SongRequestsPanelProps) {
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/channels/${channelSlug}/votes`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [channelSlug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
        <p className="text-sm text-text-muted">Loading requests…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Listener requests</h3>
        <button type="button" onClick={refresh} className="text-xs text-text-muted hover:text-text-secondary">
          Refresh
        </button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-text-muted">No song requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center tabular-nums text-ember font-medium">{r.vote_count}</span>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary truncate">{r.title}</p>
                <p className="text-xs text-text-muted truncate">
                  {r.artist ?? "Unknown"}
                  {r.duration_ms ? ` · ${formatDuration(r.duration_ms)}` : ""}
                  {!r.has_audio ? " · no audio" : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs shrink-0"
                onClick={() => onAddToQueue(r.id, r.title)}
              >
                Queue
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
