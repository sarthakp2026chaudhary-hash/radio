"use client";

interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, max = 100, size = "md", showLabel = false, className = "" }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-tertiary mb-1">
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden`}
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className={`${heightClass} rounded-full transition-all duration-300 ease-out`}
          style={{
            width: `${percentage}%`,
            background: "var(--ember)",
          }}
        />
      </div>
    </div>
  );
}
