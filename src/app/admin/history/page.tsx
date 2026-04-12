"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface HistoryEntry {
  date: string;
  song: {
    title: string;
    artist: string | null;
    cover_url: string | null;
  } | null;
  post: {
    quote: string;
    image_url: string | null;
  } | null;
}

interface MonthGroup {
  month: string;
  year: number;
  entries: HistoryEntry[];
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      const supabase = createClient();

      // Check auth and host status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("is_host")
        .eq("auth_id", user.id)
        .single() as { data: { is_host: boolean } | null };

      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }

      // Fetch all songs of the day
      const { data: songs } = await supabase
        .from("song_of_day")
        .select(`
          session_date,
          tracks (
            title,
            artist,
            cover_url
          )
        `)
        .order("session_date", { ascending: false }) as { data: Array<{
          session_date: string;
          tracks: { title: string; artist: string | null; cover_url: string | null } | null;
        }> | null };

      // Fetch all daily posts
      const { data: posts } = await supabase
        .from("daily_posts")
        .select("session_date, quote, image_url")
        .order("session_date", { ascending: false }) as { data: Array<{
          session_date: string;
          quote: string;
          image_url: string | null;
        }> | null };

      // Combine data by date
      const songsByDate = new Map(songs?.map(s => [s.session_date, s.tracks]) || []);
      const postsByDate = new Map(posts?.map(p => [p.session_date, { quote: p.quote, image_url: p.image_url }]) || []);

      // Get all unique dates
      const allDates = new Set([
        ...(songs?.map(s => s.session_date) || []),
        ...(posts?.map(p => p.session_date) || []),
      ]);

      // Create entries
      const entries: HistoryEntry[] = Array.from(allDates).map(date => ({
        date,
        song: songsByDate.get(date) || null,
        post: postsByDate.get(date) || null,
      }));

      // Sort by date descending
      entries.sort((a, b) => b.date.localeCompare(a.date));

      // Group by month
      const groups: Map<string, HistoryEntry[]> = new Map();
      entries.forEach(entry => {
        const d = new Date(entry.date + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(entry);
      });

      // Convert to array
      const monthGroups: MonthGroup[] = Array.from(groups.entries()).map(([key, entries]) => {
        const [year, month] = key.split('-').map(Number);
        const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" });
        return { month: monthName, year, entries };
      });

      setMonthGroups(monthGroups);
      setIsLoading(false);
    }

    fetchHistory();
  }, [router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
              Broadcast History
            </h1>
            <p className="text-text-tertiary text-sm mt-1">
              Your monthly playlists
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
        {monthGroups.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-surface-1 flex items-center justify-center">
              <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-text-secondary text-lg">No history yet</p>
            <p className="text-text-tertiary mt-2">
              Start broadcasting to build your history
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {monthGroups.map((group) => (
              <div key={`${group.year}-${group.month}`}>
                {/* Month Header */}
                <div className="flex items-baseline gap-2 mb-6">
                  <h2
                    className="text-xl font-semibold text-text-primary"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    {group.month}
                  </h2>
                  <span className="text-text-tertiary">{group.year}</span>
                </div>

                {/* Entries Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.date}
                      className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--surface-3)",
                      }}
                    >
                      {/* Image */}
                      <div className="aspect-square relative">
                        {entry.post?.image_url ? (
                          <img
                            src={entry.post.image_url}
                            alt={entry.date}
                            className="w-full h-full object-cover"
                          />
                        ) : entry.song?.cover_url ? (
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
                            <svg className="w-12 h-12 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3">
                        {entry.post?.quote && (
                          <p
                            className="text-text-secondary text-xs italic truncate mb-1"
                            style={{ fontFamily: "var(--font-caveat)", fontSize: "0.875rem" }}
                          >
                            &ldquo;{entry.post.quote}&rdquo;
                          </p>
                        )}
                        {entry.song ? (
                          <>
                            <p className="font-medium text-text-primary text-sm truncate">
                              {entry.song.title}
                            </p>
                            <p className="text-text-tertiary text-xs truncate">
                              {entry.song.artist || "Unknown"}
                            </p>
                          </>
                        ) : (
                          <p className="text-text-muted text-sm italic">No song</p>
                        )}
                        <p className="text-text-tertiary text-xs mt-2">
                          {formatDate(entry.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
