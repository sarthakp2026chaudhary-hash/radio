import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// POST - Record attendance for today
export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single() as { data: { id: number } | null };

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert attendance (one entry per user per day)
    const { error } = await (adminClient
      .from("broadcast_attendance") as any)
      .upsert({
        user_id: profile.id,
        session_date: today,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'user_id,session_date' });

    if (error) {
      console.error("Failed to record attendance:", error);
      return NextResponse.json({ error: "Failed to record attendance" }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: today });
  } catch (err) {
    console.error("Attendance error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET - Get user's attendance history with songs of the day
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single() as { data: { id: number } | null };

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's attendance dates
    const { data: attendance, error: attendanceError } = await (adminClient
      .from("broadcast_attendance") as any)
      .select("session_date, joined_at")
      .eq("user_id", profile.id)
      .order("session_date", { ascending: false }) as { data: Array<{ session_date: string; joined_at: string }> | null; error: any };

    if (attendanceError) {
      console.error("Failed to get attendance:", attendanceError);
      return NextResponse.json({ error: "Failed to get attendance" }, { status: 500 });
    }

    if (!attendance || attendance.length === 0) {
      return NextResponse.json({ history: [] });
    }

    // Get songs of the day for attended dates
    const dates = attendance.map(a => a.session_date);
    const { data: songs, error: songsError } = await (adminClient
      .from("song_of_day") as any)
      .select(`
        session_date,
        tracks (
          id,
          title,
          artist,
          cover_url
        )
      `)
      .in("session_date", dates) as { data: Array<{ session_date: string; tracks: any }> | null; error: any };

    if (songsError) {
      console.error("Failed to get songs:", songsError);
    }

    // Combine attendance with songs
    const songsByDate = new Map(songs?.map(s => [s.session_date, s.tracks]) || []);

    const history = attendance.map(a => ({
      date: a.session_date,
      joinedAt: a.joined_at,
      song: songsByDate.get(a.session_date) || null,
    }));

    return NextResponse.json({ history });
  } catch (err) {
    console.error("Get history error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
