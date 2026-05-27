"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalSearch } from "@/components/search/AdminGlobalSearch";

interface User {
  id: number;
  display_name: string;
  is_host: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("id, display_name, is_host")
        .eq("auth_id", authUser.id)
        .single() as { data: User | null };

      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }

      setUser(profile as User);
      setIsLoading(false);
    }

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
          <span className="text-text-secondary">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-void flex">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar — hidden on md+ where the sidebar is always visible */}
        <header
          className="md:hidden sticky top-0 z-30 flex flex-col gap-2 px-4 py-2 border-b border-surface-3"
          style={{ background: "var(--surface-1)" }}
        >
          <div className="flex items-center gap-3 h-10">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="p-1 -ml-1 text-text-secondary hover:text-text-primary"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="font-semibold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              Radio Admin
            </span>
          </div>
          <AdminGlobalSearch />
        </header>
        {/* Desktop search bar */}
        <header
          className="hidden md:flex sticky top-0 z-20 items-center gap-4 px-6 h-14 border-b border-surface-3"
          style={{ background: "var(--surface-1)" }}
        >
          <AdminGlobalSearch />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
