import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const protectedPaths = ["/radio", "/admin", "/discover", "/gallery"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Channel pages (/radio/<slug>) are public, shareable links — viewable without login.
  // The /radio index (list) stays gated; only deep channel links are public.
  const isPublicChannelPage = /^\/radio\/[^/]+/.test(request.nextUrl.pathname);

  // Redirect to login if accessing a protected route without auth (public channel pages exempt)
  if (isProtected && !user && !isPublicChannelPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Role-based routing for authenticated users
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_host")
      .eq("auth_id", user.id)
      .single();

    const isHost = profile?.is_host === true;
    const pathname = request.nextUrl.pathname;

    // Host accessing /radio list -> redirect to /admin
    // But allow hosts to visit /radio/[slug] (their own channel, for testing/listening)
    if (isHost && pathname === "/radio") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Friend accessing /admin -> redirect to /radio
    if (!isHost && pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/radio";
      return NextResponse.redirect(url);
    }

    // Redirect logged-in users from login/register to appropriate page
    if (pathname === "/login" || pathname === "/register") {
      const url = request.nextUrl.clone();
      url.pathname = isHost ? "/admin" : "/radio";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
