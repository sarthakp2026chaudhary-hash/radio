import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UserRow {
  id: number;
}

interface LibraryEntryRow {
  id: number;
  track_id: number;
  added_at: string;
  source_channel_id: number | null;
  track: {
    id: number;
    title: string;
    duration_ms: number;
    cover_url: string | null;
    artists: { id: number; name: string } | null;
  };
  source_channel?: { id: number; name: string } | null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const { data: libraryData, error } = await (supabase as any)
    .from("user_library")
    .select(`
      id,
      track_id,
      added_at,
      source_channel_id,
      track:track_id(
        id,
        title,
        duration_ms,
        cover_url,
        artists:artist_id(id, name)
      ),
      source_channel:source_channel_id(id, name)
    `)
    .eq("user_id", profile.id)
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Failed to fetch library:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }

  const library = libraryData as LibraryEntryRow[];

  const { count } = await (supabase as any)
    .from("user_library")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  return NextResponse.json({
    library,
    total: count || 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await request.json();
  const { track_id, source_channel_id } = body;

  if (!track_id) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const { data: existing } = await (supabase as any)
    .from("user_library")
    .select("id")
    .eq("user_id", profile.id)
    .eq("track_id", track_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Track already in library" }, { status: 409 });
  }

  const { data: entry, error } = await (supabase as any)
    .from("user_library")
    .insert({
      user_id: profile.id,
      track_id,
      source_channel_id: source_channel_id || null,
    })
    .select(`
      id,
      track_id,
      added_at,
      source_channel_id,
      track:track_id(
        id,
        title,
        duration_ms,
        cover_url,
        artists:artist_id(id, name)
      )
    `)
    .single();

  if (error) {
    console.error("Failed to add to library:", error);
    return NextResponse.json({ error: "Failed to add to library" }, { status: 500 });
  }

  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const trackId = url.searchParams.get("track_id");

  if (!trackId) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .from("user_library")
    .delete()
    .eq("user_id", profile.id)
    .eq("track_id", parseInt(trackId));

  if (error) {
    console.error("Failed to remove from library:", error);
    return NextResponse.json({ error: "Failed to remove from library" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
