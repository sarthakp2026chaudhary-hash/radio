"use client";

import type { Track, Artist, RepeatMode } from "@/lib/supabase/types";
import { formatDuration } from "@/lib/utils";

interface QueueItem {
  id: number;
  track: Track & { artists?: Artist | null };
  queueType: "priority" | "user" | "source";
}

interface QueueManagerProps {
  currentTrack: (Track & { artists?: Artist | null }) | null;
  priorityQueue: QueueItem[];
  userQueue: QueueItem[];
  sourceQueue: QueueItem[];
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  onRemoveFromQueue?: (trackId: number, queueType: "priority" | "user") => void;
  onClearQueue?: () => void;
}

function QueueSection({
  title,
  items,
  type,
  onRemove,
}: {
  title: string;
  items: QueueItem[];
  type: "priority" | "user" | "source";
  onRemove?: (trackId: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div
            key={`${type}-${item.id}-${index}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 group"
          >
            <span className="w-5 text-center text-xs text-text-muted tabular-nums">
              {index + 1}
            </span>
            <div
              className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
              style={{ background: "var(--surface-3)" }}
            >
              {item.track.cover_url ? (
                <img
                  src={item.track.cover_url}
                  alt={item.track.title}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{item.track.title}</p>
              <p className="text-xs text-text-tertiary truncate">
                {item.track.artists?.name || "Unknown Artist"}
              </p>
            </div>
            <span className="text-xs text-text-muted tabular-nums">
              {formatDuration(item.track.duration_ms)}
            </span>
            {type !== "source" && onRemove && (
              <button
                onClick={() => onRemove(item.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QueueManager({
  currentTrack,
  priorityQueue,
  userQueue,
  sourceQueue,
  shuffleEnabled,
  repeatMode,
  onRemoveFromQueue,
  onClearQueue,
}: QueueManagerProps) {
  const hasQueue = priorityQueue.length > 0 || userQueue.length > 0;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Queue</h3>
        <div className="flex items-center gap-2">
          {shuffleEnabled && (
            <span className="text-xs text-ember flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
              </svg>
              Shuffle
            </span>
          )}
          {repeatMode !== "off" && (
            <span className="text-xs text-ember flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {repeatMode === "one" ? "Repeat One" : "Repeat All"}
            </span>
          )}
          {hasQueue && onClearQueue && (
            <button
              onClick={onClearQueue}
              className="text-xs text-text-muted hover:text-error transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {currentTrack && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Now Playing
          </h4>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-ember/10 border border-ember/20">
            <div
              className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: "var(--surface-3)" }}
            >
              {currentTrack.cover_url ? (
                <img
                  src={currentTrack.cover_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary truncate">{currentTrack.title}</p>
              <p className="text-sm text-text-tertiary truncate">
                {currentTrack.artists?.name || "Unknown Artist"}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        </div>
      )}

      <QueueSection
        title="Play Next"
        items={priorityQueue}
        type="priority"
        onRemove={onRemoveFromQueue ? (id) => onRemoveFromQueue(id, "priority") : undefined}
      />

      <QueueSection
        title="Added to Queue"
        items={userQueue}
        type="user"
        onRemove={onRemoveFromQueue ? (id) => onRemoveFromQueue(id, "user") : undefined}
      />

      <QueueSection
        title="Up Next from Source"
        items={sourceQueue.slice(0, 10)}
        type="source"
      />

      {!currentTrack && priorityQueue.length === 0 && userQueue.length === 0 && sourceQueue.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-sm">No tracks in queue</p>
          <p className="text-xs mt-1">Select a playlist to start playing</p>
        </div>
      )}
    </div>
  );
}
