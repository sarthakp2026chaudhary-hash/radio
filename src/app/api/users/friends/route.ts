import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface FriendRow {
  id: number;
  display_name: string;
  email: string;
  avatar_url: string | null;
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
    .select("is_host")
    .eq("auth_id", user.id)
    .single();

  const profile = profileData as { is_host: boolean } | null;

  if (!profile?.is_host) {
    return NextResponse.json({ error: "Host access required" }, { status: 403 });
  }

  const { data: friendsData, error } = await supabase
    .from("users")
    .select("id, display_name, email, avatar_url")
    .eq("is_host", false)
    .eq("is_host_listener", false)
    .order("display_name");

  if (error) {
    console.error("Failed to fetch friends:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }

  const friends = friendsData as FriendRow[] | null;

  return NextResponse.json({ friends: friends || [] });
}
