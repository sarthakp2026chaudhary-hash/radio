import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// POST - Clear all votes for a specific track (host only)
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

    const { trackId, folderId } = await request.json();

    console.log("[CLEAR VOTES] Request received:", { trackId, folderId, userId: user.id });

    if (!trackId && !folderId) {
      return NextResponse.json({ error: "trackId or folderId required" }, { status: 400 });
    }

    // Count votes before delete
    let countQuery = (adminClient.from("track_votes") as any).select("*", { count: "exact", head: true });
    if (trackId) countQuery = countQuery.eq("track_id", trackId);
    if (folderId) countQuery = countQuery.eq("folder_id", folderId);
    const { count: beforeCount } = await countQuery;

    console.log("[CLEAR VOTES] Votes before delete:", beforeCount);

    // Use admin client to bypass RLS and delete votes
    let query = (adminClient.from("track_votes") as any).delete();

    if (trackId) {
      query = query.eq("track_id", trackId);
    }
    if (folderId) {
      query = query.eq("folder_id", folderId);
    }

    const { error } = await query;

    if (error) {
      console.error("[CLEAR VOTES] Failed:", error);
      return NextResponse.json({ error: "Failed to clear votes" }, { status: 500 });
    }

    // Count votes after delete
    let afterQuery = adminClient.from("track_votes").select("*", { count: "exact", head: true });
    if (trackId) afterQuery = afterQuery.eq("track_id", trackId);
    if (folderId) afterQuery = afterQuery.eq("folder_id", folderId);
    const { count: afterCount } = await afterQuery;

    console.log("[CLEAR VOTES] Votes after delete:", afterCount, "| Cleared:", (beforeCount || 0) - (afterCount || 0));

    return NextResponse.json({
      success: true,
      cleared: (beforeCount || 0) - (afterCount || 0),
      before: beforeCount,
      after: afterCount
    });
  } catch (err) {
    console.error("Clear votes error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
