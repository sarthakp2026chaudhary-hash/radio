"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";

interface ArtistFormProps {
  initialData?: {
    name: string;
    bio?: string;
  };
  onSubmit: (data: { name: string; bio?: string }) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export function ArtistForm({ initialData, onSubmit, onCancel, isEditing = false }: ArtistFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [bio, setBio] = useState(initialData?.bio || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ name: name.trim(), bio: bio.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Artist Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter artist name"
        error={error && !name.trim() ? error : undefined}
        autoFocus
      />

      <Textarea
        label="Bio (optional)"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Brief description of the artist"
        rows={3}
      />

      {error && name.trim() && (
        <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Artist"}
        </Button>
      </div>
    </form>
  );
}
