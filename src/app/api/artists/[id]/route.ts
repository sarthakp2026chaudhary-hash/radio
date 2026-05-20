import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { requireHost, parseIdParam, notFound, serverError } from "@/lib/api/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const artistId = parseIdParam(id);
  if (!artistId) return notFound("Invalid artist ID");

  const supabase = await createClient();
  const { data: artist, error } = await db.artists.get(supabase, artistId);

  if (error || !artist) return notFound(error?.message || "Artist not found");

  return NextResponse.json({ artist });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const artistId = parseIdParam(id);
  if (!artistId) return notFound("Invalid artist ID");

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.bio !== undefined) updates.bio = body.bio?.trim() || null;
  if (body.image_url !== undefined) updates.image_url = body.image_url || null;

  const { data: artist, error } = await db.artists.update(auth.supabase, artistId, updates);

  if (error) return serverError(error);

  return NextResponse.json({ artist });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const artistId = parseIdParam(id);
  if (!artistId) return notFound("Invalid artist ID");

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { error } = await db.artists.delete(auth.supabase, artistId);

  if (error) return serverError(error);

  return NextResponse.json({ success: true });
}
