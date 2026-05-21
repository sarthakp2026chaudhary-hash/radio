// DISABLED: Google Drive streaming commented out — audio files are served directly from Cloudflare R2.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "Drive streaming is disabled. Audio is served from R2 storage." }, { status: 503 });
}

/* Original drive stream route preserved in git history for re-enabling later. */
