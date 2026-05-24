"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Modal, EmptyState, EmptyStateIcon } from "@/components/ui";
import { useArtists } from "@/hooks/useArtists";
import { useUpload } from "@/hooks/useUpload";
import { ArtistCard } from "@/components/admin/ArtistCard";
import { ArtistForm } from "@/components/admin/ArtistForm";
import { TrackUploader } from "@/components/admin/TrackUploader";
import { TrackRow } from "@/components/admin/TrackRow";
import { TrackEditModal } from "@/components/admin/TrackEditModal";
import type { Artist, Track } from "@/lib/supabase/types";

export default function LibraryPage() {
  const { artists, isLoading, fetchArtists, createArtist, deleteArtist, getArtistWithTracks } = useArtists();
  const { uploads, addToQueue, uploadAll, removeUpload, clearCompleted } = useUpload();
  const tracksRef = useRef<HTMLDivElement>(null);

  const [selectedArtist, setSelectedArtist] = useState<(Artist & { tracks: Track[] }) | null>(null);
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [artistToDelete, setArtistToDelete] = useState<Artist | null>(null);
  const [trackToEdit, setTrackToEdit] = useState<Track | null>(null);

  const handleSelectArtist = useCallback(async (artist: Artist) => {
    if (selectedArtist?.id === artist.id) {
      setSelectedArtist(null);
      return;
    }

    const artistWithTracks = await getArtistWithTracks(artist.id);
    setSelectedArtist(artistWithTracks);
    requestAnimationFrame(() => tracksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [selectedArtist, getArtistWithTracks]);

  const handleCreateArtist = async (data: { name: string; bio?: string }) => {
    const artist = await createArtist(data.name, data.bio);
    setShowCreateArtist(false);
    setSelectedArtist({ ...artist, tracks: [] });
  };

  const handleDeleteArtist = async () => {
    if (!artistToDelete) return;

    await deleteArtist(artistToDelete.id);
    if (selectedArtist?.id === artistToDelete.id) {
      setSelectedArtist(null);
    }
    setArtistToDelete(null);
  };

  const handleFilesSelected = (files: File[]) => {
    if (!selectedArtist) return;
    addToQueue(files, selectedArtist.id);
  };

  const handleUploadComplete = useCallback(async () => {
    if (selectedArtist) {
      const refreshed = await getArtistWithTracks(selectedArtist.id);
      setSelectedArtist(refreshed);
    }
    fetchArtists();
  }, [selectedArtist, getArtistWithTracks, fetchArtists]);

  const handleUploadAll = async () => {
    await uploadAll();
    handleUploadComplete();
  };

  useEffect(() => {
    const successCount = uploads.filter((u) => u.status === "success").length;
    if (successCount > 0) {
      handleUploadComplete();
    }
  }, [uploads, handleUploadComplete]);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              Music Library
            </h1>
            <p className="text-text-tertiary mt-1">
              Manage your artists and tracks
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateArtist(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Artist
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Artists List */}
          <div className="lg:col-span-1">
            <div
              className="rounded-2xl p-4"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--surface-3)",
              }}
            >
              <h2 className="text-lg font-semibold text-text-primary mb-4">Artists</h2>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
                </div>
              ) : artists.length === 0 ? (
                <EmptyState
                  icon={
                    <EmptyStateIcon>
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                    </EmptyStateIcon>
                  }
                  title="No artists yet"
                  description="Create your first artist to start uploading tracks"
                />
              ) : (
                <div className="space-y-2">
                  {artists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      isSelected={selectedArtist?.id === artist.id}
                      onClick={() => handleSelectArtist(artist)}
                      onDelete={() => setArtistToDelete(artist)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upload & Tracks */}
          <div ref={tracksRef} className="lg:col-span-2 space-y-6 scroll-mt-6">
            {/* Upload Zone */}
            <TrackUploader
              artistId={selectedArtist?.id || null}
              artistName={selectedArtist?.name || null}
              onFilesSelected={handleFilesSelected}
              uploads={uploads}
              onUploadAll={handleUploadAll}
              onRemoveUpload={removeUpload}
              onClearCompleted={clearCompleted}
            />

            {/* Selected Artist Tracks */}
            {selectedArtist && (
              <div
                className="rounded-2xl p-6"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--surface-3)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {selectedArtist.name}&apos;s Tracks
                  </h2>
                  <span className="text-sm text-text-tertiary">
                    {selectedArtist.tracks.length} {selectedArtist.tracks.length === 1 ? "track" : "tracks"}
                  </span>
                </div>

                {selectedArtist.tracks.length === 0 ? (
                  <EmptyState
                    title="No tracks yet"
                    description="Upload audio files above to add tracks to this artist"
                  />
                ) : (
                  <div className="space-y-1">
                    {selectedArtist.tracks.map((track) => (
                      <TrackRow
                        key={track.id}
                        track={{ ...track, artists: selectedArtist }}
                        onEditArtists={() => setTrackToEdit(track)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No Selection State */}
            {!selectedArtist && artists.length > 0 && (
              <div
                className="rounded-2xl p-12"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--surface-3)",
                }}
              >
                <EmptyState
                  icon={
                    <EmptyStateIcon>
                      <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                      </svg>
                    </EmptyStateIcon>
                  }
                  title="Select an artist"
                  description="Choose an artist from the list to view their tracks and upload new music"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Artist Modal */}
      <Modal
        isOpen={showCreateArtist}
        onClose={() => setShowCreateArtist(false)}
        title="Create Artist"
        size="md"
      >
        <ArtistForm
          onSubmit={handleCreateArtist}
          onCancel={() => setShowCreateArtist(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!artistToDelete}
        onClose={() => setArtistToDelete(null)}
        title="Delete Artist"
        size="sm"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to delete <strong className="text-text-primary">{artistToDelete?.name}</strong>?
          This will also delete all their tracks.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setArtistToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDeleteArtist}
            className="!bg-error hover:!bg-error/90"
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Track Edit Modal */}
      <TrackEditModal
        track={trackToEdit}
        isOpen={!!trackToEdit}
        onClose={() => setTrackToEdit(null)}
        onSave={handleUploadComplete}
      />
    </div>
  );
}
