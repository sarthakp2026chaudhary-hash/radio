"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeGraph } from "@/components/admin/KnowledgeGraph";

const BEAM_FOLDER_NAME = "Beam me up, jesus.";

export default function Graph2Page() {
  const router = useRouter();
  const [endpoint, setEndpoint] = useState<string | null>(null);
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
      const beam = (data.folders || []).find((f: { id: number; name: string }) => f.name === BEAM_FOLDER_NAME);
      if (!beam) {
        setErr("Couldn't find the “Beam me up, jesus.” folder.");
        return;
      }
      setEndpoint(`/api/graph?folder=${beam.id}&excludeAudio=1`);
    })();
  }, [router]);

  return (
    <main className="h-screen flex flex-col bg-void">
      <header className="border-b border-surface-3 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Brain 2 · artist-centric</h1>
          <p className="text-xs text-text-tertiary">Beam me up, jesus. — artists (larger) and their songs/playlists, text-only.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/graph" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 1</Link>
          <Link href="/admin" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">← Dashboard</Link>
        </div>
      </header>
      <div className="flex-1 relative">
        {err ? (
          <div className="flex items-center justify-center h-full text-text-secondary">{err}</div>
        ) : endpoint ? (
          <KnowledgeGraph endpoint={endpoint} bigType="artist" />
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">Loading…</div>
        )}
      </div>
    </main>
  );
}
