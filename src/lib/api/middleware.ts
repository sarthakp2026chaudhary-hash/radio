import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

export type ApiHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export type AuthenticatedHandler = (
  request: NextRequest,
  context: {
    params: Promise<Record<string, string>>;
    userId: string;
  }
) => Promise<NextResponse>;

export type HostHandler = (
  request: NextRequest,
  context: {
    params: Promise<Record<string, string>>;
    userId: string;
  }
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler): ApiHandler {
  return async (request, context) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, { ...context, userId: user.id });
  };
}

export function withHostAuth(handler: HostHandler): ApiHandler {
  return async (request, context) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHost = await db.users.isHost(supabase, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, { ...context, userId: user.id });
  };
}

export function parseId(id: string): number | null {
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
