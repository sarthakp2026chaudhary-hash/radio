"use client";

import type { Track, Artist, TrackArtist } from "@/lib/supabase/types";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { formatDuration } from "@/lib/utils";

interface TrackArtistWithArtist extends TrackArtist {
  artists: Artist;
}

interface TrackRowProps {
  track: Track & {
    artists?: Artist | null;
    track_artists?: TrackArtistWithArtist[];
  };
  onPlay?: () => void;
  onAddToPlaylist?: () => void;
  onEditArtists?: () => void;
  onDelete?: () => void;
}

function formatArtists(track: TrackRowProps["track"]): string {
  if (track.track_artists && track.track_artists.length > 0) {
    const primary = track.track_artists.filter((ta) => ta.role === "primary");
    const featured = track.track_artists.filter((ta) => ta.role === "featured");
    const others = track.track_artists.filter((ta) => !["primary", "featured"].includes(ta.role));

    let result = primary.map((ta) => ta.artists.name).join(", ") || "Unknown Artist";
    if (featured.length > 0) {
      result += ` (feat. ${featured.map((ta) => ta.artists.name).join(", ")})`;
    }
    if (others.length > 0) {
      result += ` [${others.map((ta) => ta.artists.name).join(", ")}]`;
    }
    return result;
  }
  return track.artists?.name || "Unknown Artist";
}

export function TrackRow({ track, onPlay, onAddToPlaylist, onEditArtists, onDelete }: TrackRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-2 transition-colors group">
      <div
        className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ background: "var(--surface-3)" }}
      >
        {track.cover_url ? (
          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary truncate">{track.title}</p>
        <p className="text-sm text-text-tertiary truncate">
          {formatArtists(track)}
          {track.genre && ` • ${track.genre}`}
        </p>
      </div>

      {/* Duration */}
      <span className="text-sm text-text-muted tabular-nums">
        {formatDuration(track.duration_ms)}
      </span>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <Dropdown
          trigger={
            <button className="p-2 rounded-lg hover:bg-surface-3 text-text-muted hover:text-text-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          }
          align="right"
        >
          {onPlay && (
            <DropdownItem
              onClick={onPlay}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              }
            >
              Play
            </DropdownItem>
          )}
          {onAddToPlaylist && (
            <DropdownItem
              onClick={onAddToPlaylist}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Add to Playlist
            </DropdownItem>
          )}
          {onEditArtists && (
            <DropdownItem
              onClick={onEditArtists}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            >
              Edit Artists
            </DropdownItem>
          )}
          {(onPlay || onAddToPlaylist || onEditArtists) && onDelete && <DropdownDivider />}
          {onDelete && (
            <DropdownItem
              onClick={onDelete}
              icon={
                <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
            >
              <span className="text-error">Delete</span>
            </DropdownItem>
          )}
        </Dropdown>
      </div>
    </div>
  );
}
