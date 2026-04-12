"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface Notification {
  id: string;
  text: string;
}

interface NotificationStackProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationStack({
  notifications,
  onDismiss,
}: NotificationStackProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || notifications.length === 0) return null;

  const stack = (
    <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-2 pointer-events-none">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );

  return createPortal(stack, document.body);
}

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, 4700);

    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div
      className={`
        pointer-events-auto px-4 py-3 rounded-xl shadow-lg
        flex items-center gap-3 min-w-[200px] max-w-[320px]
        transition-all duration-300 ease-out
        ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0 animate-slide-in-right"}
      `}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--ember-subtle)",
      }}
    >
      <span
        className="text-lg"
        role="img"
        aria-label="love"
      >
        💕
      </span>
      <span className="text-sm text-text-primary flex-1">{notification.text}</span>
    </div>
  );
}
