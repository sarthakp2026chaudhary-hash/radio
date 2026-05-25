"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeGraph } from "@/components/admin/KnowledgeGraph";
import { BRAIN_SAD_BLUE, BRAIN_BRIDGE } from "@/lib/brain-colors";

const BEAM_FOLDER_NAME = "Beam me up, jesus.";
const DPRSH_FOLDER_NAME = "dprsh1";

export default function Graph4Page() {
  const router = useRouter();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [dprshIds, setDprshIds] = useState<string[] | null>(null);
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

      const { data: folders } = (await supabase
        .from("folders")
        .select("id, name")
        .in("name", [BEAM_FOLDER_NAME, DPRSH_FOLDER_NAME])) as { data: { id: number; name: string }[] | null };
      const beam = (folders || []).find((f) => f.name === BEAM_FOLDER_NAME);
      const dprsh = (folders || []).find((f) => f.name === DPRSH_FOLDER_NAME);
      if (!beam) {
        setErr("Couldn't find the “Beam me up, jesus.” folder.");
        return;
      }

      let ids: string[] = [];
      if (dprsh) {
        const { data: pls } = (await supabase
          .from("playlists")
          .select("id")
          .eq("folder_id", dprsh.id)) as { data: { id: number }[] | null };
        ids = (pls || []).map((p) => `p${p.id}`);
      }
      setDprshIds(ids);
      setEndpoint(`/api/graph?folder=${beam.id}`);
    })();
  }, [router]);

  const ready = endpoint && dprshIds !== null;

  return (
    <main className="h-screen flex flex-col bg-void">
      <header className="border-b border-surface-3 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Brain 4 · the sad ones</h1>
          <p className="text-xs text-text-tertiary">
            All of “Beam me up, jesus.” stays green — songs only in a{" "}
            <span style={{ color: BRAIN_SAD_BLUE }}>dprsh</span> playlist go sad blue; songs that{" "}
            <span style={{ color: BRAIN_BRIDGE }}>bridge</span> dprsh + another playlist turn aqua (the blue+green mix).
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
          <KnowledgeGraph endpoint={endpoint!} dprshPlaylistIds={dprshIds!} />
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">Loading…</div>
        )}
      </div>
    </main>
  );
}
