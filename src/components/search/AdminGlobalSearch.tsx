"use client";

import { useState } from "react";
import { SongSearch } from "@/components/search/SongSearch";
import { SongActionsSheet } from "@/components/admin/SongActionsSheet";
import { useChannels } from "@/hooks/useChannels";
import type { SearchTrackResult } from "@/lib/search/search-tracks";

interface AdminGlobalSearchProps {
  /** Optional default channel slug for queue actions */
  defaultChannelSlug?: string;
}

export function AdminGlobalSearch({ defaultChannelSlug }: AdminGlobalSearchProps) {
  const { controlPlayback } = useChannels();
  const [sheet, setSheet] = useState<{ id: number; title: string } | null>(null);
  const [channelSlug] = useState(defaultChannelSlug ?? "");

  const onAddToQueue = async (track: SearchTrackResult) => {
    if (!channelSlug) return;
    try {
      await controlPlayback(channelSlug, { action: "add_to_queue", track_id: track.id });
    } catch {
      /* host can pick channel on dashboard for queue — silent here */
    }
  };

  return (
    <>
      <SongSearch
        className="w-full max-w-md"
        placeholder="Search library…"
        onManagePlaylists={(t) => setSheet({ id: t.id, title: t.title })}
        onAddToQueue={channelSlug ? onAddToQueue : undefined}
      />
      {sheet && <SongActionsSheet trackId={sheet.id} trackTitle={sheet.title} onClose={() => setSheet(null)} />}
    </>
  );
}
