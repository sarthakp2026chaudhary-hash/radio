import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET - Get tracks with vote counts for current folder
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Get current folder from playback state
    const { data: playback } = await supabase
      .from("playback_state")
      .select("current_folder_id, current_track_id")
      .eq("id", 1)
      .single() as { data: { current_folder_id: string | null; current_track_id: number | null } | null };

    if (!playback?.current_folder_id) {
      return NextResponse.json({ tracks: [], currentFolderId: null });
    }

    // Get tracks in current folder with vote counts
    const { data: tracks } = await supabase
      .from("tracks")
      .select("id, title, artist, folder_id")
      .eq("folder_id", playback.current_folder_id)
      .neq("id", playback.current_track_id || 0) as { data: Array<{ id: number; title: string; artist: string | null; folder_id: string }> | null };

    // Get vote counts
    const { data: votes } = await (supabase
      .from("track_votes") as any)
      .select("track_id")
      .eq("folder_id", playback.current_folder_id);

    // Count votes per track
    const voteCounts: Record<number, number> = {};
    votes?.forEach((vote: { track_id: number }) => {
      voteCounts[vote.track_id] = (voteCounts[vote.track_id] || 0) + 1;
    });

    // Combine tracks with vote counts
    const tracksWithVotes = tracks?.map((track: { id: number; title: string; artist: string | null; folder_id: string }) => ({
      ...track,
      voteCount: voteCounts[track.id] || 0,
    })) || [];

    // Sort by vote count descending
    tracksWithVotes.sort((a: { voteCount: number }, b: { voteCount: number }) => b.voteCount - a.voteCount);

    return NextResponse.json({
      tracks: tracksWithVotes,
      currentFolderId: playback.current_folder_id,
    });
  } catch (err) {
    console.error("Get votes error:", err);
    return NextResponse.json({ error: "Failed to get votes" }, { status: 500 });
  }
}

// POST - Add vote
export async function POST(request: NextRequest) {
  try {
    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
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

    // Get current folder from playback state
    const { data: playback } = await adminClient
      .from("playback_state")
      .select("current_folder_id")
      .eq("id", 1)
      .single() as { data: { current_folder_id: string | null } | null };

    if (!playback?.current_folder_id) {
      return NextResponse.json({ error: "No active session" }, { status: 400 });
    }

    // Verify track is in current folder
    const { data: track } = await adminClient
      .from("tracks")
      .select("folder_id")
      .eq("id", trackId)
      .single() as { data: { folder_id: string } | null };

    if (!track || track.folder_id !== playback.current_folder_id) {
      return NextResponse.json({ error: "Track not in current folder" }, { status: 400 });
    }

    // Insert vote (upsert to handle duplicates gracefully)
    const { error } = await (adminClient
      .from("track_votes") as any)
      .insert({
        track_id: trackId,
        user_id: profile.id,
        folder_id: playback.current_folder_id,
      });

    if (error) {
      if (error.code === "23505") {
        // Already voted
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
  }
}

// DELETE - Remove vote
export async function DELETE(request: NextRequest) {
  try {
    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
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

    // Get current folder from playback state
    const { data: playback } = await adminClient
      .from("playback_state")
      .select("current_folder_id")
      .eq("id", 1)
      .single() as { data: { current_folder_id: string | null } | null };

    // Delete the vote
    await (adminClient
      .from("track_votes") as any)
      .delete()
      .eq("track_id", trackId)
      .eq("user_id", profile.id)
      .eq("folder_id", playback?.current_folder_id || "");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove vote error:", err);
    return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
  }
}
