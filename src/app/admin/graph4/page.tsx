"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeGraph } from "@/components/admin/KnowledgeGraph";

const BEAM_FOLDER_NAME = "Beam me up, jesus.";
const DPRSH_FOLDER_NAME = "dprsh1";
const SAD_NODE = "#2E8B57"; // sea green — the sad (dprsh) songs, distinct from Beam's mint
const SAD_EDGE = "#5C82B0"; // blue — their threads

interface GraphNode {
  id: string;
  type: string;
}

export default function Graph4Page() {
  const router = useRouter();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = (await supabase
        .from("users")
        .select("is_host")
        .eq("auth_id", user.id)
        .single()) as { data: { is_host: boolean } | null };
      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }

      const res = await fetch("/api/folders");
      const data = await res.json();
      const folders: { id: number; name: string }[] = data.folders || [];
      const beam = folders.find((f) => f.name === BEAM_FOLDER_NAME);
      const dprsh = folders.find((f) => f.name?.toLowerCase() === DPRSH_FOLDER_NAME);
      if (!beam) {
        setErr("Couldn't find the “Beam me up, jesus.” folder.");
        return;
      }

      // Highlight = the songs that live in the dprsh subtree (the sad ones).
      let dprshSongIds: string[] = [];
      if (dprsh) {
        const g = await fetch(`/api/graph?folder=${dprsh.id}`).then((r) => r.json());
        dprshSongIds = (g.nodes || [])
          .filter((n: GraphNode) => n.type === "song")
          .map((n: GraphNode) => n.id);
      }
      setHighlight(dprshSongIds);
      setEndpoint(`/api/graph?folder=${beam.id}`);
    })();
  }, [router]);

  const ready = endpoint && highlight !== null;

  return (
    <main className="h-screen flex flex-col bg-void">
      <header className="border-b border-surface-3 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Brain 4 · the sad ones</h1>
          <p className="text-xs text-text-tertiary">
            All of “Beam me up, jesus.” stays green — songs that are also in a{" "}
            <span style={{ color: SAD_NODE }}>dprsh</span> playlist turn sea green with{" "}
            <span style={{ color: SAD_EDGE }}>blue</span> edges.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/graph" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 1</Link>
          <Link href="/admin/graph2" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 2</Link>
          <Link href="/admin/graph3" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 3</Link>
          <Link href="/admin" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">← Dashboard</Link>
        </div>
      </header>
      <div className="flex-1 relative">
        {err ? (
          <div className="flex items-center justify-center h-full text-text-secondary">{err}</div>
        ) : ready ? (
          <KnowledgeGraph
            endpoint={endpoint!}
            songColor={SAD_NODE}
            songEdgeColor={SAD_EDGE}
            highlightSongIds={highlight!}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">Loading…</div>
        )}
      </div>
    </main>
  );
}
