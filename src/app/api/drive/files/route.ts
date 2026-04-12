import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, listAudioFiles, listFolders } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const folderId = searchParams.get("folderId") ?? undefined;
  const type = searchParams.get("type") || "all"; // "audio", "folders", or "all"

  try {
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

    // Get valid access token
    const accessToken = await getValidAccessToken(profile.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Drive not connected", needsAuth: true },
        { status: 401 }
      );
    }

    // Fetch files based on type
    let files: any[] = [];
    let folders: any[] = [];

    if (type === "audio" || type === "all") {
      files = folderId ? await listAudioFiles(accessToken, folderId) : [];
    }

    if (type === "folders" || type === "all") {
      folders = folderId ? await listFolders(accessToken, folderId) : await listFolders(accessToken, "root");
    }

    return NextResponse.json({ files, folders });
  } catch (err) {
    console.error("Drive files error:", err);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
