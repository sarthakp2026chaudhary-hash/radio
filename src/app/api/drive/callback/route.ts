import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin?drive_error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin?drive_error=no_code`
    );
  }

  try {
    const supabase = await createClient();

    // Verify user is authenticated and is host
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login`
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, is_host")
      .eq("auth_id", user.id)
      .single() as { data: { id: number; is_host: boolean } | null };

    if (!profile?.is_host) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/admin?drive_error=not_host`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store credentials in database
    await (supabase.from("drive_credentials") as any).upsert({
      user_id: profile.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin?drive_connected=true`
    );
  } catch (err) {
    console.error("Drive callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin?drive_error=token_exchange_failed`
    );
  }
}
