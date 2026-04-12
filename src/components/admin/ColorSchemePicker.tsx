"use client";

import { useState } from "react";
import { useColorScheme } from "@/hooks/useColorScheme";

export function ColorSchemePicker() {
  const { currentSchemeId, setScheme, schemes } = useColorScheme();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSelect = async (schemeId: string) => {
    if (schemeId === currentSchemeId || isUpdating) return;

    setIsUpdating(true);
    await setScheme(schemeId);
    setIsUpdating(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-secondary">Color Scheme</h3>
      <div className="flex flex-wrap gap-2">
        {schemes.map((scheme) => (
          <button
            key={scheme.id}
            onClick={() => handleSelect(scheme.id)}
            disabled={isUpdating}
            className={`
              relative w-10 h-10 rounded-xl transition-all duration-200
              ${currentSchemeId === scheme.id ? "scale-110" : "hover:scale-105"}
              ${isUpdating ? "opacity-50" : ""}
            `}
            style={{
              background: scheme.gradient,
              boxShadow: currentSchemeId === scheme.id
                ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${scheme.accent}`
                : "none",
            }}
            title={scheme.name}
          >
            {currentSchemeId === scheme.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white drop-shadow-lg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">
        {schemes.find(s => s.id === currentSchemeId)?.name} — changes apply instantly for all listeners
      </p>
    </div>
  );
}
