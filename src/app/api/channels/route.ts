import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";
import { requireHost, serverError } from "@/lib/api/auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();

  // Private channels are visible only to the host (or members). Anon/other users
  // see public channels only — `is_public: false` is enforced here, not just in the UI.
  const { data: { user } } = await supabase.auth.getUser();
  let isHost = false;
  const memberChannelIds = new Set<number>();
  if (user) {
    isHost = await db.users.isHost(supabase, user.id);
    if (!isHost) {
      const { data: memberships } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", user.id);
      for (const m of memberships || []) memberChannelIds.add((m as { channel_id: number }).channel_id);
    }
  }

  const { data: channels, error } = await db.channels.list(supabase);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const visible = isHost
    ? channels || []
    : (channels || []).filter((c) => c.is_public || memberChannelIds.has(c.id));

  const channelsWithListeners = await Promise.all(
    visible.map(async (channel) => ({
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
