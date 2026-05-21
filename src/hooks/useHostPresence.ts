"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Channel, User } from "@/lib/supabase/types";

interface HostPresenceState {
  isLive: boolean;
  channel: Channel | null;
  user: User | null;
  sessionStartedAt: string | null;
}

export function useHostPresence(channelId?: number) {
  const [presence, setPresence] = useState<HostPresenceState>({
    isLive: false,
    channel: null,
    user: null,
    sessionStartedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch("/api/host/presence");
      const data = await res.json();
      setPresence({
        isLive: data.is_live,
        channel: data.channel,
        user: data.user,
        sessionStartedAt: data.session_started_at,
      });
    } catch (err) {
      console.error("Failed to fetch host presence:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startListening = useCallback(async (targetChannelId: number) => {
    try {
      const res = await fetch("/api/host/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: targetChannelId, is_listening: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start listening");
      }

      await fetchPresence();

      heartbeatRef.current = setInterval(async () => {
        await fetch("/api/host/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel_id: targetChannelId, is_listening: true }),
        });
      }, 30000);

      return true;
    } catch (err) {
      console.error("Failed to start listening:", err);
      return false;
    }
  }, [fetchPresence]);

  const stopListening = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    try {
      await fetch("/api/host/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_listening: false }),
      });
      await fetchPresence();
    } catch (err) {
      console.error("Failed to stop listening:", err);
    }
  }, [fetchPresence]);

  useEffect(() => {
    fetchPresence();

    const supabase = createClient();
    const channelName = `host_presence_changes-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "host_presence",
        },
        () => {
          fetchPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [fetchPresence]);

  const isLiveOnChannel = channelId ? presence.isLive && presence.channel?.id === channelId : false;

  return {
    ...presence,
    isLiveOnChannel,
    isLoading,
    startListening,
    stopListening,
    refresh: fetchPresence,
  };
}
