import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { uploadToR2, generateTrackKey } from "@/lib/r2";
import * as musicMetadata from "music-metadata";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", "audio/m4a", "audio/aac"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can upload tracks" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const artistId = formData.get("artist_id") as string | null;
    const albumId = formData.get("album_id") as string | null;
    const titleOverride = formData.get("title") as string | null;
    const genreOverride = formData.get("genre") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!artistId) {
      return NextResponse.json({ error: "Artist ID is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const mimeType = file.type || "audio/mpeg";
    if (!ALLOWED_TYPES.some((t) => mimeType.includes(t.split("/")[1]))) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const { data: artist } = await db.artists.get(supabase, parseInt(artistId));
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const metadata = await musicMetadata.parseBuffer(buffer, { mimeType });

    const title = titleOverride?.trim() || metadata.common.title || file.name.replace(/\.[^/.]+$/, "");
    const durationMs = Math.round((metadata.format.duration || 0) * 1000);
    const genre = genreOverride?.trim() || metadata.common.genre?.[0] || null;
    const bpm = metadata.common.bpm ? Math.round(metadata.common.bpm) : null;
    const trackNumber = metadata.common.track?.no || null;

    const fileKey = generateTrackKey(artist.slug, `${Date.now()}-${file.name}`);
    const uploadResult = await uploadToR2(buffer, fileKey, mimeType);

    const { data: track, error } = await db.tracks.create(supabase, {
      title,
      artist_id: parseInt(artistId),
      album_id: albumId ? parseInt(albumId) : null,
      duration_ms: durationMs,
      genre,
      bpm,
      track_number: trackNumber,
      file_key: uploadResult.key,
      file_url: uploadResult.url,
      file_size_bytes: uploadResult.size,
      mime_type: mimeType,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      track,
      extracted: {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        duration: durationMs,
        genre,
        bpm,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
