"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Textarea, EmptyState, EmptyStateIcon } from "@/components/ui";
import { usePlaylists } from "@/hooks/usePlaylists";
import { PlaylistCard } from "@/components/admin/PlaylistCard";

export default function PlaylistsPage() {
  const { playlists, isLoading, createPlaylist, deletePlaylist, updatePlaylist } = usePlaylists();
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => setFolders((d.folders || []).map((f: { id: number; name: string }) => ({ id: f.id, name: f.name }))))
      .catch(() => {});
  }, []);

  const handleMove = async (playlistId: number, folderId: number | null) => {
    try {
      await updatePlaylist(playlistId, { folder_id: folderId });
    } catch (err) {
      console.error(err);
    }
  };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createPlaylist(name.trim(), description.trim() || undefined);
      setShowCreate(false);
      setName("");
      setDescription("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!playlistToDelete) return;

    try {
      await deletePlaylist(playlistToDelete.id);
      setPlaylistToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              Playlists
            </h1>
            <p className="text-text-tertiary mt-1">
              Create and manage your playlists
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Playlist
          </Button>
        </div>

        {/* Playlists Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        ) : playlists.length === 0 ? (
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </EmptyStateIcon>
              }
              title="No playlists yet"
              description="Create your first playlist to organize your tracks"
              action={
                <Button variant="primary" onClick={() => setShowCreate(true)}>
                  Create Playlist
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="space-y-2">
                <PlaylistCard
                  playlist={playlist}
                  onDelete={() => setPlaylistToDelete({ id: playlist.id, name: playlist.name })}
                />
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] text-text-muted flex-shrink-0">Folder</span>
                  <select
                    value={(playlist as { folder_id?: number | null }).folder_id ?? ""}
                    onChange={(e) => handleMove(playlist.id, e.target.value ? parseInt(e.target.value) : null)}
                    className="flex-1 text-xs px-2 py-1 rounded-md text-text-tertiary"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
                  >
                    <option value="">No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Playlist"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Playlist"
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this playlist about?"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!playlistToDelete}
        onClose={() => setPlaylistToDelete(null)}
        title="Delete Playlist"
        size="sm"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to delete <strong className="text-text-primary">{playlistToDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPlaylistToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            className="!bg-error hover:!bg-error/90"
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
