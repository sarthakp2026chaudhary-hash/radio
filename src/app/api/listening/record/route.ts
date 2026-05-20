import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UserRow {
  id: number;
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
  const { track_id, channel_id, duration_listened_ms, completed } = body;

  if (!track_id) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const { error } = await supabase.from("listening_history" as any).insert({
    user_id: profile.id,
    track_id,
    channel_id: channel_id || null,
    duration_listened_ms: duration_listened_ms || 0,
    completed: completed || false,
  } as any);

  if (error) {
    console.error("Failed to record listening history:", error);
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
