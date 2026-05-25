"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force";
import { BRAIN_SAD_BLUE, BRAIN_SEA_GREEN } from "@/lib/brain-colors";

type NodeType = "folder" | "playlist" | "song" | "artist";
interface GNode {
  id: string;
  type: NodeType;
  label: string;
  color?: string | null;
  x?: number;
  y?: number;
}
interface GLink {
  source: string | GNode;
  target: string | GNode;
  color?: string | null;
  blue?: boolean; // edge touches a dprsh playlist
}

// Fallback fill when a node has no brain color (white/loose song, dim artist).
const DEFAULT_FILL: Record<NodeType, string> = {
  folder: "#8a8aa0",
  playlist: "#8a8aa0",
  song: "#e8e8f0",
  artist: "#4a4a5a",
};
const RADIUS: Record<NodeType, number> = { folder: 9, playlist: 6, song: 3, artist: 4 };

// Brain 4's "sad" coloring, applied in-place to the fetched graph (before the force
// sim mutates link.source/target to node refs). Colors a song by its PLAYLIST
// membership: bridge (in a dprsh AND a non-dprsh playlist) → sea green; only-dprsh →
// sad blue; otherwise untouched. dprsh playlist nodes + any edge touching one → blue.
function applySadScheme(nodes: GNode[], links: GLink[], dprshPlaylistIds: string[]) {
  const dprsh = new Set(dprshPlaylistIds);
  if (dprsh.size === 0) return;
  const mem = new Map<string, { blue: number; green: number }>();
  for (const l of links) {
    const s = l.source;
    const t = l.target;
    if (typeof s !== "string" || typeof t !== "string") continue;
    if (s[0] === "p" && t[0] === "s") {
      const m = mem.get(t) ?? { blue: 0, green: 0 };
      if (dprsh.has(s)) m.blue++;
      else m.green++;
      mem.set(t, m);
    }
  }
  for (const n of nodes) {
    if (n.type === "playlist" && dprsh.has(n.id)) n.color = BRAIN_SAD_BLUE;
    else if (n.type === "song") {
      const m = mem.get(n.id);
      if (m && m.blue > 0 && m.green > 0) n.color = BRAIN_SEA_GREEN;
      else if (m && m.blue > 0) n.color = BRAIN_SAD_BLUE;
    }
  }
  for (const l of links) {
    const s = l.source;
    const t = l.target;
    if ((typeof s === "string" && dprsh.has(s)) || (typeof t === "string" && dprsh.has(t))) l.blue = true;
  }
}

// Interactive canvas force-graph. d3-force lays it out (quadtree → ~1.3k nodes);
// rendered to canvas with pan (drag) + zoom (wheel). When dprshPlaylistIds is passed
// (Brain 4) the sad coloring is applied; otherwise nodes/edges use the API colors.
export function KnowledgeGraph({
  endpoint = "/api/graph",
  bigType,
  dprshPlaylistIds,
}: {
  endpoint?: string;
  bigType?: NodeType;
  dprshPlaylistIds?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading…");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let nodes: GNode[] = [];
    let links: GLink[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sim: any;
    const view = { x: 0, y: 0, k: 1 };
    let hover: GNode | null = null;
    let dragging = false;
    const last = { x: 0, y: 0 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.k, view.k);

      ctx.lineWidth = 0.6 / view.k;
      for (const l of links) {
        const s = l.source as GNode;
        const t = l.target as GNode;
        if (s.x == null || t.x == null) continue;
        if (l.blue) {
          ctx.strokeStyle = BRAIN_SAD_BLUE;
          ctx.globalAlpha = 0.55;
        } else if (l.color) {
          ctx.strokeStyle = l.color;
          ctx.globalAlpha = 0.4;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.moveTo(s.x, s.y as number);
        ctx.lineTo(t.x, t.y as number);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const n of nodes) {
        if (n.x == null) continue;
        ctx.beginPath();
        ctx.arc(n.x, n.y as number, (bigType && n.type === bigType ? 11 : RADIUS[n.type]) / view.k, 0, Math.PI * 2);
        ctx.fillStyle = n.color ?? DEFAULT_FILL[n.type];
        ctx.fill();
      }

      // labels: folders + playlists always; songs/artists on hover
      ctx.fillStyle = "rgba(232,232,240,0.85)";
      for (const n of nodes) {
        if (n.x == null || (n.type !== "folder" && n.type !== "playlist")) continue;
        ctx.font = `${(n.type === "folder" ? 11 : 9) / view.k}px sans-serif`;
        ctx.fillText(n.label, n.x + (RADIUS[n.type] + 3) / view.k, (n.y as number) + 3 / view.k);
      }
      if (hover && hover.x != null) {
        ctx.font = `${12 / view.k}px sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.fillText(hover.label, hover.x + 7 / view.k, (hover.y as number) - 7 / view.k);
      }
      ctx.restore();
    };

    const toWorld = (sx: number, sy: number) => ({ x: (sx - view.x) / view.k, y: (sy - view.y) / view.k });

    (async () => {
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        nodes = data.nodes || [];
        links = data.links || [];
        if (dprshPlaylistIds) applySadScheme(nodes, links, dprshPlaylistIds);
        setStatus(`${nodes.length} nodes · ${links.length} links — drag to pan, scroll to zoom`);
        resize();
        const rect = canvas.getBoundingClientRect();
        view.x = rect.width / 2;
        view.y = rect.height / 2;

        sim = forceSimulation<GNode>(nodes)
          .force("charge", forceManyBody().strength(-26))
          .force("link", forceLink<GNode, GLink>(links).id((d) => d.id).distance(28).strength(0.35))
          .force("center", forceCenter(0, 0))
          .force("collide", forceCollide(4))
          .alpha(1)
          .alphaDecay(0.025);

        const loop = () => {
          draw();
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setStatus("Failed to load graph");
      }
    })();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const before = toWorld(mx, my);
      view.k *= e.deltaY < 0 ? 1.12 : 0.89;
      view.k = Math.max(0.08, Math.min(8, view.k));
      view.x = mx - before.x * view.k;
      view.y = my - before.y * view.k;
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      last.x = e.clientX;
      last.y = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (dragging) {
        view.x += e.clientX - last.x;
        view.y += e.clientY - last.y;
        last.x = e.clientX;
        last.y = e.clientY;
        return;
      }
      const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      let best: GNode | null = null;
      let bd = Infinity;
      for (const n of nodes) {
        if (n.x == null) continue;
        const dx = n.x - w.x;
        const dy = (n.y as number) - w.y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      const tol = 10 / view.k;
      hover = best && bd < tol * tol ? best : null;
    };
    const onUp = () => {
      dragging = false;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      sim?.stop();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
    };
  }, [endpoint, bigType, dprshPlaylistIds]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ cursor: "grab", touchAction: "none" }} />
      <div className="absolute top-3 left-3 text-xs text-text-muted pointer-events-none">{status}</div>
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-[11px] text-text-tertiary pointer-events-none">
        <span>Color = brain (a folder you color)</span>
        <span><span style={{ color: "#e8e8f0" }}>●</span> white = loose / in many brains</span>
        <span><span style={{ color: "#8a8aa0" }}>●</span> uncolored folder/playlist</span>
        <span><span style={{ color: "#4a4a5a" }}>●</span> artist</span>
        {dprshPlaylistIds && dprshPlaylistIds.length > 0 && (
          <>
            <span><span style={{ color: BRAIN_SEA_GREEN }}>●</span> sea green = bridge (dprsh + other)</span>
            <span><span style={{ color: BRAIN_SAD_BLUE }}>●</span> blue = only in dprsh</span>
          </>
        )}
      </div>
    </div>
  );
}
