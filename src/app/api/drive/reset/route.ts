import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST() {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Clear votes first (foreign key constraint)
    await adminClient.from("track_votes").delete().neq("id", 0);

    // Clear tracks
    await adminClient.from("tracks").delete().neq("id", 0);

    // Reset playback state
    await (adminClient
      .from("playback_state") as any)
      .update({
        current_track_id: null,
        current_folder_id: null,
        is_playing: false,
      })
      .eq("id", 1);

    return NextResponse.json({ success: true, message: "All tracks cleared" });
  } catch (err) {
    console.error("Reset error:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
