import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken, listAudioFiles, listFolders } from "@/lib/google-drive";

interface SyncResult {
  imported: number;
  skipped: number;
  folders: { id: string; name: string }[];
}

// Recursively get all audio files from Drive folders
async function getAllAudioFiles(
  accessToken: string,
  folderId: string | null,
  folderName: string,
  results: { file: { id: string; name: string }; folderId: string; folderName: string }[]
) {
  // Get subfolders first
  const folders = await listFolders(accessToken, folderId || undefined);

  // If we're in a subfolder (not root), get audio files
  if (folderId) {
    const files = await listAudioFiles(accessToken, folderId);
    for (const file of files) {
      results.push({
        file: { id: file.id, name: file.name },
        folderId: folderId,
        folderName,
      });
    }
  }

  // Recurse into subfolders
  for (const folder of folders) {
    await getAllAudioFiles(accessToken, folder.id, folder.name, results);
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify user is host
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("id, is_host")
      .eq("auth_id", user.id)
      .single() as { data: { id: number; is_host: boolean } | null };

    if (!profile?.is_host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get access token
    const accessToken = await getValidAccessToken(profile.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Drive not connected" }, { status: 401 });
    }

    // Get all audio files recursively
    const allFiles: { file: { id: string; name: string }; folderId: string; folderName: string }[] = [];
    await getAllAudioFiles(accessToken, null, "My Drive", allFiles);

    // Get existing tracks
    const { data: existingTracks } = await adminClient
      .from("tracks")
      .select("drive_file_id") as { data: Array<{ drive_file_id: string }> | null };

    const existingIds = new Set(existingTracks?.map(t => t.drive_file_id) || []);

    // Import new tracks
    let imported = 0;
    let skipped = 0;
    const folderSet = new Map<string, string>();

    for (const { file, folderId, folderName } of allFiles) {
      if (existingIds.has(file.id)) {
        skipped++;
        continue;
      }

      // Parse title and artist from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      let title = nameWithoutExt;
      let artist: string | null = null;

      if (nameWithoutExt.includes(" - ")) {
        const parts = nameWithoutExt.split(" - ");
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }

      await (adminClient.from("tracks") as any).insert({
        drive_file_id: file.id,
        title,
        artist,
        duration_ms: 180000,
        folder_id: folderId,
        folder_name: folderName,
      });

      folderSet.set(folderId, folderName);
      imported++;
    }

    // Update existing tracks that don't have folder_id
    for (const { file, folderId, folderName } of allFiles) {
      if (existingIds.has(file.id)) {
        await (adminClient
          .from("tracks") as any)
          .update({ folder_id: folderId, folder_name: folderName })
          .eq("drive_file_id", file.id)
          .is("folder_id", null);
      }
    }

    const result: SyncResult = {
      imported,
      skipped,
      folders: Array.from(folderSet.entries()).map(([id, name]) => ({ id, name })),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
