import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: channel, error } = await db.channels.getBySlug(supabase, slug);

  if (error || !channel) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  const listenerCount = await db.channels.getListenerCount(supabase, channel.id);

  return NextResponse.json({
    channel: {
      ...channel,
      listener_count: listenerCount,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can update channels" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.cover_url !== undefined) updates.cover_url = body.cover_url || null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data: channel, error } = await db.channels.update(supabase, slug, updates);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channel });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can delete channels" }, { status: 403 });
  }

  const { error } = await db.channels.delete(supabase, slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
