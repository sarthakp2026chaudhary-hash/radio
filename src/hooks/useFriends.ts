"use client";

import { useState, useEffect, useCallback } from "react";

interface Friend {
  id: number;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users/friends");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch friends");
      }

      setFriends(data.friends || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  return { friends, isLoading, error, refresh: fetchFriends };
}
