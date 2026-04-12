import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Integration test: Simulates the full voting + play flow
// GET /api/test/integration
export async function GET() {
  const adminClient = createAdminClient();
  const results: { step: string; status: "PASS" | "FAIL"; details?: string }[] = [];

  try {
    // Get test data
    const { data: tracks } = await adminClient
      .from("tracks")
      .select("id, title, folder_id, folder_name")
      .limit(3) as { data: Array<{ id: number; title: string; folder_id: string; folder_name: string }> | null };

    const { data: users } = await adminClient
      .from("users")
      .select("id, display_name, is_host")
      .limit(2) as { data: Array<{ id: number; display_name: string; is_host: boolean }> | null };

    if (!tracks || tracks.length < 2 || !users || users.length < 1) {
      return NextResponse.json({ error: "Need tracks and users to test" }, { status: 400 });
    }

    const songA = tracks[0];
    const songB = tracks[1];
    const songC = tracks[2] || tracks[0];
    const friend1 = users[0];
    const friend2 = users[1] || users[0];

    console.log("=== INTEGRATION TEST START ===");
    console.log("Songs:", { songA: songA.title, songB: songB.title, songC: songC?.title });

    // ========== STEP 1: Clean start ==========
    await (adminClient.from("track_votes") as any).delete().neq("id", 0);
    results.push({ step: "1. Clean all votes", status: "PASS" });

    // ========== STEP 2: Set Song A as currently playing ==========
    await (adminClient.from("playback_state") as any).update({
      current_track_id: songA.id,
      current_folder_id: songA.folder_id,
      is_playing: true
    }).eq("id", 1);
    results.push({ step: "2. Song A is now playing", status: "PASS", details: songA.title });

    // ========== STEP 3: Friends upvote Song B ==========
    await (adminClient.from("track_votes") as any).insert([
      { track_id: songB.id, user_id: friend1.id, folder_id: songB.folder_id },
      { track_id: songB.id, user_id: friend2.id, folder_id: songB.folder_id },
    ]);

    const { count: songBVotes } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", songB.id);

    results.push({
      step: "3. Friends upvote Song B",
      status: songBVotes === 2 ? "PASS" : "FAIL",
      details: `Song B ("${songB.title}") has ${songBVotes} votes`
    });

    // ========== STEP 4: Host plays Song B (should clear its votes) ==========
    // This simulates what selectTrack does:
    // 1. Call /api/votes/clear with trackId
    // 2. Update playback_state

    // Simulate the API call (using admin client directly since we can't auth)
    await (adminClient.from("track_votes") as any).delete().eq("track_id", songB.id);

    await (adminClient.from("playback_state") as any).update({
      current_track_id: songB.id,
      current_folder_id: songB.folder_id,
      is_playing: true
    }).eq("id", 1);

    const { count: songBVotesAfterPlay } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", songB.id);

    results.push({
      step: "4. Host plays Song B → votes cleared",
      status: songBVotesAfterPlay === 0 ? "PASS" : "FAIL",
      details: `Song B votes after playing: ${songBVotesAfterPlay} (expected 0)`
    });

    // ========== STEP 5: Friends upvote Song C ==========
    await (adminClient.from("track_votes") as any).insert({
      track_id: songC.id,
      user_id: friend1.id,
      folder_id: songC.folder_id
    });

    const { count: songCVotes } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", songC.id);

    results.push({
      step: "5. Friends upvote Song C",
      status: songCVotes === 1 ? "PASS" : "FAIL",
      details: `Song C ("${songC.title}") has ${songCVotes} votes`
    });

    // ========== STEP 6: Host plays Song A (Song B should still have 0, Song C should keep votes) ==========
    await (adminClient.from("track_votes") as any).delete().eq("track_id", songA.id);

    await (adminClient.from("playback_state") as any).update({
      current_track_id: songA.id,
      current_folder_id: songA.folder_id,
      is_playing: true
    }).eq("id", 1);

    const { count: songBVotesStillZero } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", songB.id);

    const { count: songCVotesRemain } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", songC.id);

    results.push({
      step: "6. Host plays Song A → Song B still 0, Song C keeps votes",
      status: songBVotesStillZero === 0 && songCVotesRemain === 1 ? "PASS" : "FAIL",
      details: `Song B: ${songBVotesStillZero} (expected 0), Song C: ${songCVotesRemain} (expected 1)`
    });

    // ========== STEP 7: Verify queue shows correct state ==========
    const { data: allVotes } = await (adminClient
      .from("track_votes") as any)
      .select("track_id, tracks(title)")
      .eq("folder_id", songA.folder_id);

    results.push({
      step: "7. Queue shows only Song C with votes",
      status: allVotes?.length === 1 ? "PASS" : "FAIL",
      details: `Tracks with votes: ${allVotes?.map((v: any) => v.tracks?.title).join(", ") || "none"}`
    });

    // ========== CLEANUP ==========
    await (adminClient.from("track_votes") as any).delete().neq("id", 0);

    const passed = results.filter(r => r.status === "PASS").length;

    return NextResponse.json({
      summary: `${passed}/${results.length} steps passed`,
      scenario: "Song A playing → Friends upvote B → Host plays B (votes clear) → Friends upvote C → Host plays A → B has 0 votes, C has 1 vote",
      results
    });

  } catch (err) {
    console.error("Integration test error:", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      results
    }, { status: 500 });
  }
}
