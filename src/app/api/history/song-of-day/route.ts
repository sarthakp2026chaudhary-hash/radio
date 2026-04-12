import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// POST - Set/update song of the day (host only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify user is host
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("id, is_host")
      .eq("auth_id", user.id)
      .single() as { data: { id: number; is_host: boolean } | null };

    if (!profile?.is_host) {
      return NextResponse.json({ error: "Forbidden - Host only" }, { status: 403 });
    }

    const { trackId, date } = await request.json();

    if (!trackId) {
      return NextResponse.json({ error: "trackId required" }, { status: 400 });
    }

    // Use today's date if not provided
    const sessionDate = date || new Date().toISOString().split('T')[0];

    // Check if song of day already exists for today (first song wins)
    const { data: existing } = await (adminClient
      .from("song_of_day") as any)
      .select("id")
      .eq("session_date", sessionDate)
      .single();

    // Only set if not already set (first song of the day)
    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySet: true,
        date: sessionDate,
        message: "Song of the day already set"
      });
    }

    const { error } = await (adminClient
      .from("song_of_day") as any)
      .insert({
        session_date: sessionDate,
        track_id: trackId,
        captured_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Failed to set song of day:", error);
      return NextResponse.json({ error: "Failed to set song of day" }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: sessionDate, trackId });
  } catch (err) {
    console.error("Song of day error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET - Get song of the day for a specific date or today
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("song_of_day")
      .select(`
        session_date,
        track_id,
        captured_at,
        tracks (
          id,
          title,
          artist,
          cover_url,
          drive_file_id
        )
      `)
      .eq("session_date", date)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Failed to get song of day:", error);
      return NextResponse.json({ error: "Failed to get song of day" }, { status: 500 });
    }

    return NextResponse.json({ songOfDay: data || null });
  } catch (err) {
    console.error("Get song of day error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
