import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ChannelRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  for_user_id: number | null;
  for_user?: { display_name: string } | null;
  channel_state: {
    is_playing: boolean;
    current_track_id: number | null;
    current_track?: {
      title: string;
      artists: { name: string } | null;
    } | null;
  } | null;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("id, is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as { id: number; is_host: boolean } | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: channelsData, error } = await supabase
    .from("channels")
    .select(`
      id,
      name,
      slug,
      description,
      cover_url,
      is_public,
      for_user_id,
      for_user:for_user_id(display_name),
      channel_state(
        is_playing,
        current_track_id,
        current_track:current_track_id(
          title,
          artists:artist_id(name)
        )
      )
    `)
    .eq("is_active", true)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }

  const channels = channelsData as unknown as ChannelRow[];

  const accessibleChannels = channels.filter((channel) => {
    if (channel.is_public) return true;
    if (channel.for_user_id === profile.id) return true;
    if (profile.is_host) return true;
    return false;
  });

  const personalChannel = accessibleChannels.find(
    (c) => c.for_user_id === profile.id
  );

  const otherChannels = accessibleChannels.filter(
    (c) => c.for_user_id !== profile.id
  );

  return NextResponse.json({
    personalChannel: personalChannel || null,
    channels: otherChannels,
    userId: profile.id,
  });
}
