import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface ScheduleRow {
  id: number;
  channel_id: number;
  name: string;
  playlist_id: number | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  playlist?: { id: number; name: string } | null;
}

interface ChannelRow {
  id: number;
}

interface UserRow {
  is_host: boolean;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: channelData } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", slug)
    .single();

  const channel = channelData as ChannelRow | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const { data: schedulesData, error } = await supabase
    .from("channel_schedules" as any)
    .select(`
      id,
      channel_id,
      name,
      playlist_id,
      day_of_week,
      start_time,
      end_time,
      is_active,
      created_at,
      playlist:playlist_id(id, name)
    `)
    .eq("channel_id", channel.id)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Failed to fetch schedules:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }

  const schedules = schedulesData as ScheduleRow[];

  return NextResponse.json({ schedules, channelId: channel.id });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  const { data: channelData } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", slug)
    .single();

  const channel = channelData as ChannelRow | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, playlist_id, day_of_week, start_time, end_time } = body;

  if (!name?.trim() || !start_time || !end_time) {
    return NextResponse.json(
      { error: "Name, start_time, and end_time are required" },
      { status: 400 }
    );
  }

  if (start_time >= end_time) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const { data: schedule, error } = await supabase
    .from("channel_schedules" as any)
    .insert({
      channel_id: channel.id,
      name: name.trim(),
      playlist_id: playlist_id || null,
      day_of_week: day_of_week ?? null,
      start_time,
      end_time,
      is_active: true,
    } as any)
    .select(`
      id,
      channel_id,
      name,
      playlist_id,
      day_of_week,
      start_time,
      end_time,
      is_active,
      created_at,
      playlist:playlist_id(id, name)
    `)
    .single();

  if (error) {
    console.error("Failed to create schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }

  return NextResponse.json({ schedule }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Schedule ID required" }, { status: 400 });
  }

  if (updates.start_time && updates.end_time && updates.start_time >= updates.end_time) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const { data: schedule, error } = await (supabase as any)
    .from("channel_schedules")
    .update(updates)
    .eq("id", id)
    .select(`
      id,
      channel_id,
      name,
      playlist_id,
      day_of_week,
      start_time,
      end_time,
      is_active,
      created_at,
      playlist:playlist_id(id, name)
    `)
    .single();

  if (error) {
    console.error("Failed to update schedule:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }

  return NextResponse.json({ schedule });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as UserRow | null;

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Schedule ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("channel_schedules" as any)
    .delete()
    .eq("id", parseInt(id));

  if (error) {
    console.error("Failed to delete schedule:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
