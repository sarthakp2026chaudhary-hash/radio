import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, getFileMetadata } from "@/lib/google-drive";

interface ImportRequest {
  fileId: string;
  title: string;
  artist?: string;
  durationMs: number;
  folderId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { fileId, title, artist, durationMs, folderId } = body;

    if (!fileId || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user is authenticated and is host
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, is_host")
      .eq("auth_id", user.id)
      .single() as { data: { id: number; is_host: boolean } | null };

    if (!profile?.is_host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get valid access token to verify file exists
    const accessToken = await getValidAccessToken(profile.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Drive not connected" },
        { status: 401 }
      );
    }

    // Get file metadata to verify it exists and get size
    const metadata = await getFileMetadata(accessToken, fileId);

    // Check if track already exists
    const { data: existingTrack } = await supabase
      .from("tracks")
      .select("id")
      .eq("drive_file_id", fileId)
      .single() as { data: { id: number } | null };

    if (existingTrack) {
      return NextResponse.json(
        { error: "Track already imported", trackId: existingTrack.id },
        { status: 409 }
      );
    }

    // Insert track into database
    const { data: track, error } = await (supabase
      .from("tracks") as any)
      .insert({
        drive_file_id: fileId,
        title,
        artist: artist || null,
        duration_ms: durationMs || 180000, // Default 3 minutes if unknown
        file_size_bytes: metadata.size ? parseInt(metadata.size) : null,
        mime_type: metadata.mimeType,
        folder_id: folderId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Track insert error:", error);
      return NextResponse.json(
        { error: "Failed to import track" },
        { status: 500 }
      );
    }

    return NextResponse.json({ track });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Failed to import track" },
      { status: 500 }
    );
  }
}
