import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

// GET /api/folders        → flat list
// GET /api/folders?tree=1  → folders with their direct playlists (nest via parent_id)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const tree = request.nextUrl.searchParams.get("tree") === "1";
  const { data, error } = tree
    ? await db.folders.tree(supabase)
    : await db.folders.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folders: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can create folders" }, { status: 403 });
  }

  const body = await request.json();
  const { name, parent_id, position, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: folder, error } = await db.folders.create(supabase, {
    name: name.trim(),
    parent_id: parent_id ?? null,
    position: position ?? 0,
    color: color ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folder }, { status: 201 });
}
