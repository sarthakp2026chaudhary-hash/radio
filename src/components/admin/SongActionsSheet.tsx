"use client";

import { useEffect, useMemo, useState } from "react";

interface PlaylistMembership {
  id: number;
  name: string;
  folder_id: number | null;
  in: boolean;
}
interface FolderLite {
  id: number;
  name: string;
}

interface SongActionsSheetProps {
  trackId: number;
  trackTitle: string;
  onClose: () => void;
}

// Compact "Add to playlist / where is this song" sheet (Spotify-style):
// search, + New playlist, and every playlist grouped by folder with a check
// for the ones the song is already in. Tap to add/remove (optimistic).
export function SongActionsSheet({ trackId, trackTitle, onClose }: SongActionsSheetProps) {
  const [playlists, setPlaylists] = useState<PlaylistMembership[]>([]);
  const [folders, setFolders] = useState<FolderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState<Record<number, boolean>>({});

  const load = async () => {
    try {
      const res = await fetch(`/api/tracks/${trackId}/playlists`);
      const data = await res.json();
      setPlaylists(data.playlists || []);
      setFolders(data.folders || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const folderName = (fid: number | null) => (fid == null ? "No folder" : folders.find((f) => f.id === fid)?.name || "Folder");

  const toggle = async (pl: PlaylistMembership) => {
    if (pending[pl.id]) return;
    const nowIn = !pl.in;
    setPending((p) => ({ ...p, [pl.id]: true }));
    setPlaylists((ps) => ps.map((x) => (x.id === pl.id ? { ...x, in: nowIn } : x)));
    try {
      if (nowIn) {
        await fetch(`/api/playlists/${pl.id}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track_id: trackId }),
        });
      } else {
        await fetch(`/api/playlists/${pl.id}/tracks?track_id=${trackId}`, { method: "DELETE" });
      }
    } catch {
      setPlaylists((ps) => ps.map((x) => (x.id === pl.id ? { ...x, in: !nowIn } : x)));
    } finally {
      setPending((p) => ({ ...p, [pl.id]: false }));
    }
  };

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        await fetch(`/api/playlists/${data.playlist.id}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track_id: trackId }),
        });
        setNewName("");
        setCreating(false);
        await load();
      }
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(
    () => playlists.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [playlists, query]
  );

  const groups = useMemo(() => {
    const m = new Map<string, PlaylistMembership[]>();
    filtered.forEach((p) => {
      const k = folderName(p.folder_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    });
    return Array.from(m.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, folders]);

  const inCount = playlists.filter((p) => p.in).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
        style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-text-muted uppercase tracking-wide">Add to playlist</p>
          <p className="text-sm text-text-secondary truncate mt-0.5">{trackTitle}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            In {inCount} playlist{inCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="px-4 pb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a playlist"
            className="w-full px-3 py-2 rounded-lg text-sm text-text-primary"
            style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
          />
        </div>

        <div className="px-2">
          {!creating ? (
            <button onClick={() => setCreating(true)} className="w-full text-left px-3 py-2 text-sm text-ember hover:bg-surface-2 rounded-lg transition-colors">
              + New playlist
            </button>
          ) : (
            <div className="px-3 py-2 flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndAdd();
                  if (e.key === "Escape") setCreating(false);
                }}
                className="flex-1 px-2 py-1 rounded text-sm text-text-primary"
                style={{ background: "var(--surface-2)", border: "1px solid var(--surface-3)" }}
              />
              <button onClick={createAndAdd} className="px-3 py-1 rounded-md bg-ember text-white text-xs hover:opacity-90">
                Add
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <p className="text-sm text-text-muted px-3 py-3">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-text-muted px-3 py-3">No playlists.</p>
          ) : (
            groups.map(([folder, pls]) => (
              <div key={folder} className="mb-1">
                <p className="text-[11px] uppercase tracking-wide text-text-muted px-3 py-1">{folder}</p>
                {pls.map((pl) => (
                  <button
                    key={pl.id}
                    disabled={pending[pl.id]}
                    onClick={() => toggle(pl)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left disabled:opacity-60"
                  >
                    <span className="text-sm text-text-secondary truncate flex-1">{pl.name}</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 ${
                        pl.in ? "bg-success text-void" : "border border-surface-3 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 flex justify-end border-t" style={{ borderColor: "var(--surface-3)" }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-full bg-ember text-white text-sm font-medium hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
