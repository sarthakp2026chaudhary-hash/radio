"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeGraph } from "@/components/admin/KnowledgeGraph";

const DPRSH_FOLDER_NAME = "dprsh1";
const SAD_NODE = "#3CB371"; // sea green — the sad songs
const SAD_EDGE = "#5C82B0"; // sad blue — their threads

export default function Graph4Page() {
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
      const dprsh = (data.folders || []).find(
        (f: { id: number; name: string }) => f.name?.toLowerCase() === DPRSH_FOLDER_NAME
      );
      if (!dprsh) {
        setErr("Couldn't find the “dprsh1” folder.");
        return;
      }
      setEndpoint(`/api/graph?folder=${dprsh.id}`);
    })();
  }, [router]);

  return (
    <main className="h-screen flex flex-col bg-void">
      <header className="border-b border-surface-3 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Brain 4 · sad songs</h1>
          <p className="text-xs text-text-tertiary">
            The <span style={{ color: SAD_NODE }}>dprsh1</span> folder — sad songs in sea green, their threads in sad blue.
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
        ) : endpoint ? (
          <KnowledgeGraph endpoint={endpoint} songColor={SAD_NODE} songEdgeColor={SAD_EDGE} />
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">Loading…</div>
        )}
      </div>
    </main>
  );
}
