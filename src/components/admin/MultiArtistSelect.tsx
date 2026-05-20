"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Artist, TrackArtist } from "@/lib/supabase/types";

interface ArtistWithRole {
  artist: Artist;
  role: TrackArtist["role"];
}

interface MultiArtistSelectProps {
  value: ArtistWithRole[];
  onChange: (artists: ArtistWithRole[]) => void;
  disabled?: boolean;
}

const ROLES: { value: TrackArtist["role"]; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "featured", label: "Featured" },
  { value: "producer", label: "Producer" },
  { value: "remixer", label: "Remixer" },
];

export function MultiArtistSelect({ value, onChange, disabled }: MultiArtistSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Artist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchArtists = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/artists/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      const selectedIds = new Set(value.map((v) => v.artist.id));
      setResults((data.artists || []).filter((a: Artist) => !selectedIds.has(a.id)));
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchArtists(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, searchArtists]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddArtist = (artist: Artist) => {
    const role: TrackArtist["role"] = value.length === 0 ? "primary" : "featured";
    onChange([...value, { artist, role }]);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveArtist = (artistId: number) => {
    onChange(value.filter((v) => v.artist.id !== artistId));
  };

  const handleRoleChange = (artistId: number, role: TrackArtist["role"]) => {
    onChange(value.map((v) => (v.artist.id === artistId ? { ...v, role } : v)));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-text-secondary">Artists</label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(({ artist, role }) => (
            <div
              key={artist.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-sm font-medium text-text-primary">{artist.name}</span>
              <select
                value={role}
                onChange={(e) => handleRoleChange(artist.id, e.target.value as TrackArtist["role"])}
                disabled={disabled}
                className="text-xs bg-transparent text-text-tertiary border-0 focus:ring-0 cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveArtist(artist.id)}
                  className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-error transition-colors"
                  aria-label={`Remove ${artist.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          disabled={disabled}
          placeholder={value.length === 0 ? "Search for an artist..." : "Add another artist..."}
          className="w-full px-4 py-2.5 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ember/50"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--surface-3)",
          }}
        />

        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-ember border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {showDropdown && (query || results.length > 0) && (
          <div
            className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden shadow-lg"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--surface-3)",
            }}
          >
            {results.length > 0 ? (
              <ul className="max-h-60 overflow-auto py-1">
                {results.map((artist) => (
                  <li key={artist.id}>
                    <button
                      type="button"
                      onClick={() => handleAddArtist(artist)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 text-left transition-colors"
                    >
                      {artist.image_url ? (
                        <img
                          src={artist.image_url}
                          alt={artist.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "var(--surface-3)" }}
                        >
                          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                          </svg>
                        </div>
                      )}
                      <span className="text-sm text-text-primary">{artist.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query && !isSearching ? (
              <div className="px-4 py-3 text-sm text-text-tertiary">No artists found</div>
            ) : null}
          </div>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-text-muted">Start typing to search for artists</p>
      )}
    </div>
  );
}
