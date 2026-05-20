import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/queries";

export async function GET() {
  const supabase = await createClient();
  const { data: tracks, error } = await db.tracks.list(supabase);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: tracks || [] });
}
