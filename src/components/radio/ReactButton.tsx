"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { playSticker, getAvailableStickers, type StickerId } from "@/lib/audio/sticker-player";

interface ReactButtonProps {
  onSend: (stickerId: string, label: string) => void;
  disabled?: boolean;
}

export function ReactButton({ onSend, disabled }: ReactButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ bottom: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const stickers = getAvailableStickers();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedOutsideButton = buttonRef.current && !buttonRef.current.contains(target);
      const clickedOutsidePopover = popoverRef.current && !popoverRef.current.contains(target);

      if (clickedOutsideButton && clickedOutsidePopover) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSend = async (stickerId: string, label: string) => {
    if (cooldown) return;

    // Play audio for the listener
    await playSticker(stickerId as StickerId);

    // Broadcast to host
    onSend(stickerId, label);

    // Visual feedback
    setJustSent(true);
    setTimeout(() => setJustSent(false), 1500);

    // Set cooldown
    setCooldown(true);
    setTimeout(() => setCooldown(false), 3000);

    setIsOpen(false);
  };

  const popover = isOpen && (
    <div
      ref={popoverRef}
      className="fixed z-[9999] p-3 rounded-2xl animate-fade-in"
      style={{
        bottom: position.bottom,
        right: position.right,
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex flex-col gap-2">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => handleSend(sticker.id, sticker.label)}
            disabled={cooldown}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl
              transition-all duration-200
              ${cooldown ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-2"}
              ${justSent ? "animate-pulse-once" : ""}
            `}
            style={{
              background: justSent ? "var(--ember-subtle)" : undefined,
            }}
          >
            <span className="text-2xl">💕</span>
            <span className="text-text-primary text-sm">
              {justSent ? "Sent!" : sticker.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          fixed bottom-6 right-6 w-12 h-12 rounded-full
          flex items-center justify-center
          transition-all duration-200
          hover:scale-110 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed
          z-50
        `}
        style={{
          background: isOpen ? "var(--ember)" : "var(--surface-2)",
          border: `1px solid ${isOpen ? "var(--ember)" : "var(--surface-3)"}`,
          boxShadow: isOpen ? "0 0 20px var(--ember-subtle)" : "0 4px 12px rgba(0,0,0,0.2)",
        }}
        aria-label="Send reaction"
      >
        <span className={`text-xl transition-transform duration-200 ${isOpen ? "scale-110" : ""}`}>
          💕
        </span>
      </button>
      {mounted && createPortal(popover, document.body)}
    </>
  );
}
