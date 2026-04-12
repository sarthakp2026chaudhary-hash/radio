import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-drive";

export async function GET() {
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
    .select("is_host")
    .eq("auth_id", user.id)
    .single() as { data: { is_host: boolean } | null };

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Redirect to Google OAuth
  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
