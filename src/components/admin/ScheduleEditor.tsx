"use client";

import { useState } from "react";
import { Button, Modal, Input, Badge } from "@/components/ui";
import { useSchedule, DAYS_OF_WEEK } from "@/hooks/useSchedule";
import { usePlaylists } from "@/hooks/usePlaylists";

interface ScheduleEditorProps {
  channelSlug: string;
}

interface ScheduleFormData {
  name: string;
  playlist_id: number | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
}

const DEFAULT_FORM: ScheduleFormData = {
  name: "",
  playlist_id: null,
  day_of_week: null,
  start_time: "09:00",
  end_time: "17:00",
};

export function ScheduleEditor({ channelSlug }: ScheduleEditorProps) {
  const {
    schedules,
    isLoading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    applySchedule,
  } = useSchedule(channelSlug);
  const { playlists } = usePlaylists();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (schedule: any) => {
    setEditingId(schedule.id);
    setFormData({
      name: schedule.name,
      playlist_id: schedule.playlist_id,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateSchedule({ id: editingId, ...formData });
      } else {
        await createSchedule(formData);
      }
      setShowModal(false);
      setFormData(DEFAULT_FORM);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this schedule?")) return;

    try {
      await deleteSchedule(id);
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  };

  const handleToggleActive = async (id: number, currentState: boolean) => {
    try {
      await updateSchedule({ id, is_active: !currentState });
    } catch (err) {
      console.error("Failed to toggle schedule:", err);
    }
  };

  const handleApplyNow = async () => {
    setIsApplying(true);
    try {
      const result = await applySchedule();
      if (result.applied) {
        alert("Schedule applied successfully!");
      } else {
        alert(`Not applied: ${result.reason}`);
      }
    } catch (err) {
      console.error("Failed to apply schedule:", err);
      alert("Failed to apply schedule");
    } finally {
      setIsApplying(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getDayLabel = (day: number | null) => {
    if (day === null) return "Every day";
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Unknown";
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
          <h3 className="font-semibold text-text-primary">Schedule</h3>
          <p className="text-sm text-text-tertiary mt-0.5">
            {schedules.length} {schedules.length === 1 ? "slot" : "slots"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleApplyNow} disabled={isApplying}>
            {isApplying ? "Checking..." : "Apply Now"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          </div>
        ) : schedules.length === 0 ? (
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
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
            <p className="text-text-secondary">No schedules</p>
            <p className="text-sm text-text-muted mt-1">
              Create time-based programming
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`p-4 hover:bg-surface-2/50 transition-colors ${
                  !schedule.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary truncate">
                        {schedule.name}
                      </p>
                      {!schedule.is_active && (
                        <Badge variant="default">Paused</Badge>
                      )}
                    </div>
                    <p className="text-sm text-text-tertiary mt-1">
                      {getDayLabel(schedule.day_of_week)} • {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </p>
                    {schedule.playlist && (
                      <p className="text-xs text-ember mt-1">
                        {schedule.playlist.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(schedule.id, schedule.is_active)}
                      className="p-1.5 rounded-lg hover:bg-surface-3 text-text-muted hover:text-text-secondary"
                      title={schedule.is_active ? "Pause" : "Activate"}
                    >
                      {schedule.is_active ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(schedule)}
                      className="p-1.5 rounded-lg hover:bg-surface-3 text-text-muted hover:text-text-secondary"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Schedule" : "Create Schedule"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Morning Show"
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Playlist
            </label>
            <select
              value={formData.playlist_id ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  playlist_id: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="w-full px-4 py-3 rounded-xl text-text-primary outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--surface-3)",
              }}
            >
              <option value="">Select a playlist</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Day
            </label>
            <select
              value={formData.day_of_week ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  day_of_week: e.target.value === "" ? null : parseInt(e.target.value),
                })
              }
              className="w-full px-4 py-3 rounded-xl text-text-primary outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--surface-3)",
              }}
            >
              <option value="">Every day</option>
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl text-text-primary outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-3)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl text-text-primary outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-3)",
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!formData.name.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : editingId ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
