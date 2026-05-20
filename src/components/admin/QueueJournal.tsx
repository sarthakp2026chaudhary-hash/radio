"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Badge, Modal, Input } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

interface JournalTrack {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  artists: { id: number; name: string } | null;
}

interface JournalEntry {
  id: number;
  position: number;
  played_at: string;
  added_by: string;
  tracks: JournalTrack;
}

interface QueueJournalProps {
  channelSlug: string;
}

export function QueueJournal({ channelSlug }: QueueJournalProps) {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlaylistId, setSavedPlaylistId] = useState<number | null>(null);

  const fetchJournal = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/journal?date=${selectedDate}`
      );
      const data = await res.json();
      setJournal(data.journal || []);
      setAvailableDates(data.availableDates || []);
    } catch (err) {
      console.error("Failed to fetch journal:", err);
    } finally {
      setIsLoading(false);
    }
  }, [channelSlug, selectedDate]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  const handleSaveAsPlaylist = async () => {
    if (!journal.length) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          name: playlistName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSavedPlaylistId(data.playlist.id);
        setShowSaveModal(false);
        setPlaylistName("");
      } else {
        alert(data.error || "Failed to save playlist");
      }
    } catch (err) {
      console.error("Failed to save playlist:", err);
      alert("Failed to save playlist");
    } finally {
      setIsSaving(false);
    }
  };

  const totalDuration = journal.reduce(
    (sum, entry) => sum + (entry.tracks?.duration_ms || 0),
    0
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) return "Today";
    if (date.getTime() === yesterday.getTime()) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatPlayedTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <div className="p-4 border-b border-surface-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-text-primary">Session Journal</h3>
          <p className="text-sm text-text-tertiary mt-0.5">
            {journal.length} tracks • {formatDuration(totalDuration)}
          </p>
        </div>

        <select
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setIsLoading(true);
          }}
          className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-text-primary border-none outline-none cursor-pointer"
        >
          {availableDates.length === 0 ? (
            <option value={selectedDate}>{formatDate(selectedDate)}</option>
          ) : (
            availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDate(date)}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        ) : journal.length === 0 ? (
          <div className="text-center py-8 px-4">
            <svg
              className="w-10 h-10 mx-auto text-text-muted mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-text-secondary">No tracks played yet</p>
            <p className="text-sm text-text-muted mt-1">
              Play something to start the journal
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-2">
            {journal.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="w-6 text-center">
                  <span className="text-xs text-text-muted tabular-nums">
                    {entry.position}
                  </span>
                </div>

                <div
                  className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ background: "var(--surface-2)" }}
                >
                  {entry.tracks?.cover_url ? (
                    <img
                      src={entry.tracks.cover_url}
                      alt=""
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <svg
                      className="w-4 h-4 text-text-muted"
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
                  <p className="text-sm font-medium text-text-primary truncate">
                    {entry.tracks?.title || "Unknown Track"}
                  </p>
                  <p className="text-xs text-text-tertiary truncate">
                    {entry.tracks?.artists?.name || "Unknown Artist"}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>{formatPlayedTime(entry.played_at)}</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                    {entry.added_by}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {journal.length > 0 && (
        <div className="p-4 border-t border-surface-3">
          {savedPlaylistId ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Saved as playlist
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSavedPlaylistId(null)}
              >
                Save again
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowSaveModal(true)}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                />
              </svg>
              Save as Playlist
            </Button>
          )}
        </div>
      )}

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save as Playlist"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-tertiary">
            Save {journal.length} tracks from {formatDate(selectedDate)} as a new playlist.
          </p>
          <Input
            label="Playlist Name (optional)"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder={`Channel Name - ${selectedDate}`}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAsPlaylist}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Playlist"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
