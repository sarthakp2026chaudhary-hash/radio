"use client";

import { useState } from "react";
import { Button, Modal, Input, Textarea, EmptyState, EmptyStateIcon } from "@/components/ui";
import { useChannels } from "@/hooks/useChannels";
import { useFriends } from "@/hooks/useFriends";
import { ChannelCard } from "@/components/admin/ChannelCard";

export default function ChannelsPage() {
  const { channels, isLoading, createChannel, deleteChannel } = useChannels();
  const { friends } = useFriends();
  const [showCreate, setShowCreate] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<{ slug: string; name: string } | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [forUserId, setForUserId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createChannel(
        name.trim(),
        description.trim() || undefined,
        forUserId ? false : isPublic,
        forUserId || undefined
      );
      setShowCreate(false);
      setName("");
      setDescription("");
      setIsPublic(true);
      setForUserId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!channelToDelete) return;

    try {
      await deleteChannel(channelToDelete.slug);
      setChannelToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              Channels
            </h1>
            <p className="text-text-tertiary mt-1">
              Manage broadcast channels
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Channel
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        ) : channels.length === 0 ? (
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                </EmptyStateIcon>
              }
              title="No channels yet"
              description="Create your first broadcast channel"
              action={
                <Button variant="primary" onClick={() => setShowCreate(true)}>
                  Create Channel
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onDelete={() => setChannelToDelete({ slug: channel.slug, name: channel.name })}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Channel"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Late Night Lounge"
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            rows={3}
          />

          {friends.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Curated For (optional)
              </label>
              <select
                value={forUserId ?? ""}
                onChange={(e) => setForUserId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-3 rounded-xl text-text-primary outline-none transition-colors"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-3)",
                }}
              >
                <option value="">No one (general channel)</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.display_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1.5">
                Personal channels are private and only accessible by the selected friend.
              </p>
            </div>
          )}

          {!forUserId && (
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "var(--surface-2)" }}
            >
              <div>
                <p className="font-medium text-text-primary">Visibility</p>
                <p className="text-sm text-text-tertiary mt-0.5">
                  {isPublic ? "Anyone can join this channel" : "Only invited members can join"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isPublic ? "bg-ember" : "bg-surface-3"
                }`}
                role="switch"
                aria-checked={isPublic}
                aria-label="Public channel"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isPublic ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}
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

      <Modal
        isOpen={!!channelToDelete}
        onClose={() => setChannelToDelete(null)}
        title="Delete Channel"
        size="sm"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to delete <strong className="text-text-primary">{channelToDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setChannelToDelete(null)}>
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
