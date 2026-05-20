"use client";

import { useTrackStats, useArtistStats } from "@/hooks/useListeningStats";

interface TrackPlayCountProps {
  trackId: number;
  showHostPlays?: boolean;
  size?: "sm" | "md";
}

export function TrackPlayCount({ trackId, showHostPlays = true, size = "sm" }: TrackPlayCountProps) {
  const { stats, isLoading } = useTrackStats(trackId);

  if (isLoading || !stats || stats.totalPlays === 0) return null;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
  };

  return (
    <span className={`text-text-muted ${sizeClasses[size]} flex items-center gap-1`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{stats.totalPlays}</span>
      {showHostPlays && stats.hostPlays > 0 && (
        <span className="text-ember">({stats.hostPlays} by you)</span>
      )}
    </span>
  );
}

interface ArtistPlayCountProps {
  artistId: number;
  size?: "sm" | "md";
}

export function ArtistPlayCount({ artistId, size = "sm" }: ArtistPlayCountProps) {
  const { stats, isLoading } = useArtistStats(artistId);

  if (isLoading || !stats || stats.totalPlays === 0) return null;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
  };

  return (
    <span className={`text-text-muted ${sizeClasses[size]} flex items-center gap-1`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{stats.totalPlays} plays</span>
      <span className="text-text-tertiary">• {stats.trackCount} tracks</span>
    </span>
  );
}

interface PlayStatsDetailProps {
  trackId: number;
}

export function PlayStatsDetail({ trackId }: PlayStatsDetailProps) {
  const { stats, isLoading } = useTrackStats(trackId);

  if (isLoading) {
    return (
      <div className="animate-pulse h-12 bg-surface-2 rounded-lg" />
    );
  }

  if (!stats || stats.totalPlays === 0) {
    return (
      <div className="text-sm text-text-muted">
        No plays yet
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-tertiary">Total Plays</span>
        <span className="font-semibold text-text-primary">{stats.totalPlays}</span>
      </div>
      {stats.hostPlays > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-tertiary">Your Plays</span>
          <span className="font-semibold text-ember">{stats.hostPlays}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-tertiary">Last Played</span>
        <span className="text-sm text-text-secondary">{formatDate(stats.lastPlayedAt)}</span>
      </div>
    </div>
  );
}
