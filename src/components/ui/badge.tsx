"use client";

import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "ember";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-surface-3 text-text-secondary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    error: "bg-error/15 text-error",
    ember: "bg-ember/15 text-ember",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
