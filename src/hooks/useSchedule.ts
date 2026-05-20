"use client";

import { useState, useEffect, useCallback } from "react";

interface Playlist {
  id: number;
  name: string;
}

interface Schedule {
  id: number;
  channel_id: number;
  name: string;
  playlist_id: number | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  playlist: Playlist | null;
}

interface CreateScheduleData {
  name: string;
  playlist_id?: number | null;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
}

interface UpdateScheduleData {
  id: number;
  name?: string;
  playlist_id?: number | null;
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

export function useSchedule(channelSlug: string) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channels/${channelSlug}/schedule`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch schedules");
      }

      setSchedules(data.schedules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [channelSlug]);

  const createSchedule = useCallback(
    async (data: CreateScheduleData) => {
      const res = await fetch(`/api/channels/${channelSlug}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create schedule");
      }

      await fetchSchedules();
      return result.schedule;
    },
    [channelSlug, fetchSchedules]
  );

  const updateSchedule = useCallback(
    async (data: UpdateScheduleData) => {
      const res = await fetch(`/api/channels/${channelSlug}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to update schedule");
      }

      await fetchSchedules();
      return result.schedule;
    },
    [channelSlug, fetchSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/channels/${channelSlug}/schedule?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete schedule");
      }

      await fetchSchedules();
    },
    [channelSlug, fetchSchedules]
  );

  const applySchedule = useCallback(async () => {
    const res = await fetch(`/api/channels/${channelSlug}/schedule/apply`, {
      method: "POST",
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Failed to apply schedule");
    }

    return result;
  }, [channelSlug]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    isLoading,
    error,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    applySchedule,
  };
}

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];
