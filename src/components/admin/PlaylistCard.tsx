"use client";

import Link from "next/link";
import type { Playlist } from "@/lib/supabase/types";
import { Badge } from "@/components/ui";
import { formatDurationLong } from "@/lib/utils";

interface PlaylistCardProps {
  playlist: Playlist & { track_count: number; total_duration_ms: number };
  onDelete?: () => void;
}

export function PlaylistCard({ playlist, onDelete }: PlaylistCardProps) {
  return (
    <Link
      href={`/admin/playlists/${playlist.id}`}
      className="block rounded-2xl p-5 transition-all hover:scale-[1.02] group"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Cover */}
        <div
          className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--surface-2)" }}
        >
          {playlist.cover_url ? (
            <img
              src={playlist.cover_url}
              alt={playlist.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate group-hover:text-ember transition-colors">
            {playlist.name}
          </h3>
          {playlist.description && (
            <p className="text-sm text-text-tertiary line-clamp-1 mt-0.5">{playlist.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={playlist.track_count > 0 ? "ember" : "default"}>
              {playlist.track_count} {playlist.track_count === 1 ? "track" : "tracks"}
            </Badge>
            {playlist.total_duration_ms > 0 && (
              <span className="text-xs text-text-muted">
                {formatDurationLong(playlist.total_duration_ms)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}
