import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface Sticker {
  id: number;
  drive_file_id: string;
  name: string;
  label: string;
}

// GET - Fetch available stickers
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: stickers, error } = (await supabase
      .from("stickers")
      .select("*")
      .order("created_at", { ascending: true })) as {
      data: Sticker[] | null;
      error: Error | null;
    };

    if (error) {
      throw error;
    }

    return NextResponse.json({ stickers: stickers || [] });
  } catch (err) {
    console.error("Get stickers error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stickers" },
      { status: 500 }
    );
  }
}

// POST - Import a sticker from Drive (host only)
export async function POST(request: Request) {
  try {
    const { driveFileId, name, label } = await request.json();

    if (!driveFileId || !name || !label) {
      return NextResponse.json(
        { error: "Missing required fields: driveFileId, name, label" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify host
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = (await adminClient
      .from("users")
      .select("is_host")
      .eq("auth_id", user.id)
      .single()) as { data: { is_host: boolean } | null };

    if (!profile?.is_host) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    // Insert sticker
    const { data: sticker, error } = (await (
      adminClient.from("stickers") as any
    )
      .upsert(
        {
          drive_file_id: driveFileId,
          name,
          label,
        },
        { onConflict: "drive_file_id" }
      )
      .select()
      .single()) as { data: Sticker | null; error: Error | null };

    if (error) {
      throw error;
    }

    return NextResponse.json({ sticker });
  } catch (err) {
    console.error("Import sticker error:", err);
    return NextResponse.json(
      { error: "Failed to import sticker" },
      { status: 500 }
    );
  }
}
