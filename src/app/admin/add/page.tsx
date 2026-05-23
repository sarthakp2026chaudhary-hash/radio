"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PlaylistLite {
  id: number;
  name: string;
}
interface FolderLite {
  id: number;
  name: string;
}

interface BulkSong {
  title: string;
  artists?: string[];
}

// Parse pasted lines: "Title - Artist, Artist2" (artist optional → Unknown).
function parseSongs(raw: string): BulkSong[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(" - ");
      if (idx === -1) return { title: line };
      const title = line.slice(0, idx).trim();
      const artists = line
        .slice(idx + 3)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return { title, artists };
    });
}

export default function QuickAddPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [folders, setFolders] = useState<FolderLite[]>([]);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [playlistId, setPlaylistId] = useState("");
  const [newName, setNewName] = useState("");
  const [folderId, setFolderId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadPlaylists = async () => {
    const res = await fetch("/api/playlists");
    const data = await res.json();
    setPlaylists((data.playlists || []).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })));
  };

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
      const [, fRes] = await Promise.all([loadPlaylists(), fetch("/api/folders")]);
      const fData = await fRes.json();
      setFolders((fData.folders || []).map((f: { id: number; name: string }) => ({ id: f.id, name: f.name })));
      setReady(true);
    })();
  }, [router]);

  const handleSubmit = async () => {
    setResult(null);
    const songs = parseSongs(text);
    if (songs.length === 0) {
      setResult("Paste at least one song.");
      return;
    }
    setBusy(true);
    try {
      let targetId: number | null = null;

      if (mode === "existing") {
        targetId = playlistId ? parseInt(playlistId) : null;
        if (!targetId) {
          setResult("Pick a playlist.");
          setBusy(false);
          return;
        }
      } else {
        if (!newName.trim()) {
          setResult("Name the new playlist.");
          setBusy(false);
          return;
        }
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim(), folder_id: folderId ? parseInt(folderId) : null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setResult(data.error || "Failed to create playlist");
          setBusy(false);
          return;
        }
        targetId = data.playlist.id;
      }

      const res = await fetch("/api/tracks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs, playlist_id: targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Failed to add songs");
        setBusy(false);
        return;
      }

      setResult(`Added ${data.count} song${data.count === 1 ? "" : "s"}${data.errors?.length ? ` (${data.errors.length} skipped)` : ""}.`);
      setText("");
      if (mode === "new") {
        await loadPlaylists();
        setMode("existing");
        setPlaylistId(String(targetId));
        setNewName("");
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <span className="text-text-secondary">Loading…</span>
      </main>
    );
  }

  const count = parseSongs(text).length;
  const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--surface-3)" };

  return (
    <main className="min-h-screen bg-void">
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Quick Add</h1>
          <Link href="/admin" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("existing")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === "existing" ? "bg-ember text-white" : "text-text-tertiary"}`}
              style={mode === "existing" ? undefined : { background: "var(--surface-2)" }}
            >
              Existing playlist
            </button>
            <button
              onClick={() => setMode("new")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${mode === "new" ? "bg-ember text-white" : "text-text-tertiary"}`}
              style={mode === "new" ? undefined : { background: "var(--surface-2)" }}
            >
              New playlist
            </button>
          </div>

          {mode === "existing" ? (
            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-text-secondary"
              style={inputStyle}
            >
              <option value="">Select a playlist…</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New playlist name"
                className="w-full px-3 py-2 rounded-lg text-sm text-text-primary"
                style={inputStyle}
              />
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-text-secondary"
                style={inputStyle}
              >
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>
          <label className="text-sm font-medium text-text-secondary">Songs — one per line</label>
          <p className="text-xs text-text-muted mt-1 mb-3">
            Format: <span className="text-text-tertiary">Title - Artist, Artist2</span> &nbsp;(artist optional → “Unknown”)
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={"Summer Rain - Quarters\nClay Pigeons - Michael Cera\nUntitled demo"}
            className="w-full px-3 py-2 rounded-lg text-sm text-text-primary font-mono resize-y"
            style={inputStyle}
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-text-muted">{count} song{count === 1 ? "" : "s"}</span>
            <button
              disabled={busy || count === 0}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-full bg-ember text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add songs"}
            </button>
          </div>
          {result && <p className="text-sm text-text-secondary mt-3">{result}</p>}
        </div>
      </div>
    </main>
  );
}
