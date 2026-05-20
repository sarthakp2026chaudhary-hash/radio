"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { NotificationStack, type Notification } from "@/components/ui/notification-stack";
import { useReactionChannel, type StickerPayload } from "@/hooks/useReactionChannel";
import { ColorSchemePicker } from "@/components/admin/ColorSchemePicker";
import { useColorScheme } from "@/hooks/useColorScheme";

interface User {
  id: number;
  display_name: string;
  is_host: boolean;
}

interface Stats {
  tracks: number;
  artists: number;
  playlists: number;
  channels: number;
}

interface NowPlaying {
  channel_name: string;
  channel_slug: string;
  track_title: string;
  artist_name: string;
  is_playing: boolean;
  broadcast_mode: "automated" | "live";
}

function AdminContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({ tracks: 0, artists: 0, playlists: 0, channels: 0 });
  const [nowPlaying, setNowPlaying] = useState<NowPlaying[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useColorScheme();

  const handleStickerReceived = useCallback((payload: StickerPayload) => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [
      ...prev,
      { id, text: `${payload.senderName} sent ${payload.stickerLabel}!` },
    ]);
  }, []);

  useReactionChannel(handleStickerReceived);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("id, display_name, is_host")
        .eq("auth_id", authUser.id)
        .single() as { data: User | null };

      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }
      setUser(profile);

      const [tracksRes, artistsRes, playlistsRes, channelsRes] = await Promise.all([
        supabase.from("tracks").select("id", { count: "exact", head: true }),
        supabase.from("artists").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
        supabase.from("channels").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        tracks: tracksRes.count || 0,
        artists: artistsRes.count || 0,
        playlists: playlistsRes.count || 0,
        channels: channelsRes.count || 0,
      });

      const { data: channels } = await supabase
        .from("channels")
        .select(`
          id,
          name,
          slug,
          channel_state (
            is_playing,
            broadcast_mode,
            current_track_id,
            tracks:current_track_id (
              title,
              artist_id,
              artists:artist_id ( name )
            )
          )
        `) as { data: any[] | null };

      const playing: NowPlaying[] = (channels || []).map((ch) => {
        const state = Array.isArray(ch.channel_state) ? ch.channel_state[0] : ch.channel_state;
        const track = state?.tracks;
        const artist = Array.isArray(track?.artists) ? track.artists[0] : track?.artists;
        return {
          channel_name: ch.name,
          channel_slug: ch.slug,
          track_title: track?.title || "Nothing playing",
          artist_name: artist?.name || "—",
          is_playing: state?.is_playing || false,
          broadcast_mode: state?.broadcast_mode || "automated",
        };
      });
      setNowPlaying(playing);

      setIsLoading(false);
    }

    init();
  }, [router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  const livePlayingCount = nowPlaying.filter((n) => n.is_playing).length;

  return (
    <main className="min-h-screen bg-void">
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              Host Dashboard
            </h1>
            <p className="text-text-tertiary text-sm">
              Welcome back, {user?.display_name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  livePlayingCount > 0 ? "bg-success animate-pulse" : "bg-text-muted"
                }`}
              />
              <span className="text-text-secondary text-sm">
                {livePlayingCount > 0 ? `${livePlayingCount} live` : "Offline"}
              </span>
            </div>

            <Dropdown
              trigger={
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-ember flex items-center justify-center">
                    <span className="text-void text-sm font-medium">
                      {user?.display_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              }
              align="right"
            >
              <DropdownItem
                onClick={() => router.push("/admin/post")}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                }
              >
                Post
              </DropdownItem>
              <DropdownItem
                onClick={() => router.push("/admin/history")}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                My History
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem
                onClick={handleLogout}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                }
              >
                Logout
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tracks" value={stats.tracks} href="/admin/library" />
          <StatCard label="Artists" value={stats.artists} href="/admin/library" />
          <StatCard label="Playlists" value={stats.playlists} href="/admin/playlists" />
          <StatCard label="Channels" value={stats.channels} href="/admin/channels" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Channels</h2>
                <Link
                  href="/admin/channels"
                  className="text-sm text-ember hover:text-ember/80 transition-colors"
                >
                  Manage →
                </Link>
              </div>

              {nowPlaying.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No channels yet</p>
                  <Link
                    href="/admin/channels"
                    className="inline-block mt-3 px-4 py-2 rounded-lg bg-ember text-white text-sm font-medium hover:bg-ember/90 transition-colors"
                  >
                    Create channel
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {nowPlaying.map((ch) => (
                    <Link
                      key={ch.channel_slug}
                      href={`/admin/channels/${ch.channel_slug}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            ch.is_playing ? "bg-success animate-pulse" : "bg-text-muted"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {ch.channel_name}
                            {ch.broadcast_mode === "live" && (
                              <span className="ml-2 text-xs text-red-500">● LIVE</span>
                            )}
                          </p>
                          <p className="text-sm text-text-tertiary truncate">
                            {ch.is_playing ? `${ch.track_title} — ${ch.artist_name}` : "Offline"}
                          </p>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
            >
              <h2 className="text-lg font-semibold mb-4">Appearance</h2>
              <ColorSchemePicker />
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionCard
              href="/admin/library"
              title="Manage Library"
              description="Add artists and upload tracks"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              }
            />
            <ActionCard
              href="/admin/playlists"
              title="Build Playlists"
              description="Create curated track collections"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              }
            />
            <ActionCard
              href="/admin/channels"
              title="Configure Channels"
              description="Set up radio channels and schedules"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5l16.5-4.125M12 6.75c-2.708 0-5.363.224-7.948.655C2.999 7.58 2.25 8.507 2.25 9.574v9.176A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169A48.329 48.329 0 0012 6.75z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>

      <NotificationStack notifications={notifications} onDismiss={dismissNotification} />
    </main>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl p-5 hover:bg-surface-2 transition-colors"
      style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
    >
      <p className="text-text-tertiary text-sm">{label}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </Link>
  );
}

function ActionCard({ href, title, description, icon }: { href: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-4 rounded-xl hover:bg-surface-2 transition-colors"
      style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
    >
      <div className="text-ember flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="font-medium text-text-primary">{title}</p>
        <p className="text-sm text-text-tertiary mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-void">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
            <span className="text-text-secondary">Loading dashboard...</span>
          </div>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
