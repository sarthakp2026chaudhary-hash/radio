"use client";

interface NextSongPreviewProps {
  nextTrack: {
    title: string;
    artist: string | null;
  } | null;
}

export function NextSongPreview({ nextTrack }: NextSongPreviewProps) {
  if (!nextTrack) return null;

  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mt-4"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <span className="text-text-muted">Up next:</span>
      <span className="text-text-secondary truncate max-w-[200px]">
        {nextTrack.title}
        {nextTrack.artist && (
          <span className="text-text-tertiary"> - {nextTrack.artist}</span>
        )}
      </span>
    </div>
  );
}
