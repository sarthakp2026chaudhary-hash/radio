import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? null; // optional deep-link forwarded by middleware

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Database trigger automatically creates user record
      // Check if user is host and redirect accordingly
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("is_host")
          .eq("auth_id", user.id)
          .single() as { data: { is_host: boolean } | null };

        const isHost = profile?.is_host === true;

        // Honor deep-link (e.g. /radio/getfatpls) if present
        if (next) {
          const isDeepLink = next.startsWith("/radio/");
          return NextResponse.redirect(`${origin}${isHost && !isDeepLink ? "/admin" : next}`);
        }

        const redirectTo = isHost ? "/admin" : "/radio";
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }

      return NextResponse.redirect(`${origin}/radio`);
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
