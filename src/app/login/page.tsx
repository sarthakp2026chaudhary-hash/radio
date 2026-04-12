"use client";

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/radio";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Check if user is host and redirect accordingly
    if (data.user) {
      const { data: profile } = await supabase
        .from("users")
        .select("is_host")
        .eq("auth_id", data.user.id)
        .single() as { data: { is_host: boolean } | null };

      if (profile?.is_host) {
        router.push("/admin");
      } else {
        router.push("/radio");
      }
    } else {
      router.push(redirect);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-void">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, var(--ember-subtle) 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-12">
          <h1
            className="text-4xl md:text-5xl font-semibold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Welcome Back
          </h1>
          <p className="text-text-secondary text-lg">
            Sign in to continue
          </p>
        </div>

        {/* Login Card */}
        <div
          className="p-8 rounded-2xl"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--surface-3)",
          }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-ember transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-ember transition-colors"
                placeholder="Your password"
              />
            </div>

            {error && (
              <p className="text-error text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--ember)",
                color: "var(--void)",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/forgot-password"
              className="text-text-tertiary hover:text-text-secondary text-sm transition-colors"
            >
              Forgot password?
            </a>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="text-text-tertiary hover:text-text-secondary transition-colors"
          >
            &larr; Back to home
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-void">
          <div className="text-text-secondary">Loading...</div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
