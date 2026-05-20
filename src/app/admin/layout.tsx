"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

interface User {
  id: number;
  display_name: string;
  is_host: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
