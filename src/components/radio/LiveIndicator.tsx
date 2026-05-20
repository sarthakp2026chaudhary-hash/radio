"use client";

import { useHostPresence } from "@/hooks/useHostPresence";

interface LiveIndicatorProps {
  channelId?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LiveIndicator({ channelId, showLabel = true, size = "md" }: LiveIndicatorProps) {
  const { isLive, isLiveOnChannel, user, isLoading } = useHostPresence(channelId);

  const isActive = channelId ? isLiveOnChannel : isLive;

  if (isLoading || !isActive) return null;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div className={`flex items-center gap-1.5 ${sizeClasses[size]}`}>
      <span className={`${dotSizes[size]} rounded-full bg-red-500 animate-pulse`} />
      {showLabel && (
        <span className="font-medium text-red-500 uppercase tracking-wide">
          Live
        </span>
      )}
      {showLabel && user && (
        <span className="text-text-tertiary ml-1">
          • {user.display_name} is listening
        </span>
      )}
    </div>
  );
}

export function LiveBanner({ channelId }: { channelId?: number }) {
  const { isLive, isLiveOnChannel, user, channel, sessionStartedAt } = useHostPresence(channelId);

  const isActive = channelId ? isLiveOnChannel : isLive;

  if (!isActive) return null;

  const startTime = sessionStartedAt ? new Date(sessionStartedAt) : null;
  const formattedTime = startTime
    ? startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="flex items-center justify-center gap-3 py-2 px-4"
      style={{ background: "rgba(239, 68, 68, 0.1)" }}
    >
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-sm font-medium text-red-500">
        {user?.display_name || "Host"} is LIVE
        {channel && !channelId && ` on ${channel.name}`}
        {formattedTime && ` since ${formattedTime}`}
      </span>
    </div>
  );
}
