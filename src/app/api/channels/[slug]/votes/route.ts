import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface VoteRow {
  track_id: number;
  user_id: number;
  created_at: string;
}

interface TrackRow {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  file_url: string | null;
  artist_id: number | null;
}

async function getChannelBySlug(slug: string): Promise<{ id: number; slug: string; name: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("channels").select("id, slug, name").eq("slug", slug).single();
  if (error || !data) return null;
  return data as { id: number; slug: string; name: string };
}

async function getProfileUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = (await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single()) as { data: { id: number } | null };

  return profile?.id ?? null;
}

/** GET — ranked song requests for a channel */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = await getChannelBySlug(slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: votes, error } = await admin
    .from("channel_track_votes")
    .select("track_id, user_id, created_at")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const voteRows = (votes ?? []) as VoteRow[];
  const counts = new Map<number, number>();
  for (const v of voteRows) {
    counts.set(v.track_id, (counts.get(v.track_id) ?? 0) + 1);
  }

  const trackIds = [...counts.keys()];
  if (trackIds.length === 0) {
    return NextResponse.json({ channel_id: channel.id, requests: [] });
  }

  const { data: tracks } = await admin.from("tracks").select("id, title, duration_ms, cover_url, file_url, artist_id").in("id", trackIds);

  const { data: artistRows } = await admin
    .from("track_artists")
    .select("track_id, artists:artist_id(id, name)")
    .in("track_id", trackIds)
    .eq("role", "primary");

  const artistByTrack = new Map<number, string>();
  for (const row of (artistRows ?? []) as { track_id: number; artists: { id: number; name: string } | null }[]) {
    const artist = row.artists;
    if (artist) artistByTrack.set(row.track_id, artist.name);
  }

  const profileUserId = await getProfileUserId(supabase);
  const userVotes = new Set(
    voteRows.filter((v) => v.user_id === profileUserId).map((v) => v.track_id)
  );

  const requests = (tracks as TrackRow[] | null ?? [])
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: artistByTrack.get(t.id) ?? null,
      duration_ms: t.duration_ms,
      cover_url: t.cover_url,
      has_audio: !!t.file_url,
      vote_count: counts.get(t.id) ?? 0,
      user_voted: userVotes.has(t.id),
    }))
    .sort((a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title));

  return NextResponse.json({ channel_id: channel.id, requests });
}

/** POST — request/vote for a track on this channel (toggle off if already voted) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const userId = await getProfileUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = await getChannelBySlug(slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await request.json();
  const trackId = Number(body.track_id);
  if (!trackId) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = (await admin
    .from("channel_track_votes")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("track_id", trackId)
    .eq("user_id", userId)
    .maybeSingle()) as { data: { id: number } | null };

  if (existing) {
    await admin.from("channel_track_votes").delete().eq("id", existing.id);
    return NextResponse.json({ voted: false, track_id: trackId });
  }

  const insertRow = {
    channel_id: channel.id,
    track_id: trackId,
    user_id: userId,
  };
  const { error } = await admin.from("channel_track_votes").insert(insertRow as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ voted: true, track_id: trackId });
}

/** DELETE — remove the current user's vote for a track */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const userId = await getProfileUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = await getChannelBySlug(slug);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const trackId = Number(new URL(request.url).searchParams.get("track_id"));
  if (!trackId) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("channel_track_votes")
    .delete()
    .eq("channel_id", channel.id)
    .eq("track_id", trackId)
    .eq("user_id", userId);

  return NextResponse.json({ removed: true, track_id: trackId });
}
