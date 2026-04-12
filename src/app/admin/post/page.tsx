"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

interface DailyPost {
  quote: string;
  image_url: string | null;
}

export default function PostPage() {
  const router = useRouter();
  const [quote, setQuote] = useState("if ya nasty");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [todaySong, setTodaySong] = useState<{ title: string; artist: string | null } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Check auth and host status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("is_host")
        .eq("auth_id", user.id)
        .single() as { data: { is_host: boolean } | null };

      if (!profile?.is_host) {
        router.push("/radio");
        return;
      }

      // Fetch today's post if exists
      const { data: post } = await supabase
        .from("daily_posts")
        .select("quote, image_url")
        .eq("session_date", today)
        .single() as { data: { quote: string; image_url: string | null } | null };

      if (post) {
        setQuote(post.quote || "if ya nasty");
        setImageUrl(post.image_url);
        setImagePreview(post.image_url);
      }

      // Fetch today's song of the day
      const songRes = await fetch(`/api/history/song-of-day?date=${today}`);
      const songData = await songRes.json();
      if (songData.songOfDay?.tracks) {
        setTodaySong({
          title: songData.songOfDay.tracks.title,
          artist: songData.songOfDay.tracks.artist,
        });
      }

      setIsLoading(false);
    }

    init();
  }, [router, today]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const supabase = createClient();

    try {
      let finalImageUrl = imageUrl;

      // Upload new image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${today}-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("history-images")
          .upload(fileName, imageFile, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          alert("Failed to upload image. Make sure the storage bucket exists.");
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("history-images")
            .getPublicUrl(uploadData.path);
          finalImageUrl = urlData.publicUrl;
        }
      }

      // Upsert daily post
      const { error } = await (supabase
        .from("daily_posts") as any)
        .upsert({
          session_date: today,
          quote,
          image_url: finalImageUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_date' });

      if (error) {
        console.error("Save error:", error);
        alert("Failed to save post");
      } else {
        alert("Post saved!");
        router.push("/admin");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

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
    <main className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-surface-3 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Today&apos;s Post
            </h1>
            <p className="text-text-tertiary text-sm mt-1">
              {new Date(today + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-text-tertiary hover:text-text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            {/* Quote */}
            <div>
              <label className="block text-text-secondary text-sm mb-2">Quote</label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="if ya nasty"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-surface-1 border border-surface-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ember resize-none"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-text-secondary text-sm mb-2">Image</label>
              <label
                className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-surface-3 hover:border-ember transition-colors cursor-pointer"
                style={{ background: "var(--surface-1)" }}
              >
                <svg className="w-8 h-8 text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-text-tertiary text-sm">Click to upload image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Song of the Day */}
            {todaySong && (
              <div
                className="p-4 rounded-xl"
                style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
              >
                <p className="text-text-tertiary text-xs mb-1">Song of the Day</p>
                <p className="text-text-primary font-medium">{todaySong.title}</p>
                <p className="text-text-secondary text-sm">{todaySong.artist || "Unknown Artist"}</p>
              </div>
            )}

            <Button onClick={handleSave} disabled={isSaving} variant="primary" className="w-full">
              {isSaving ? "Saving..." : "Save Post"}
            </Button>
          </div>

          {/* Preview */}
          <div>
            <p className="text-text-secondary text-sm mb-3">Preview</p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}
            >
              {/* Image */}
              <div className="aspect-square relative">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Post preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <svg className="w-16 h-16 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <p
                  className="text-text-primary italic"
                  style={{ fontFamily: "var(--font-caveat)", fontSize: "1.25rem" }}
                >
                  &ldquo;{quote}&rdquo;
                </p>
                {todaySong && (
                  <div className="mt-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-ember" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <span className="text-text-secondary text-sm">{todaySong.title}</span>
                  </div>
                )}
                <p className="text-text-tertiary text-xs mt-3">
                  {new Date(today + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
