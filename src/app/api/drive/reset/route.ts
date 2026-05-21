// DISABLED: Google Drive reset route — not needed with R2 storage.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "This endpoint is disabled." }, { status: 503 });
}

/* Original reset logic preserved in git history. */
