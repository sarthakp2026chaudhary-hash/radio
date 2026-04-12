"use client";

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // Sign up the user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Database trigger automatically creates user record
    // With email confirmation disabled, user is logged in immediately
    if (data.user && data.session) {
      // Friends always go to /radio
      router.push("/radio");
    } else if (data.user && !data.session) {
      setError("Please check your email to confirm your account");
      setLoading(false);
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
            Join the Radio
          </h1>
          <p className="text-text-secondary text-lg">
            Create your account to listen along
          </p>
        </div>

        {/* Register Card */}
        <div
          className="p-8 rounded-2xl"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--surface-3)",
          }}
        >
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-ember transition-colors"
                placeholder="What should we call you?"
              />
            </div>

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
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-ember transition-colors"
                placeholder="Type it again"
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
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-ember hover:underline"
            >
              Already have an account? Sign in
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
