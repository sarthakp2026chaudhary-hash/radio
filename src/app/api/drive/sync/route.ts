// DISABLED: Google Drive integration commented out — using Cloudflare R2 instead.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Google Drive integration is disabled. Use R2 storage." }, { status: 503 });
}

/* Original preserved — re-enable by uncommenting and restoring google-drive imports:
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken, listAudioFiles, listFolders } from "@/lib/google-drive";
// ... (full original preserved in git history)
*/
