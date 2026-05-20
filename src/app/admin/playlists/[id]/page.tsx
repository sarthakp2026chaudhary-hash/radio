"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, EmptyState, EmptyStateIcon } from "@/components/ui";
import { usePlaylists } from "@/hooks/usePlaylists";
import { formatDuration } from "@/lib/utils";
import type { Track, Artist } from "@/lib/supabase/types";

interface PlaylistTrack {
  id: number;
  position: number;
  tracks: Track & { artists?: Artist | null };
}

function SortableTrackRow({
  item,
  onRemove,
}: {
  item: PlaylistTrack;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 rounded-xl bg-surface-2 group ${isDragging ? "z-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary"
        aria-label="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <span className="w-6 text-center text-sm text-text-muted tabular-nums">
        {item.position + 1}
      </span>

      <div
        className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ background: "var(--surface-3)" }}
      >
        {item.tracks.cover_url ? (
          <img src={item.tracks.cover_url} alt={item.tracks.title} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary truncate">{item.tracks.title}</p>
        <p className="text-sm text-text-tertiary truncate">
          {item.tracks.artists?.name || "Unknown Artist"}
        </p>
      </div>

      <span className="text-sm text-text-muted tabular-nums">
        {formatDuration(item.tracks.duration_ms)}
      </span>

      <button
        onClick={onRemove}
        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"
        aria-label="Remove track"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function PlaylistBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = parseInt(params.id as string);

  const { getPlaylist, removeTrack, reorderTracks } = usePlaylists();

  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<(Track & { artists?: Artist | null })[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchPlaylist = useCallback(async () => {
    try {
      const data = await getPlaylist(playlistId);
      setPlaylist(data);
      const sortedTracks = (data.playlist_tracks || [])
        .sort((a: PlaylistTrack, b: PlaylistTrack) => a.position - b.position);
      setTracks(sortedTracks);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId, getPlaylist]);

  const fetchAvailableTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const res = await fetch("/api/tracks");
      const data = await res.json();
      setAvailableTracks(data.tracks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  useEffect(() => {
    if (showTrackPicker) {
      fetchAvailableTracks();
    }
  }, [showTrackPicker, fetchAvailableTracks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tracks.findIndex((t) => t.id === active.id);
      const newIndex = tracks.findIndex((t) => t.id === over.id);

      const newTracks = arrayMove(tracks, oldIndex, newIndex).map((t, i) => ({
        ...t,
        position: i,
      }));

      setTracks(newTracks);

      try {
        await reorderTracks(playlistId, newTracks.map((t) => t.tracks.id));
      } catch (err) {
        console.error(err);
        fetchPlaylist();
      }
    }
  };

  const handleRemoveTrack = async (playlistTrackId: number, trackId: number) => {
    try {
      await removeTrack(playlistId, trackId);
      setTracks((prev) => prev.filter((t) => t.id !== playlistTrackId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTrack = async (trackId: number) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (res.ok) {
        fetchPlaylist();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalDuration = tracks.reduce((acc, t) => acc + (t.tracks.duration_ms || 0), 0);
  const existingTrackIds = new Set(tracks.map((t) => t.tracks.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/admin/playlists")}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-secondary"
            aria-label="Back to playlists"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              {playlist?.name}
            </h1>
            <p className="text-text-tertiary mt-1">
              {tracks.length} {tracks.length === 1 ? "track" : "tracks"} • {formatDuration(totalDuration)}
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowTrackPicker(true)}>
            <svg className="w-5 h-5 md:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden md:inline">Add Tracks</span>
          </Button>
        </div>

        <div
          className="rounded-2xl p-4 md:p-6"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--surface-3)",
          }}
        >
          {tracks.length === 0 ? (
            <EmptyState
              icon={
                <EmptyStateIcon>
                  <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </EmptyStateIcon>
              }
              title="No tracks yet"
              description="Add tracks from your library to build this playlist"
              action={
                <Button variant="primary" onClick={() => setShowTrackPicker(true)}>
                  Add Tracks
                </Button>
              }
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {tracks.map((item) => (
                    <SortableTrackRow
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemoveTrack(item.id, item.tracks.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {showTrackPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTrackPicker(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-sm animate-slide-in-right overflow-auto"
            style={{
              background: "var(--surface-1)",
              borderLeft: "1px solid var(--surface-3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Add Tracks</h2>
                <button
                  onClick={() => setShowTrackPicker(false)}
                  className="p-1.5 rounded-lg hover:bg-surface-2"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoadingTracks ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
                </div>
              ) : availableTracks.length === 0 ? (
                <EmptyState
                  title="No tracks available"
                  description="Upload some tracks to your library first"
                />
              ) : (
                <div className="space-y-2">
                  {availableTracks.map((track) => {
                    const isAdded = existingTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          isAdded ? "opacity-50" : "hover:bg-surface-2 cursor-pointer"
                        }`}
                        onClick={() => !isAdded && handleAddTrack(track.id)}
                        role="button"
                        tabIndex={isAdded ? -1 : 0}
                        aria-disabled={isAdded}
                        onKeyDown={(e) => {
                          if (!isAdded && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            handleAddTrack(track.id);
                          }
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ background: "var(--surface-3)" }}
                        >
                          {track.cover_url ? (
                            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary truncate">{track.title}</p>
                          <p className="text-sm text-text-tertiary truncate">{track.artists?.name}</p>
                        </div>
                        {isAdded ? (
                          <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
