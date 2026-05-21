// DISABLED: Google Drive integration commented out — using Cloudflare R2 instead.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "Google Drive integration is disabled. Use R2 storage." }, { status: 503 });
}

/* Original preserved — re-enable by uncommenting and restoring google-drive imports:
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, listAudioFiles, listFolders } from "@/lib/google-drive";
// ... (full original preserved in git history)
*/
