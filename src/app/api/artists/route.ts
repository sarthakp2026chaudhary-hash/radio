import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const supabase = await createClient();
  const { data: artists, error } = await db.artists.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ artists });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isHost = await db.users.isHost(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Only hosts can create artists" }, { status: 403 });
  }

  const body = await request.json();
  const { name, bio, image_url } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = slugify(name);
  let slugSuffix = 0;

  while (true) {
    const checkSlug = slugSuffix > 0 ? `${slug}-${slugSuffix}` : slug;
    const { data: existing } = await db.artists.getBySlug(supabase, checkSlug);
    if (!existing) {
      slug = checkSlug;
      break;
    }
    slugSuffix++;
  }

  const { data: artist, error } = await db.artists.create(supabase, {
    name: name.trim(),
    slug,
    bio: bio?.trim() || null,
    image_url: image_url || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ artist }, { status: 201 });
}
