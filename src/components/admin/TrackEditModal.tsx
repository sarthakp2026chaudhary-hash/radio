"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, Button, Input } from "@/components/ui";
import { MultiArtistSelect } from "./MultiArtistSelect";
import type { Track, Artist, TrackArtist } from "@/lib/supabase/types";

interface TrackArtistWithArtist extends TrackArtist {
  artists: Artist;
}

interface TrackEditModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface ArtistWithRole {
  artist: Artist;
  role: TrackArtist["role"];
}

export function TrackEditModal({ track, isOpen, onClose, onSave }: TrackEditModalProps) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [artists, setArtists] = useState<ArtistWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTrackArtists = useCallback(async () => {
    if (!track) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/artists`);
      const data = await res.json();
      const trackArtists: TrackArtistWithArtist[] = data.artists || [];
      setArtists(
        trackArtists.map((ta) => ({
          artist: ta.artists,
          role: ta.role,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [track]);

  useEffect(() => {
    if (track && isOpen) {
      setTitle(track.title);
      setGenre(track.genre || "");
      fetchTrackArtists();
    }
  }, [track, isOpen, fetchTrackArtists]);

  const handleSave = async () => {
    if (!track) return;
    setIsSaving(true);

    try {
      // Update track info
      await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre.trim() || null,
        }),
      });

      // Update artists
      await fetch(`/api/tracks/${track.id}/artists`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artists: artists.map((a) => ({
            artist_id: a.artist.id,
            role: a.role,
          })),
        }),
      });

      onSave();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Track" size="md">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
          />

          <Input
            label="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="e.g., Rock, Jazz, Electronic"
          />

          <MultiArtistSelect
            value={artists}
            onChange={setArtists}
            disabled={isSaving}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
