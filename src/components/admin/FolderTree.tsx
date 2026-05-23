"use client";

import { useEffect, useMemo, useState } from "react";

interface PlaylistLite {
  id: number;
  name: string;
}
interface FolderRow {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  color: string | null;
  playlists?: PlaylistLite[];
}
interface TreeNode extends FolderRow {
  children: TreeNode[];
}
interface SongLite {
  id: number;
  title: string;
}

interface FolderTreeProps {
  /** Load a whole playlist onto the active channel. */
  onPlayPlaylist: (playlistId: number, name: string) => void;
  /** Add a single song to the active channel's queue. When provided, playlists
   *  become expandable to reveal their songs. */
  onAddToQueue?: (trackId: number, title: string) => void;
}

// Spotify-style collapsible folder → playlist (→ song) tree, built from
// /api/folders?tree=1. Folders nest via parent_id; each folder carries its
// direct playlists; playlists expand to songs on demand.
export function FolderTree({ onPlayPlaylist, onAddToQueue }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [plOpen, setPlOpen] = useState<Record<number, boolean>>({});
  const [songs, setSongs] = useState<Record<number, SongLite[]>>({});
  const [plLoading, setPlLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/folders?tree=1");
        const data = await res.json();
        if (active) setFolders(data.folders || []);
      } catch {
        /* ignore — show empty state */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const roots = useMemo<TreeNode[]>(() => {
    const byId = new Map<number, TreeNode>();
    folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));
    const result: TreeNode[] = [];
    byId.forEach((node) => {
      if (node.parent_id && byId.has(node.parent_id)) {
        byId.get(node.parent_id)!.children.push(node);
      } else {
        result.push(node);
      }
    });
    return result;
  }, [folders]);

  const togglePlaylist = async (plId: number) => {
    const willOpen = !plOpen[plId];
    setPlOpen((o) => ({ ...o, [plId]: willOpen }));
    if (willOpen && !songs[plId]) {
      setPlLoading((l) => ({ ...l, [plId]: true }));
      try {
        const res = await fetch(`/api/playlists/${plId}`);
        const data = await res.json();
        const tracks: SongLite[] = (data.playlist?.playlist_tracks || [])
          .map((pt: { tracks?: { id: number; title: string } }) => pt.tracks)
          .filter(Boolean)
          .map((t: { id: number; title: string }) => ({ id: t.id, title: t.title }));
        setSongs((s) => ({ ...s, [plId]: tracks }));
      } catch {
        setSongs((s) => ({ ...s, [plId]: [] }));
      } finally {
        setPlLoading((l) => ({ ...l, [plId]: false }));
      }
    }
  };

  if (loading) return <p className="text-text-tertiary text-sm px-2 py-3">Loading library…</p>;
  if (folders.length === 0)
    return <p className="text-text-tertiary text-sm px-2 py-3">No folders yet. Import a genre or create one.</p>;

  const renderPlaylist = (pl: PlaylistLite, depth: number) => {
    const expandable = !!onAddToQueue;
    const isOpen = plOpen[pl.id];
    return (
      <div key={pl.id}>
        <div
          className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
          style={{ paddingLeft: 8 + (depth + 1) * 14 }}
        >
          <button
            onClick={() => (expandable ? togglePlaylist(pl.id) : onPlayPlaylist(pl.id, pl.name))}
            className="text-text-muted text-xs w-3 flex-shrink-0"
          >
            {expandable ? (isOpen ? "▾" : "▸") : "♪"}
          </button>
          <span
            className="text-sm text-text-tertiary truncate flex-1 cursor-pointer"
            onClick={() => (expandable ? togglePlaylist(pl.id) : onPlayPlaylist(pl.id, pl.name))}
          >
            {pl.name}
          </span>
          <button
            onClick={() => onPlayPlaylist(pl.id, pl.name)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-ember text-white hover:opacity-90 flex-shrink-0"
            title="Play this playlist on the selected channel"
          >
            ▶ Play
          </button>
        </div>
        {expandable && isOpen && (
          <div>
            {plLoading[pl.id] ? (
              <p className="text-xs text-text-muted px-2 py-1" style={{ paddingLeft: 8 + (depth + 2) * 14 }}>
                Loading…
              </p>
            ) : (songs[pl.id] || []).length === 0 ? (
              <p className="text-xs text-text-muted px-2 py-1" style={{ paddingLeft: 8 + (depth + 2) * 14 }}>
                No songs.
              </p>
            ) : (
              (songs[pl.id] || []).map((s) => (
                <div
                  key={s.id}
                  className="group/song flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
                  style={{ paddingLeft: 8 + (depth + 2) * 14 }}
                >
                  <span className="text-text-muted text-[10px] flex-shrink-0">•</span>
                  <span className="text-xs text-text-tertiary truncate flex-1">{s.title}</span>
                  <button
                    onClick={() => onAddToQueue?.(s.id, s.title)}
                    className="opacity-0 group-hover/song:opacity-100 transition-opacity text-[11px] px-2 py-0.5 rounded-md text-text-secondary hover:bg-surface-3 flex-shrink-0"
                    title="Add this song to the channel queue"
                  >
                    + Queue
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isOpen = open[node.id] ?? depth === 0;
    const playlists = node.playlists || [];
    return (
      <div key={node.id}>
        <button
          onClick={() => setOpen((o) => ({ ...o, [node.id]: !isOpen }))}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span className={`text-text-muted text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
          <span className="text-sm font-medium text-text-secondary truncate flex-1">{node.name}</span>
          <span className="text-[11px] text-text-muted">{playlists.length + node.children.length}</span>
        </button>
        {isOpen && (
          <div>
            {node.children.map((c) => renderNode(c, depth + 1))}
            {playlists.map((pl) => renderPlaylist(pl, depth))}
          </div>
        )}
      </div>
    );
  };

  return <div className="flex flex-col">{roots.map((n) => renderNode(n, 0))}</div>;
}
