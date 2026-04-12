"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

interface DropdownItemProps {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
}

export function Dropdown({ trigger, children, align = "right" }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle SSR - only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position when menu opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
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

  const menu = isOpen && mounted && (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-48 rounded-xl overflow-hidden shadow-2xl animate-fade-in"
      style={{
        top: position.top,
        ...(align === "right" ? { right: position.right } : { left: position.left }),
        background: "var(--surface-1)",
        border: "1px solid var(--surface-3)",
      }}
    >
      {children}
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger}
      </div>
      {mounted && createPortal(menu, document.body)}
    </>
  );
}

export function DropdownItem({ children, onClick, icon }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
    >
      {icon && <span className="text-text-tertiary">{icon}</span>}
      <span className="text-text-primary text-sm">{children}</span>
    </button>
  );
}

export function DropdownDivider() {
  return <div className="border-t border-surface-3" />;
}
