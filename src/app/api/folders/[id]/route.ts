import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can update folders" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.parent_id !== undefined) updates.parent_id = body.parent_id ?? null;
  if (body.position !== undefined) updates.position = body.position;
  if (body.color !== undefined) updates.color = body.color ?? null;

  const { data: folder, error } = await db.folders.update(supabase, parseInt(id), updates);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folder });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can delete folders" }, { status: 403 });
  }

  const { error } = await db.folders.delete(supabase, parseInt(id));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
