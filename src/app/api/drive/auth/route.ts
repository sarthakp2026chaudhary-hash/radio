// DISABLED: Google Drive integration commented out — using Cloudflare R2 instead.
// To re-enable: uncomment the block below and restore GOOGLE_CLIENT_ID/SECRET env vars.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "Google Drive integration is disabled. Use R2 storage." }, { status: 503 });
}

/*
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-drive";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("is_host").eq("auth_id", user.id).single() as { data: { is_host: boolean } | null };
  if (!profile?.is_host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
*/
