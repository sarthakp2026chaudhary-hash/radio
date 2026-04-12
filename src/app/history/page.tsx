"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface HistoryEntry {
  date: string;
  joinedAt: string;
  song: {
    id: number;
    title: string;
    artist: string | null;
    cover_url: string | null;
  } | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  useEffect(() => {
    async function fetchHistory() {
      const supabase = createClient();

      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Get user name
      const { data: profile } = await supabase
        .from("users")
        .select("display_name")
        .eq("auth_id", user.id)
        .single() as { data: { display_name: string } | null };

      if (profile) {
        setUserName(profile.display_name);
      }

      // Fetch history
      const response = await fetch("/api/history/attendance");
      const data = await response.json();

      if (data.history) {
        setHistory(data.history);
      }

      setIsLoading(false);
    }

    fetchHistory();
  }, [router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading history...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Your Listening History
            </h1>
            <p className="text-text-tertiary text-sm mt-1">
              {userName}&apos;s broadcast memories
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-text-tertiary hover:text-text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-surface-1 flex items-center justify-center">
              <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-text-secondary text-lg">No history yet</p>
            <p className="text-text-tertiary mt-2">
              Join a broadcast to start building your listening history
            </p>
            <button
              onClick={() => router.push("/radio")}
              className="mt-6 px-6 py-2 rounded-xl font-medium transition-all"
              style={{ background: "var(--ember)", color: "var(--void)" }}
            >
              Go to Radio
            </button>
          </div>
        ) : (
          <>
            {/* View Toggle */}
            <div className="flex items-center justify-end gap-2 mb-6">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "cards" ? "bg-ember text-void" : "bg-surface-2 text-text-tertiary hover:text-text-primary"
                }`}
                title="Card view"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list" ? "bg-ember text-void" : "bg-surface-2 text-text-tertiary hover:text-text-primary"
                }`}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
            </div>

            {/* Card View */}
            {viewMode === "cards" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {history.map((entry) => (
                  <div
                    key={entry.date}
                    className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--surface-3)",
                    }}
                  >
                    <div className="aspect-square relative">
                      {entry.song?.cover_url ? (
                        <img
                          src={entry.song.cover_url}
                          alt={entry.song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: "var(--surface-2)" }}
                        >
                          <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      {entry.song ? (
                        <>
                          <p className="font-medium text-text-primary text-sm truncate">{entry.song.title}</p>
                          <p className="text-text-tertiary text-xs truncate mt-0.5">{entry.song.artist || "Unknown Artist"}</p>
                        </>
                      ) : (
                        <p className="text-text-muted text-sm italic">No song recorded</p>
                      )}
                      <p className="text-text-tertiary text-xs mt-2">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.date}
                    className="flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-surface-2"
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--surface-3)",
                    }}
                  >
                    {/* Small Album Art */}
                    <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                      {entry.song?.cover_url ? (
                        <img
                          src={entry.song.cover_url}
                          alt={entry.song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: "var(--surface-2)" }}
                        >
                          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      {entry.song ? (
                        <>
                          <p className="font-medium text-text-primary truncate">{entry.song.title}</p>
                          <p className="text-text-tertiary text-sm truncate">{entry.song.artist || "Unknown Artist"}</p>
                        </>
                      ) : (
                        <p className="text-text-muted italic">No song recorded</p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="text-text-tertiary text-sm whitespace-nowrap">
                      {formatDate(entry.date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
