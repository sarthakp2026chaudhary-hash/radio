"use client";

import { useRouter } from "next/navigation";
import { useLibrary } from "@/hooks/useLibrary";
import { useColorScheme } from "@/hooks/useColorScheme";
import { formatDuration } from "@/lib/utils";

export default function LibraryPage() {
  const router = useRouter();
  const { library, total, isLoading, removeFromLibrary } = useLibrary();

  useColorScheme();

  const handleRemove = async (trackId: number) => {
    try {
      await removeFromLibrary(trackId);
    } catch (err) {
      console.error("Failed to remove:", err);
    }
  };

  return (
    <main className="min-h-screen bg-void">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, var(--ember-subtle) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-secondary transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1
              className="text-2xl font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              My Library
            </h1>
            <p className="text-text-tertiary mt-1">
              {total} saved {total === 1 ? "track" : "tracks"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        ) : library.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-3)",
            }}
          >
            <svg
              className="w-16 h-16 mx-auto text-text-muted mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <h2 className="text-lg font-medium text-text-primary mb-2">
              No saved tracks yet
            </h2>
            <p className="text-text-tertiary">
              Tap the heart icon on tracks you love to save them here
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-3)",
            }}
          >
            <div className="divide-y divide-surface-2">
              {library.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-4 hover:bg-surface-2/50 transition-colors"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {entry.track.cover_url ? (
                      <img
                        src={entry.track.cover_url}
                        alt=""
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <svg
                        className="w-5 h-5 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {entry.track.title}
                    </p>
                    <p className="text-sm text-text-tertiary truncate">
                      {entry.track.artists?.name || "Unknown Artist"}
                    </p>
                    {entry.source_channel && (
                      <p className="text-xs text-ember mt-0.5">
                        from {entry.source_channel.name}
                      </p>
                    )}
                  </div>

                  <span className="text-xs text-text-muted tabular-nums">
                    {formatDuration(entry.track.duration_ms)}
                  </span>

                  <button
                    onClick={() => handleRemove(entry.track_id)}
                    className="p-2 rounded-lg text-ember hover:bg-ember/10 transition-colors"
                    aria-label="Remove from library"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
