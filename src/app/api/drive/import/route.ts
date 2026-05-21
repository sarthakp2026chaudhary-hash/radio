// DISABLED: Google Drive integration commented out — using Cloudflare R2 instead.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Google Drive integration is disabled. Use /api/tracks/upload for R2 uploads." }, { status: 503 });
}

/* Original import route preserved in git history for re-enabling later. */
