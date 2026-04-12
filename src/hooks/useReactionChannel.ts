"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface StickerPayload {
  stickerLabel: string;
  senderName: string;
  senderId?: number;
}

const CHANNEL_NAME = "radio-reactions";

export function useReactionChannel(
  onStickerReceived?: (payload: StickerPayload) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    channelRef.current = supabase
      .channel(CHANNEL_NAME)
      .on("broadcast", { event: "sticker" }, (message) => {
        onStickerReceived?.(message.payload as StickerPayload);
      })
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [onStickerReceived, supabase]);

  const sendSticker = useCallback(
    async (stickerLabel: string, senderName: string, senderId?: number) => {
      if (!channelRef.current) return;

      await channelRef.current.send({
        type: "broadcast",
        event: "sticker",
        payload: { stickerLabel, senderName, senderId } as StickerPayload,
      });
    },
    []
  );

  return { sendSticker };
}
