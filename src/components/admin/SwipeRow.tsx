"use client";

import { useRef, useState, type ReactNode, type PointerEvent } from "react";

interface SwipeRowProps {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
}

const TRIGGER = 64; // px to commit a swipe
const MAX = 120;

// Horizontal swipe wrapper (pointer + touch). Right/left only commit past a
// threshold; vertical drags pass through so lists still scroll, and taps still
// reach buttons inside. A tiny haptic fires on commit. Mobile-first + comfortable.
export function SwipeRow({ children, onSwipeRight, onSwipeLeft, rightLabel = "Queue", leftLabel = "Next" }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const dxRef = useRef(0);

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    active.current = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!active.current) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
        active.current = true;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } else if (Math.abs(ddy) > 8) {
        start.current = null; // vertical scroll — let it through
        return;
      } else {
        return;
      }
    }
    let v = ddx;
    if (v > 0 && !onSwipeRight) v = 0;
    if (v < 0 && !onSwipeLeft) v = 0;
    v = Math.max(-MAX, Math.min(MAX, v));
    dxRef.current = v;
    setDx(v);
  };

  const finish = () => {
    if (active.current) {
      if (dxRef.current >= TRIGGER && onSwipeRight) {
        navigator.vibrate?.(15);
        onSwipeRight();
      } else if (dxRef.current <= -TRIGGER && onSwipeLeft) {
        navigator.vibrate?.(15);
        onSwipeLeft();
      }
    }
    start.current = null;
    active.current = false;
    dxRef.current = 0;
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
        <span className={`text-xs font-medium transition-colors ${dx > 12 ? "text-success" : "text-transparent"}`}>+ {rightLabel}</span>
        <span className={`text-xs font-medium transition-colors ${dx < -12 ? "text-ember" : "text-transparent"}`}>{leftLabel} →</span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          transform: `translateX(${dx}px)`,
          transition: active.current ? "none" : "transform 0.18s",
          touchAction: "pan-y",
          background: "var(--surface-1)",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
