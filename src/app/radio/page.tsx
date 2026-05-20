"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/dropdown";
import { useColorScheme } from "@/hooks/useColorScheme";

interface User {
  id: number;
  display_name: string;
  avatar_url: string | null;
  is_host: boolean;
  is_host_listener: boolean;
}

interface ChannelCard {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  listener_count: number;
  is_playing: boolean;
  broadcast_mode: "automated" | "live";
  current_track_title: string | null;
  current_artist_name: string | null;
}

export default function RadioPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<ChannelCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useColorScheme();

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
        .select("id, display_name, avatar_url, is_host, is_host_listener")
        .eq("auth_id", authUser.id)
        .single() as { data: User | null };

      if (profile) setUser(profile);

      const res = await fetch("/api/channels");
      const data = await res.json();

      const channelCards: ChannelCard[] = (data.channels || []).map((ch: any) => {
        const state = ch.channel_state;
        const track = state?.tracks;
        const artist = Array.isArray(track?.artists) ? track.artists[0] : track?.artists;
        return {
          id: ch.id,
          name: ch.name,
          slug: ch.slug,
          description: ch.description,
          cover_url: ch.cover_url,
          listener_count: ch.listener_count || 0,
          is_playing: state?.is_playing || false,
          broadcast_mode: state?.broadcast_mode || "automated",
          current_track_title: track?.title || null,
          current_artist_name: artist?.name || null,
        };
      });

      setChannels(channelCards);
      setIsLoading(false);
    }

    init();
  }, [router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading...</span>
        </div>
      </main>
    );
  }

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

      <header className="relative border-b border-surface-3 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Radio
            </h1>
            <p className="text-text-tertiary text-sm">Pick a channel to start listening</p>
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
              onClick={() => router.push("/library")}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              }
            >
              My Library
            </DropdownItem>
            {user?.is_host && (
              <DropdownItem
                onClick={() => router.push("/admin")}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                  </svg>
                }
              >
                Admin
              </DropdownItem>
            )}
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
      </header>

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {channels.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
          >
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5l16.5-4.125M12 6.75c-2.708 0-5.363.224-7.948.655C2.999 7.58 2.25 8.507 2.25 9.574v9.176A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169A48.329 48.329 0 0012 6.75z" />
            </svg>
            <h2 className="text-lg font-medium text-text-primary mb-2">No channels yet</h2>
            <p className="text-text-tertiary">
              {user?.is_host ? (
                <>
                  Create your first channel in the{" "}
                  <Link href="/admin/channels" className="text-ember hover:text-ember/80">
                    admin panel
                  </Link>
                </>
              ) : (
                "Check back soon for new channels"
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((ch) => (
              <Link
                key={ch.id}
                href={`/radio/${ch.slug}`}
                className="group rounded-2xl p-5 transition-all hover:scale-[1.02]"
                style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {ch.cover_url ? (
                      <img src={ch.cover_url} alt={ch.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold text-text-primary truncate">{ch.name}</h2>
                      {ch.broadcast_mode === "live" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>

                    {ch.description && (
                      <p className="text-sm text-text-tertiary mb-2 line-clamp-2">{ch.description}</p>
                    )}

                    {ch.is_playing && ch.current_track_title ? (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-ember rounded-full animate-wave"
                              style={{ height: "10px", animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-text-secondary truncate">
                          {ch.current_track_title}
                          {ch.current_artist_name && (
                            <span className="text-text-tertiary"> — {ch.current_artist_name}</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-text-muted">
                        <div className="w-2 h-2 rounded-full bg-text-muted" />
                        Offline
                      </div>
                    )}

                    {ch.listener_count > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-text-tertiary">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        {ch.listener_count} listening
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
