import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { requireHost, notFound, serverError } from "@/lib/api/auth";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: channel } = await db.channels.getBySlug(supabase, slug);
  if (!channel) return notFound("Channel not found");

  const { data: members, error } = await db.channelMembers.list(supabase, channel.id);
  if (error) return serverError(error);

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { data: channel } = await db.channels.getBySlug(auth.supabase, slug);
  if (!channel) return notFound("Channel not found");

  const body = await request.json();
  let { user_id, email, role = "listener" } = body;

  if (!user_id && !email) {
    return NextResponse.json({ error: "user_id or email required" }, { status: 400 });
  }

  if (email && !user_id) {
    const { data: userData } = await auth.supabase
      .from("users")
      .select("auth_id")
      .eq("email", email.toLowerCase().trim())
      .single() as { data: { auth_id: string } | null };

    if (!userData) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 });
    }
    user_id = userData.auth_id;
  }

  const { data: member, error } = await db.channelMembers.add(auth.supabase, {
    channel_id: channel.id,
    user_id,
    role,
    invited_by: auth.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "User already a member" }, { status: 409 });
    }
    return serverError(error);
  }

  return NextResponse.json({ member }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { data: channel } = await db.channels.getBySlug(auth.supabase, slug);
  if (!channel) return notFound("Channel not found");

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const { error } = await db.channelMembers.remove(auth.supabase, channel.id, userId);
  if (error) return serverError(error);

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const { data: channel } = await db.channels.getBySlug(auth.supabase, slug);
  if (!channel) return notFound("Channel not found");

  const body = await request.json();
  const { user_id, role } = body;

  if (!user_id || !role) {
    return NextResponse.json({ error: "user_id and role required" }, { status: 400 });
  }

  if (!["listener", "moderator"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { error } = await db.channelMembers.updateRole(auth.supabase, channel.id, user_id, role);
  if (error) return serverError(error);

  return NextResponse.json({ success: true });
}
