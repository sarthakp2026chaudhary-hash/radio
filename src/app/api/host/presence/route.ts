import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

export async function GET() {
  const supabase = await createClient();

  const { data: presence, error } = await db.hostPresence.get(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!presence) {
    return NextResponse.json({ is_live: false, channel: null, user: null });
  }

  const isStale = new Date(presence.last_heartbeat).getTime() < Date.now() - 60000;

  return NextResponse.json({
    is_live: !isStale,
    channel: presence.channels,
    user: presence.users,
    session_started_at: presence.session_started_at,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await db.users.getByAuthId(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!profile.is_host_listener && !profile.is_host) {
    return NextResponse.json({ error: "Only host accounts can broadcast" }, { status: 403 });
  }

  const body = await request.json();
  const { channel_id, is_listening } = body;

  const { data: presence, error } = await db.hostPresence.update(supabase, profile.id, {
    channel_id: is_listening ? channel_id : null,
    is_listening: !!is_listening,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (is_listening && channel_id) {
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("id", channel_id)
      .single();

    if (channel) {
      await db.channelState.update(supabase, channel_id, {
        broadcast_mode: "live",
        live_host_user_id: profile.id,
        live_started_at: new Date().toISOString(),
      });
    }
  } else if (!is_listening && presence?.channel_id) {
    await db.channelState.update(supabase, presence.channel_id, {
      broadcast_mode: "automated",
      live_host_user_id: null,
      live_started_at: null,
    });
  }

  return NextResponse.json({ presence });
}
