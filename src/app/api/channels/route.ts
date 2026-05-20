import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { requireHost, serverError } from "@/lib/api/auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();
  const { data: channels, error } = await db.channels.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const channelsWithListeners = await Promise.all(
    (channels || []).map(async (channel) => ({
      ...channel,
      listener_count: await db.channels.getListenerCount(supabase, channel.id),
    }))
  );

  return NextResponse.json({ channels: channelsWithListeners });
}

export async function POST(request: NextRequest) {
  const auth = await requireHost();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { name, description, cover_url, is_public = true, for_user_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = slugify(name);
  let slugSuffix = 0;

  while (true) {
    const checkSlug = slugSuffix > 0 ? `${slug}-${slugSuffix}` : slug;
    const { data: existing } = await db.channels.getBySlug(auth.supabase, checkSlug);
    if (!existing) {
      slug = checkSlug;
      break;
    }
    slugSuffix++;
  }

  const { data: channel, error } = await db.channels.create(auth.supabase, {
    name: name.trim(),
    slug,
    description: description?.trim() || null,
    cover_url: cover_url || null,
    is_public: for_user_id ? false : is_public,
    for_user_id: for_user_id || null,
  });

  if (error) return serverError(error);

  return NextResponse.json({ channel }, { status: 201 });
}
