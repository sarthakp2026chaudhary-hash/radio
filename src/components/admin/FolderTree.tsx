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

interface FolderTreeProps {
  /** Called when the user hits "Play" on a playlist — load it onto the active channel. */
  onPlayPlaylist: (playlistId: number, name: string) => void;
}

// Spotify-style collapsible folder → playlist tree, built from /api/folders?tree=1.
// Folders nest via parent_id; each folder carries its direct playlists.
export function FolderTree({ onPlayPlaylist }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<number, boolean>>({});

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

  if (loading) return <p className="text-text-tertiary text-sm px-2 py-3">Loading library…</p>;
  if (folders.length === 0)
    return <p className="text-text-tertiary text-sm px-2 py-3">No folders yet. Import a genre or create one.</p>;

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
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                style={{ paddingLeft: 8 + (depth + 1) * 14 }}
              >
                <span className="text-text-muted text-xs">♪</span>
                <span className="text-sm text-text-tertiary truncate flex-1">{pl.name}</span>
                <button
                  onClick={() => onPlayPlaylist(pl.id, pl.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-ember text-white hover:opacity-90"
                  title="Play this playlist on the selected channel"
                >
                  ▶ Play
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return <div className="flex flex-col">{roots.map((n) => renderNode(n, 0))}</div>;
}
