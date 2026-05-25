"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConcentricBrain } from "@/components/admin/ConcentricBrain";

export default function Graph3Page() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [dprshIds, setDprshIds] = useState<string[]>([]);

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
      // Resolve the dprsh1 folder's playlists so the brain can paint them sad.
      const { data: folder } = (await supabase
        .from("folders")
        .select("id")
        .eq("name", "dprsh1")
        .maybeSingle()) as { data: { id: number } | null };
      if (folder) {
        const { data: pls } = (await supabase
          .from("playlists")
          .select("id")
          .eq("folder_id", folder.id)) as { data: { id: number }[] | null };
        setDprshIds((pls || []).map((p) => `p${p.id}`));
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <span className="text-text-secondary">Loading…</span>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-void">
      <header className="border-b border-surface-3 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Brain 3 · the brain</h1>
          <p className="text-xs text-text-tertiary">Artists inner · songs middle · playlists outer — dprsh playlists/edges go sad blue, their songs sea green.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/graph" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 1</Link>
          <Link href="/admin/graph2" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Brain 2</Link>
          <Link href="/admin" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">← Dashboard</Link>
        </div>
      </header>
      <div className="flex-1 relative">
        <ConcentricBrain dprshPlaylistIds={dprshIds} />
      </div>
    </main>
  );
}
