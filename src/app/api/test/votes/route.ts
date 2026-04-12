import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Test endpoint to verify voting functionality
// GET /api/test/votes - Run all vote tests
export async function GET() {
  const adminClient = createAdminClient();
  const results: { test: string; status: "PASS" | "FAIL"; details?: string }[] = [];

  try {
    // Setup: Get a test track and user
    const { data: tracks } = await adminClient
      .from("tracks")
      .select("id, title, folder_id")
      .limit(3) as { data: Array<{ id: number; title: string; folder_id: string }> | null };

    const { data: users } = await adminClient
      .from("users")
      .select("id, display_name")
      .limit(2) as { data: Array<{ id: number; display_name: string }> | null };

    if (!tracks || tracks.length < 2) {
      return NextResponse.json({
        error: "Need at least 2 tracks to test. Run sync first.",
        tracks: tracks?.length || 0
      }, { status: 400 });
    }

    if (!users || users.length < 1) {
      return NextResponse.json({
        error: "Need at least 1 user to test.",
        users: users?.length || 0
      }, { status: 400 });
    }

    const testTrack1 = tracks[0];
    const testTrack2 = tracks[1];
    const testUser = users[0];
    const testUser2 = users[1] || users[0];

    console.log("Test setup:", { testTrack1, testTrack2, testUser });

    // ========== TEST 1: Clean slate ==========
    await (adminClient.from("track_votes") as any).delete().neq("id", 0);
    const { count: initialCount } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true });

    results.push({
      test: "1. Clean slate - Delete all votes",
      status: initialCount === 0 ? "PASS" : "FAIL",
      details: `Votes remaining: ${initialCount}`
    });

    // ========== TEST 2: Add votes ==========
    const { error: voteError1 } = await (adminClient.from("track_votes") as any).insert({
      track_id: testTrack1.id,
      user_id: testUser.id,
      folder_id: testTrack1.folder_id || "test-folder"
    });

    const { error: voteError2 } = await (adminClient.from("track_votes") as any).insert({
      track_id: testTrack1.id,
      user_id: testUser2.id,
      folder_id: testTrack1.folder_id || "test-folder"
    });

    const { count: afterVoteCount } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", testTrack1.id);

    results.push({
      test: "2. Add votes to track",
      status: !voteError1 && afterVoteCount === 2 ? "PASS" : "FAIL",
      details: `Added 2 votes to "${testTrack1.title}". Count: ${afterVoteCount}. Error: ${voteError1?.message || voteError2?.message || "none"}`
    });

    // ========== TEST 3: Clear votes for specific track ==========
    const { error: clearError } = await (adminClient
      .from("track_votes") as any)
      .delete()
      .eq("track_id", testTrack1.id);

    const { count: afterClearCount } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", testTrack1.id);

    results.push({
      test: "3. Clear votes for played track",
      status: !clearError && afterClearCount === 0 ? "PASS" : "FAIL",
      details: `Cleared votes for "${testTrack1.title}". Remaining: ${afterClearCount}. Error: ${clearError?.message || "none"}`
    });

    // ========== TEST 4: Votes for other tracks remain ==========
    // Add vote to track2
    await (adminClient.from("track_votes") as any).insert({
      track_id: testTrack2.id,
      user_id: testUser.id,
      folder_id: testTrack2.folder_id || "test-folder"
    });

    // Add vote back to track1
    await (adminClient.from("track_votes") as any).insert({
      track_id: testTrack1.id,
      user_id: testUser.id,
      folder_id: testTrack1.folder_id || "test-folder"
    });

    // Clear only track1
    await (adminClient.from("track_votes") as any).delete().eq("track_id", testTrack1.id);

    // Check track2 still has its vote
    const { count: track2Votes } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("track_id", testTrack2.id);

    results.push({
      test: "4. Other tracks' votes remain after clearing one",
      status: track2Votes === 1 ? "PASS" : "FAIL",
      details: `Track2 ("${testTrack2.title}") votes: ${track2Votes} (expected 1)`
    });

    // ========== TEST 5: Clear by folder ==========
    // Add more votes to both tracks with same folder
    const testFolder = testTrack1.folder_id || "test-folder";
    await (adminClient.from("track_votes") as any).delete().neq("id", 0); // Clean

    await (adminClient.from("track_votes") as any).insert([
      { track_id: testTrack1.id, user_id: testUser.id, folder_id: testFolder },
      { track_id: testTrack2.id, user_id: testUser.id, folder_id: testFolder },
    ]);

    const { count: beforeFolderClear } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("folder_id", testFolder);

    // Clear by folder
    await (adminClient.from("track_votes") as any).delete().eq("folder_id", testFolder);

    const { count: afterFolderClear } = await (adminClient
      .from("track_votes") as any)
      .select("*", { count: "exact", head: true })
      .eq("folder_id", testFolder);

    results.push({
      test: "5. Clear all votes when folder changes",
      status: beforeFolderClear === 2 && afterFolderClear === 0 ? "PASS" : "FAIL",
      details: `Before: ${beforeFolderClear}, After: ${afterFolderClear}`
    });

    // ========== TEST 6: API endpoint test ==========
    // Add a vote first
    await (adminClient.from("track_votes") as any).insert({
      track_id: testTrack1.id,
      user_id: testUser.id,
      folder_id: testTrack1.folder_id || "test-folder"
    });

    // Call the clear API
    const clearApiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/votes/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: testTrack1.id }),
    });

    // Note: This will fail without auth, but we test the admin client directly above
    results.push({
      test: "6. Clear API endpoint exists",
      status: clearApiResponse.status === 401 || clearApiResponse.status === 200 ? "PASS" : "FAIL",
      details: `API response status: ${clearApiResponse.status} (401 expected without auth, 200 with auth)`
    });

    // ========== CLEANUP ==========
    await (adminClient.from("track_votes") as any).delete().neq("id", 0);

    // Summary
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;

    return NextResponse.json({
      summary: `${passed}/${results.length} tests passed`,
      passed,
      failed,
      results,
      testData: {
        track1: testTrack1,
        track2: testTrack2,
        user: testUser
      }
    });

  } catch (err) {
    console.error("Test error:", err);
    return NextResponse.json({
      error: "Test failed with exception",
      message: err instanceof Error ? err.message : String(err),
      results
    }, { status: 500 });
  }
}
