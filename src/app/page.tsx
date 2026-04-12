"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-void">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, var(--ember-subtle) 0%, transparent 50%)`
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at 80% 20%, var(--twilight-subtle) 0%, transparent 40%)`
          }}
        />
      </div>

      {/* Content */}
      <div
        className={`relative z-10 text-center px-6 max-w-2xl mx-auto transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-1 mb-8 h-12">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-ember rounded-full animate-wave"
              style={{
                height: "100%",
                animationDelay: `${i * 0.15}s`,
                opacity: 0.6 + (i % 2) * 0.4,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          <span className="text-text-primary">Radio</span>
        </h1>

        {/* Tagline */}
        <p className="text-text-secondary text-lg md:text-xl mb-4 leading-relaxed">
          A personal radio station for friends.
        </p>
        <p
          className="text-xl md:text-2xl mb-12 text-ember"
          style={{ fontFamily: "var(--font-caveat)" }}
        >
          Listen together, in perfect sync.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/register"
            className="group relative px-8 py-4 rounded-xl font-medium text-void transition-all duration-300 hover:-translate-y-0.5 text-center"
            style={{
              background: "var(--ember)",
              boxShadow: "0 0 30px var(--ember-subtle)",
            }}
          >
            <span className="relative z-10">Join the Radio</span>
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "var(--ember-glow)",
              }}
            />
          </a>

          <a
            href="/login"
            className="px-8 py-4 rounded-xl font-medium text-text-secondary border transition-all duration-300 hover:border-ember hover:text-text-primary text-center"
            style={{
              borderColor: "var(--surface-3)",
            }}
          >
            I&apos;m the Host
          </a>
        </div>

        {/* Status indicator */}
        <div className="mt-16 flex items-center justify-center gap-2 text-text-tertiary text-sm">
          <div className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
          <span>Waiting for host to go live...</span>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-surface-3 to-transparent" />
    </main>
  );
}
