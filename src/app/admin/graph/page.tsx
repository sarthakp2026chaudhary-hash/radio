"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KnowledgeGraph } from "@/components/admin/KnowledgeGraph";

export default function GraphPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
          <h1 className="text-lg font-semibold">Your brain</h1>
          <p className="text-xs text-text-tertiary">Every folder, playlist, song and artist — and how they connect.</p>
        </div>
        <Link href="/admin" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
          ← Dashboard
        </Link>
      </header>
      <div className="flex-1 relative">
        <KnowledgeGraph />
      </div>
    </main>
  );
}
