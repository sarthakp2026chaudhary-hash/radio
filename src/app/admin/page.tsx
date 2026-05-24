"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { NotificationStack, type Notification } from "@/components/ui/notification-stack";
import { useReactionChannel, type StickerPayload } from "@/hooks/useReactionChannel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useChannels } from "@/hooks/useChannels";
import { FolderTree } from "@/components/admin/FolderTree";
import { SongActionsSheet } from "@/components/admin/SongActionsSheet";
import { SwipeRow } from "@/components/admin/SwipeRow";

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
interface LoopInfo {
  channel: { name: string; slug: string; updated_at: string | null };
  is_playing: boolean;
  loop_count: number;
  current_track: { id: number; title: string } | null;
  next_track: { id: number; title: string } | null;
  loop?: { id: number; title: string; skipped: boolean; is_current: boolean }[];
}

function AdminContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({ tracks: 0, artists: 0, playlists: 0, channels: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const { channels, controlPlayback } = useChannels();
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loop, setLoop] = useState<LoopInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ id: number; title: string } | null>(null);

  useColorScheme();

  const handleStickerReceived = useCallback((payload: StickerPayload) => {
    setNotifications((prev) => [...prev, { id: crypto.randomUUID(), text: `${payload.senderName} sent ${payload.stickerLabel}!` }]);
  }, []);
  useReactionChannel(handleStickerReceived);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const toast = useCallback((text: string) => {
    setNotifications((prev) => [...prev, { id: crypto.randomUUID(), text }]);
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
      const { data: profile } = (await supabase
        .from("users")
        .select("id, display_name, is_host")
        .eq("auth_id", authUser.id)
        .single()) as { data: User | null };
      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }
      setUser(profile);
      const [t, a, p, c] = await Promise.all([
        supabase.from("tracks").select("id", { count: "exact", head: true }),
        supabase.from("artists").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
        supabase.from("channels").select("id", { count: "exact", head: true }),
      ]);
      setStats({ tracks: t.count || 0, artists: a.count || 0, playlists: p.count || 0, channels: c.count || 0 });
      setIsLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedSlug && channels.length) setSelectedSlug(channels[0].slug);
  }, [channels, selectedSlug]);

  const refreshLoop = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/channels/${slug}/loop`);
      if (res.ok) setLoop(await res.json());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) refreshLoop(selectedSlug);
  }, [selectedSlug, refreshLoop]);

  const onPlayPlaylist = useCallback(
    async (playlistId: number, name: string) => {
      if (!selectedSlug) {
        toast("Pick a channel first");
        return;
      }
      setBusy(true);
      try {
        await controlPlayback(selectedSlug, { action: "play_playlist", playlist_id: playlistId });
        toast(`Playing "${name}"`);
        await refreshLoop(selectedSlug);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to play");
      } finally {
        setBusy(false);
      }
    },
    [selectedSlug, controlPlayback, refreshLoop, toast]
  );

  const onAddToQueue = useCallback(
    async (trackId: number, title: string) => {
      if (!selectedSlug) {
        toast("Pick a channel first");
        return;
      }
      try {
        await controlPlayback(selectedSlug, { action: "add_to_queue", track_id: trackId });
        toast(`Queued "${title}"`);
        await refreshLoop(selectedSlug);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [selectedSlug, controlPlayback, refreshLoop, toast]
  );

  const onToggleSkip = useCallback(
    async (trackId: number) => {
      if (!selectedSlug) return;
      try {
        await controlPlayback(selectedSlug, { action: "toggle_skip", track_id: trackId });
        await refreshLoop(selectedSlug);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [selectedSlug, controlPlayback, refreshLoop, toast]
  );

  const onToggle = useCallback(async () => {
    if (!selectedSlug) return;
    setBusy(true);
    try {
      await controlPlayback(selectedSlug, { action: loop?.is_playing ? "pause" : "play" });
      await refreshLoop(selectedSlug);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [selectedSlug, loop?.is_playing, controlPlayback, refreshLoop, toast]);

  const onSkip = useCallback(async () => {
    if (!selectedSlug) return;
    setBusy(true);
    try {
      await controlPlayback(selectedSlug, { action: "skip" });
      await refreshLoop(selectedSlug);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [selectedSlug, controlPlayback, refreshLoop, toast]);

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

  return (
    <main className="min-h-screen bg-void">
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
              Orchestrator
            </h1>
            <p className="text-text-tertiary text-sm">Welcome back, {user?.display_name}</p>
          </div>
          <Dropdown
            trigger={
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                <div className="w-7 h-7 rounded-full bg-ember flex items-center justify-center">
                  <span className="text-void text-sm font-medium">{user?.display_name?.charAt(0).toUpperCase()}</span>
                </div>
                <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            }
            align="right"
          >
            <DropdownItem onClick={() => router.push("/admin/library")}>Library</DropdownItem>
            <DropdownItem onClick={() => router.push("/admin/playlists")}>Playlists</DropdownItem>
            <DropdownItem onClick={() => router.push("/admin/channels")}>Channels</DropdownItem>
            <DropdownItem onClick={() => router.push("/admin/post")}>Post</DropdownItem>
            <DropdownItem onClick={() => router.push("/admin/history")}>My History</DropdownItem>
            <DropdownDivider />
            <DropdownItem onClick={handleLogout}>Logout</DropdownItem>
          </Dropdown>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 pb-28">
        {/* slim nav / stats strip — de-emphasized */}
        <div className="flex flex-wrap gap-2 mb-6 text-sm">
          <Link href="/admin/library" className="px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-tertiary" style={{ background: "var(--surface-1)" }}>
            {stats.tracks} tracks · {stats.artists} artists
          </Link>
          <Link href="/admin/playlists" className="px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-tertiary" style={{ background: "var(--surface-1)" }}>
            {stats.playlists} playlists
          </Link>
          <Link href="/admin/channels" className="px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-tertiary" style={{ background: "var(--surface-1)" }}>
            {stats.channels} channels
          </Link>
          <Link href="/admin/graph" className="px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-ember" style={{ background: "var(--surface-1)" }}>
            ◈ Brain
          </Link>
          <Link href="/admin/graph2" className="px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-ember" style={{ background: "var(--surface-1)" }}>
            ◈ Brain 2
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6">
          {/* Library tree rail */}
          <section className="rounded-2xl p-4 lg:h-[70vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
            <div className="flex items-center justify-between px-2 mb-2">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Library</h2>
              <Link href="/admin/add" className="text-xs text-ember hover:opacity-80 transition-opacity">+ Quick add</Link>
            </div>
            <FolderTree onPlayPlaylist={onPlayPlaylist} onAddToQueue={onAddToQueue} onOpenSong={(id, title) => setSheet({ id, title })} />
          </section>

          {/* Now orchestrating */}
          <section className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Now orchestrating</h2>
              {channels.length > 0 && (
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm text-text-secondary"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
                >
                  {channels.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {channels.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No channels yet</p>
                <Link href="/admin/channels" className="inline-block mt-3 px-4 py-2 rounded-lg bg-ember text-white text-sm font-medium hover:opacity-90 transition-opacity">
                  Create a channel
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className={`w-2 h-2 rounded-full ${loop?.is_playing ? "bg-success animate-pulse" : "bg-text-muted"}`} />
                  <span className="text-xs uppercase tracking-wide text-text-tertiary">{loop?.is_playing ? "On air" : "Paused"}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                    <div className="text-3xl font-semibold text-ember tabular-nums">{loop?.loop_count ?? 0}</div>
                    <div className="text-xs text-text-tertiary mt-1">on loop</div>
                  </div>
                  <div className="rounded-xl p-4 col-span-2" style={{ background: "var(--surface-2)" }}>
                    <div className="text-[11px] uppercase tracking-wide text-text-muted">Now</div>
                    <div className="text-sm text-text-secondary truncate mt-1">{loop?.current_track?.title ?? "—"}</div>
                    <div className="text-[11px] uppercase tracking-wide text-text-muted mt-2">Up next</div>
                    <div className="text-sm text-text-tertiary truncate">{loop?.next_track?.title ?? "—"}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    disabled={busy}
                    onClick={onToggle}
                    className="px-5 py-2.5 rounded-full bg-ember text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loop?.is_playing ? "Pause" : "Play"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={onSkip}
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-50"
                    style={{ border: "1px solid var(--surface-3)" }}
                  >
                    Skip →
                  </button>
                  <Link href={`/admin/channels/${selectedSlug}`} className="ml-auto text-sm text-ember hover:opacity-80 transition-opacity">
                    Full controls →
                  </Link>
                </div>

                {loop?.loop && loop.loop.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                      On loop · tap − to hide a song from this queue
                    </p>
                    <div className="max-h-64 overflow-y-auto -mx-1">
                      {loop.loop.map((s) => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${s.is_current ? "bg-surface-2" : ""}`}
                        >
                          <span
                            className={`text-sm truncate flex-1 ${
                              s.skipped
                                ? "text-text-muted line-through"
                                : s.is_current
                                ? "text-ember"
                                : "text-text-secondary"
                            }`}
                          >
                            {s.title}
                          </span>
                          <button
                            onClick={() => onToggleSkip(s.id)}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 transition-colors ${
                              s.skipped ? "border border-surface-3 text-text-muted" : "bg-success text-void"
                            }`}
                            title={s.skipped ? "Hidden — tap to include" : "Included — tap to hide"}
                          >
                            {s.skipped ? "−" : "✓"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-text-muted mt-6">
                  Tip: hover a playlist in the library and hit <span className="text-text-tertiary">▶ Play</span> to load it onto this channel.
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      {channels.length > 0 && loop?.current_track && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t" style={{ background: "var(--surface-1)", borderColor: "var(--surface-3)" }}>
          <div className="max-w-6xl mx-auto px-6 py-3">
            <SwipeRow onSwipeLeft={onSkip} leftLabel="Skip">
              <div className="flex items-center gap-3" style={{ background: "var(--surface-1)" }}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${loop.is_playing ? "bg-success animate-pulse" : "bg-text-muted"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-text-muted truncate">On {loop.channel?.name ?? selectedSlug}</p>
                  <p className="text-sm text-text-secondary truncate">{loop.current_track.title}</p>
                </div>
                <button onClick={onToggle} disabled={busy} className="px-4 py-1.5 rounded-full bg-ember text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {loop.is_playing ? "Pause" : "Play"}
                </button>
                <button onClick={onSkip} disabled={busy} className="px-3 py-1.5 rounded-full text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-50" style={{ border: "1px solid var(--surface-3)" }}>
                  Skip
                </button>
              </div>
            </SwipeRow>
          </div>
        </div>
      )}

      {sheet && <SongActionsSheet trackId={sheet.id} trackTitle={sheet.title} onClose={() => setSheet(null)} />}

      <NotificationStack notifications={notifications} onDismiss={dismissNotification} />
    </main>
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
