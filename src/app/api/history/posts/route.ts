import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET - Get daily post for a specific date
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("daily_posts")
      .select("session_date, quote, image_url, created_at, updated_at")
      .eq("session_date", date)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Failed to get daily post:", error);
      return NextResponse.json({ error: "Failed to get daily post" }, { status: 500 });
    }

    return NextResponse.json({ post: data || null });
  } catch (err) {
    console.error("Get daily post error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Create/update daily post (host only)
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

    const { date, quote, imageUrl } = await request.json();
    const sessionDate = date || new Date().toISOString().split('T')[0];

    // Upsert daily post
    const { error } = await (adminClient
      .from("daily_posts") as any)
      .upsert({
        session_date: sessionDate,
        quote: quote || 'if ya nasty',
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_date' });

    if (error) {
      console.error("Failed to save daily post:", error);
      return NextResponse.json({ error: "Failed to save daily post" }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: sessionDate });
  } catch (err) {
    console.error("Save daily post error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
