"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force";

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
}

// Fallback fill when a node has no brain color (white/loose song, dim artist).
const DEFAULT_FILL: Record<NodeType, string> = {
  folder: "#8a8aa0",
  playlist: "#8a8aa0",
  song: "#e8e8f0",
  artist: "#4a4a5a",
};
const RADIUS: Record<NodeType, number> = { folder: 9, playlist: 6, song: 3, artist: 4 };

// Interactive canvas force-graph of the whole library. d3-force lays it out
// (quadtree → handles ~1.3k nodes); we render to canvas with pan (drag) + zoom (wheel).
export function KnowledgeGraph({ endpoint = "/api/graph", bigType }: { endpoint?: string; bigType?: NodeType }) {
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
        if (l.color) {
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
  }, [endpoint, bigType]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ cursor: "grab", touchAction: "none" }} />
      <div className="absolute top-3 left-3 text-xs text-text-muted pointer-events-none">{status}</div>
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-[11px] text-text-tertiary pointer-events-none">
        <span>Color = brain (a folder you color)</span>
        <span><span style={{ color: "#e8e8f0" }}>●</span> white = loose / in many brains</span>
        <span><span style={{ color: "#8a8aa0" }}>●</span> uncolored folder/playlist</span>
        <span><span style={{ color: "#4a4a5a" }}>●</span> artist</span>
      </div>
    </div>
  );
}
