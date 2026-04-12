"use client";

import { useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { useLongPress } from "@/hooks/useLongPress";

interface Track {
  id: number;
  title: string;
  artist: string | null;
  cover_url?: string | null;
  voteCount?: number;
}

interface RecommendationCirclesProps {
  tracks: Track[];
  userVotes: Set<number>;
  onVote: (trackId: number) => void;
}

export function RecommendationCircles({
  tracks,
  userVotes,
  onVote,
}: RecommendationCirclesProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-md">
      <p className="text-text-muted text-xs mb-3 text-center">
        Tap to recommend • hover for song name
      </p>
      <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
        {tracks.slice(0, 8).map((track) => (
          <TrackCircle
            key={track.id}
            track={track}
            isVoted={userVotes.has(track.id)}
            onVote={() => onVote(track.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TrackCircleProps {
  track: Track;
  isVoted: boolean;
  onVote: () => void;
}

function TrackCircle({ track, isVoted, onVote }: TrackCircleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const longPressHandlers = useLongPress(
    () => setShowTooltip(true),
    onVote,
    400
  );

  const tooltipContent = `${track.title}${track.artist ? ` - ${track.artist}` : ""}`;

  return (
    <Tooltip content={tooltipContent}>
      <button
        {...longPressHandlers}
        onClick={onVote}
        className={`
          relative w-10 h-10 rounded-full flex-shrink-0
          transition-all duration-200
          ${isVoted ? "ring-2 ring-ember opacity-100 scale-105" : "opacity-70 hover:opacity-100"}
        `}
        style={{
          background: track.cover_url
            ? `url(${track.cover_url}) center/cover`
            : "var(--surface-2)",
        }}
        aria-label={`Vote for ${track.title}`}
      >
        {!track.cover_url && (
          <svg
            className="w-5 h-5 text-text-muted m-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13"
            />
          </svg>
        )}
        {isVoted && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-ember flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-void"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </button>
    </Tooltip>
  );
}
