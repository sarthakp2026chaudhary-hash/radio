import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  if (!query) {
    return NextResponse.json({ artists: [] });
  }

  const supabase = await createClient();

  const { data: artists, error } = await supabase
    .from("artists")
    .select("id, name, slug, image_url")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ artists });
}
