"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSchemeById, applyColorScheme, COLOR_SCHEMES } from "@/lib/color-schemes";

export function useColorScheme() {
  const [currentSchemeId, setCurrentSchemeId] = useState<string>("ember");

  // Fetch initial scheme and subscribe to changes
  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function init() {
      // Fetch current scheme
      const { data } = await supabase
        .from("playback_state")
        .select("color_scheme")
        .eq("id", 1)
        .single() as { data: { color_scheme: string | null } | null };

      if (!isMounted) return;

      const schemeId = data?.color_scheme || "ember";
      setCurrentSchemeId(schemeId);
      applyColorScheme(getSchemeById(schemeId));
    }

    init();

    // Subscribe to color scheme changes with unique channel name
    const channel = supabase
      .channel(`color-scheme-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "playback_state",
          filter: "id=eq.1",
        },
        (payload) => {
          if (!isMounted) return;
          const newSchemeId = (payload.new as { color_scheme?: string }).color_scheme || "ember";
          setCurrentSchemeId(newSchemeId);
          applyColorScheme(getSchemeById(newSchemeId));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, []);

  // Update scheme (admin only)
  const setScheme = useCallback(async (schemeId: string) => {
    const freshClient = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (freshClient.from("playback_state") as any)
      .update({ color_scheme: schemeId })
      .eq("id", 1);

    if (!error) {
      setCurrentSchemeId(schemeId);
      applyColorScheme(getSchemeById(schemeId));
    }

    return { error };
  }, []);

  return {
    currentSchemeId,
    setScheme,
    schemes: COLOR_SCHEMES,
  };
}
