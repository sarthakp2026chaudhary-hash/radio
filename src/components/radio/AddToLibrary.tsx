"use client";

import { useLibraryStatus } from "@/hooks/useLibrary";

interface AddToLibraryProps {
  trackId: number;
  channelId?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function AddToLibrary({
  trackId,
  channelId,
  size = "md",
  showLabel = false,
}: AddToLibraryProps) {
  const { isInLibrary, isLoading, toggle } = useLibraryStatus(trackId);

  const handleClick = () => {
    toggle(channelId);
  };

  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        ${sizeClasses[size]}
        rounded-lg transition-colors
        ${isInLibrary
          ? "text-ember bg-ember/10 hover:bg-ember/20"
          : "text-text-muted hover:text-text-secondary hover:bg-surface-2"
        }
        ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
        flex items-center gap-1.5
      `}
      title={isInLibrary ? "Remove from library" : "Add to library"}
      aria-label={isInLibrary ? "Remove from library" : "Add to library"}
    >
      {isInLibrary ? (
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ) : (
        <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      )}
      {showLabel && (
        <span className="text-sm">{isInLibrary ? "Saved" : "Save"}</span>
      )}
    </button>
  );
}
