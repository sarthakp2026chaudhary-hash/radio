"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/utils";
import type { SearchTrackResult } from "@/lib/search/search-tracks";

export interface SongSearchProps {
  placeholder?: string;
  type?: "tracks" | "all";
  hasAudio?: boolean;
  channelSlug?: string;
  /** Admin: open playlist sheet */
  onManagePlaylists?: (track: SearchTrackResult) => void;
  /** Admin: add to channel queue */
  onAddToQueue?: (track: SearchTrackResult) => void;
  /** Listener: request/vote for track on channel */
  onRequest?: (track: SearchTrackResult) => void;
  className?: string;
  autoFocus?: boolean;
}

export function SongSearch({
  placeholder = "Search songs, artists…",
  type = "tracks",
  hasAudio,
  channelSlug,
  onManagePlaylists,
  onAddToQueue,
  onRequest,
  className = "",
  autoFocus = false,
}: SongSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTrackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, type, limit: "15" });
        if (hasAudio !== undefined) params.set("has_audio", hasAudio ? "1" : "0");
        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(data.tracks ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [type, hasAudio]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  useEffect(() => {
    if (!channelSlug || !onRequest) return;
    fetch(`/api/channels/${channelSlug}/votes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.requests) return;
        setVotedIds(new Set(data.requests.filter((r: { user_voted: boolean }) => r.user_voted).map((r: { id: number }) => r.id)));
      })
      .catch(() => {});
  }, [channelSlug, onRequest]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const artistLabel = (track: SearchTrackResult) =>
    track.artists.length ? track.artists.map((a) => a.name).join(", ") : "Unknown";

  const handleRequest = async (track: SearchTrackResult) => {
    if (!channelSlug || !onRequest) return;
    try {
      const res = await fetch(`/api/channels/${channelSlug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: track.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setVotedIds((prev) => {
          const next = new Set(prev);
          if (data.voted) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        onRequest(track);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-1 border border-surface-3 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ember"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-ember animate-pulse" />
        )}
      </div>

      {open && query.length >= 2 && (
        <div
          className="absolute z-50 mt-2 w-full max-h-80 overflow-y-auto rounded-xl shadow-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
        >
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-text-muted">No songs found</p>
          ) : (
            results.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-3/50 border-b border-surface-3/50 last:border-0"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-text-primary truncate">{track.title}</p>
                  <p className="text-xs text-text-tertiary truncate">
                    {artistLabel(track)}
                    {track.duration_ms ? ` · ${formatDuration(track.duration_ms)}` : ""}
                    {!track.has_audio ? " · no audio" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onManagePlaylists && (
                    <button
                      type="button"
                      title="Playlists"
                      onClick={() => {
                        onManagePlaylists(track);
                        setOpen(false);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75v-.008zm0 5.25h.007v.008H3.75v-.008z" />
                      </svg>
                    </button>
                  )}
                  {onAddToQueue && (
                    <button
                      type="button"
                      title="Add to queue"
                      onClick={() => {
                        onAddToQueue(track);
                        setOpen(false);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-ember hover:bg-surface-3"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  )}
                  {onRequest && channelSlug && (
                    <button
                      type="button"
                      title={votedIds.has(track.id) ? "Remove request" : "Request song"}
                      onClick={() => handleRequest(track)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        votedIds.has(track.id)
                          ? "bg-ember/20 text-ember"
                          : "bg-surface-3 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {votedIds.has(track.id) ? "Requested" : "Request"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
