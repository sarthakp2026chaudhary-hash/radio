"use client";

import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceRadial } from "d3-force";
import { BRAIN_GREEN as GREEN, BRAIN_SAD_BLUE as SAD_BLUE, BRAIN_BRIDGE as BRIDGE } from "@/lib/brain-colors";

type NodeType = "artist" | "song" | "playlist";
interface GNode {
  id: string;
  type: NodeType;
  label: string;
  r: number;
  songs: number;
  playlists: number;
  mono: boolean;
  fill: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}
interface GLink {
  source: string | GNode;
  target: string | GNode;
  blue: boolean; // edge belongs to a dprsh playlist
}

// dprsh ("sad") coloring (palette shared with Brain 4 via brain-colors). Genres are
// encoded by EDGE color (green = normal, blue = dprsh); a NODE's color blends the
// genres it belongs to: only-green → green, only-dprsh → sad blue, BOTH → aqua bridge.
// This applies to songs AND artists (an artist's genres = the union over its songs).
// A white ring marks a node that belongs to exactly ONE genre (mono); multi-genre
// bridges get no ring. Edges are colored by their PLAYLIST end, so a bridge shows one
// blue + one green edge.
const RADIAL = { artist: 0, song: 430, playlist: 700 } as const;

interface Tip {
  x: number;
  y: number;
  type: NodeType;
  label: string;
  songs: number;
  playlists: number;
  mono: boolean;
}

export function ConcentricBrain({ dprshPlaylistIds = [] }: { dprshPlaylistIds?: string[] } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading…");
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dprshPlaylists = new Set(dprshPlaylistIds);

    let raf = 0;
    let nodes: GNode[] = [];
    let links: GLink[] = [];
    const neighbors = new Map<string, Set<string>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sim: any;
    const view = { x: 0, y: 0, k: 0.5 };
    let hoverId: string | null = null;
    let selectedId: string | null = null;
    let dragNode: GNode | null = null;
    let panning = false;
    const last = { x: 0, y: 0 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const toWorld = (sx: number, sy: number) => ({ x: (sx - view.x) / view.k, y: (sy - view.y) / view.k });

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.k, view.k);

      const active = hoverId || selectedId;
      const lit = active ? neighbors.get(active) ?? new Set<string>() : null;

      // links
      ctx.lineWidth = 0.6 / view.k;
      for (const l of links) {
        const s = l.source as GNode;
        const t = l.target as GNode;
        if (s.x == null || t.x == null) continue;
        const on = active ? s.id === active || t.id === active : false;
        const rgb = l.blue ? "92,130,176" : "62,207,142";
        ctx.strokeStyle = on
          ? `rgba(${rgb},0.6)`
          : active
          ? "rgba(255,255,255,0.025)"
          : `rgba(${rgb},${l.blue ? 0.16 : 0.1})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y as number);
        ctx.lineTo(t.x, t.y as number);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        if (n.x == null) continue;
        const dim = active ? !(n.id === active || (lit && lit.has(n.id))) : false;
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y as number, n.r / view.k, 0, Math.PI * 2);
        ctx.fillStyle = n.fill;
        ctx.fill();
        if (n.mono) {
          ctx.lineWidth = 1.4 / view.k;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // labels: playlists always, big artists, and the active node
      ctx.fillStyle = "rgba(232,232,240,0.8)";
      for (const n of nodes) {
        if (n.x == null) continue;
        const show = n.type === "playlist" || (n.type === "artist" && n.songs >= 5) || n.id === active;
        if (!show) continue;
        if (active && !(n.id === active || (lit && lit.has(n.id)))) continue;
        ctx.font = `${(n.type === "playlist" ? 11 : 10) / view.k}px sans-serif`;
        ctx.fillText(n.label, n.x + (n.r + 3) / view.k, (n.y as number) + 3 / view.k);
      }
      ctx.restore();
    };

    const hitTest = (sx: number, sy: number): GNode | null => {
      const w = toWorld(sx, sy);
      let best: GNode | null = null;
      let bd = Infinity;
      for (const n of nodes) {
        if (n.x == null) continue;
        const dx = n.x - w.x;
        const dy = (n.y as number) - w.y;
        const d = dx * dx + dy * dy;
        const rr = (n.r + 4) / view.k;
        if (d < bd && d < rr * rr) {
          bd = d;
          best = n;
        }
      }
      return best;
    };

    (async () => {
      try {
        const res = await fetch("/api/graph");
        const data = await res.json();
        const rawNodes = (data.nodes || []) as { id: string; type: string; label: string }[];
        const rawLinks = (data.links || []) as { source: string; target: string }[];

        // 3 types only (hide folders); keep playlist↔song and song↔artist links
        const keep = new Set(rawNodes.filter((n) => n.type !== "folder").map((n) => n.id));
        const flinks = rawLinks.filter((l) => keep.has(l.source) && keep.has(l.target));

        // metadata from raw (string) links
        const songPlaylists = new Map<string, Set<string>>();
        const artistSongs = new Map<string, Set<string>>();
        const playlistSongs = new Map<string, Set<string>>();
        const add = (m: Map<string, Set<string>>, k: string, v: string) => {
          if (!m.has(k)) m.set(k, new Set());
          m.get(k)!.add(v);
        };
        for (const l of flinks) {
          if (l.source.startsWith("p") && l.target.startsWith("s")) {
            add(songPlaylists, l.target, l.source);
            add(playlistSongs, l.source, l.target);
          } else if (l.source.startsWith("s") && l.target.startsWith("a")) {
            add(artistSongs, l.target, l.source);
          }
        }

        // Genre membership per node (green = a non-dprsh playlist, blue = a dprsh playlist).
        // An artist's genres = the union over its songs' playlists.
        //   color: both genres → bridge aqua; blue only → sad blue; green only → green.
        //   white ring (mono) = belongs to exactly ONE genre (songs/artists only).
        nodes = rawNodes
          .filter((n) => n.type !== "folder")
          .map((n) => {
            const type = n.type as NodeType;
            let songs = 0;
            const pls = new Set<string>();
            if (type === "artist") {
              const ss = artistSongs.get(n.id) ?? new Set<string>();
              songs = ss.size;
              ss.forEach((s) => (songPlaylists.get(s) ?? new Set()).forEach((p) => pls.add(p)));
            } else if (type === "song") {
              (songPlaylists.get(n.id) ?? new Set()).forEach((p) => pls.add(p));
            } else {
              songs = (playlistSongs.get(n.id) ?? new Set()).size;
            }

            let hasGreen = false;
            let hasBlue = false;
            if (type === "playlist") {
              if (dprshPlaylists.has(n.id)) hasBlue = true;
              else hasGreen = true;
            } else {
              for (const p of pls) {
                if (dprshPlaylists.has(p)) hasBlue = true;
                else hasGreen = true;
              }
            }

            let fill = GREEN;
            if (hasBlue && hasGreen) fill = BRIDGE;
            else if (hasBlue) fill = SAD_BLUE;
            const mono = type !== "playlist" && hasGreen !== hasBlue; // in exactly one genre
            const r = type === "artist" ? 3 + Math.sqrt(songs) * 1.9 : type === "playlist" ? 5.5 : 2.5;
            return { id: n.id, type, label: n.label, r, songs, playlists: pls.size, mono, fill };
          });
        links = flinks.map((l) => {
          const pid = l.source.startsWith("p") ? l.source : l.target.startsWith("p") ? l.target : null;
          return { source: l.source, target: l.target, blue: pid ? dprshPlaylists.has(pid) : false };
        });

        for (const l of links) {
          const s = l.source as string;
          const t = l.target as string;
          add(neighbors, s, t);
          add(neighbors, t, s);
        }

        setStatus(`${nodes.length} nodes · ${links.length} links — drag a node to move it, hover to highlight`);
        resize();
        const rect = canvas.getBoundingClientRect();
        view.x = rect.width / 2;
        view.y = rect.height / 2;

        sim = forceSimulation<GNode>(nodes)
          .force("radial", forceRadial<GNode>((d) => RADIAL[d.type], 0, 0).strength(0.9))
          .force("charge", forceManyBody().strength(-9))
          .force("link", forceLink<GNode, GLink>(links).id((d) => d.id).distance(18).strength(0.04))
          .force("collide", forceCollide<GNode>((d) => d.r + 1.5))
          .alpha(1)
          .alphaDecay(0.02);

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
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      canvas.setPointerCapture?.(e.pointerId);
      if (hit) {
        dragNode = hit;
        selectedId = hit.id;
        sim?.alphaTarget(0.15).restart();
        const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        hit.fx = w.x;
        hit.fy = w.y;
      } else {
        panning = true;
        selectedId = null;
        last.x = e.clientX;
        last.y = e.clientY;
      }
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (dragNode) {
        const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
        dragNode.fx = w.x;
        dragNode.fy = w.y;
        return;
      }
      if (panning) {
        view.x += e.clientX - last.x;
        view.y += e.clientY - last.y;
        last.x = e.clientX;
        last.y = e.clientY;
        return;
      }
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      hoverId = hit?.id ?? null;
      if (hit) {
        setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: hit.type, label: hit.label, songs: hit.songs, playlists: hit.playlists, mono: hit.mono });
        canvas.style.cursor = "pointer";
      } else {
        setTip(null);
        canvas.style.cursor = "grab";
      }
    };
    const onUp = () => {
      if (dragNode) {
        // leave fx/fy pinned so the node stays where dropped (movable)
        sim?.alphaTarget(0);
      }
      dragNode = null;
      panning = false;
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
  }, [dprshPlaylistIds]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ cursor: "grab", touchAction: "none" }} />

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 p-3 rounded-xl text-[11px] text-text-tertiary pointer-events-none space-y-1.5"
        style={{ background: "rgba(17,17,19,0.7)", border: "1px solid var(--surface-3)" }}
      >
        <div className="font-mono uppercase tracking-wide text-text-secondary mb-1">The brain</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: GREEN }} /> one genre (green)</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: SAD_BLUE }} /> dprsh only</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: BRIDGE }} /> bridge (both genres)</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full ring-1 ring-white" style={{ background: "transparent" }} /> white ring = single genre</div>
        <div className="text-text-muted pt-1">Artist inner · song middle · playlist outer. Bigger artist = more songs.</div>
      </div>

      <div className="absolute top-3 left-3 text-xs text-text-muted pointer-events-none">{status}</div>

      {/* Hover tooltip */}
      {tip && (
        <div
          className="absolute z-10 p-3 rounded-xl pointer-events-none max-w-xs"
          style={{ left: tip.x + 14, top: tip.y + 14, background: "rgba(17,17,19,0.92)", border: "1px solid var(--surface-3)" }}
        >
          <div className="text-[10px] uppercase tracking-wide text-text-muted">{tip.type}</div>
          <div className="text-sm text-text-primary mt-0.5">{tip.label}</div>
          <div className="text-xs text-text-tertiary mt-1">
            {tip.type === "artist" && `${tip.songs} song${tip.songs === 1 ? "" : "s"} · in ${tip.playlists} playlist${tip.playlists === 1 ? "" : "s"}`}
            {tip.type === "song" && `in ${tip.playlists} playlist${tip.playlists === 1 ? "" : "s"}`}
            {tip.type === "playlist" && `${tip.songs} song${tip.songs === 1 ? "" : "s"}`}
            {tip.mono && tip.type !== "playlist" && " · one genre"}
          </div>
        </div>
      )}
    </div>
  );
}
