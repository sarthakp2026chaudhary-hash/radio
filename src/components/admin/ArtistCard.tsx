"use client";

import type { Artist, Track } from "@/lib/supabase/types";
import { Badge } from "@/components/ui";

interface ArtistCardProps {
  artist: Artist & { tracks?: Track[] };
  isSelected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ArtistCard({ artist, isSelected, onClick, onEdit, onDelete }: ArtistCardProps) {
  const trackCount = artist.tracks?.length || 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-2xl cursor-pointer transition-all
        ${isSelected ? "ring-2 ring-ember" : "hover:bg-surface-2"}
      `}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--surface-2)" }}
        >
          {artist.image_url ? (
            <img
              src={artist.image_url}
              alt={artist.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <span className="text-xl font-semibold text-text-secondary">
              {artist.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate">{artist.name}</h3>
          {artist.bio && (
            <p className="text-sm text-text-tertiary line-clamp-1 mt-0.5">{artist.bio}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={trackCount > 0 ? "ember" : "default"}>
              {trackCount} {trackCount === 1 ? "track" : "tracks"}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-2 h-2 rounded-full bg-ember" />
        </div>
      )}
    </div>
  );
}
