import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google-drive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  try {
    const supabase = createAdminClient();

    // Get the host's user ID to fetch their Drive credentials
    const { data: host } = await supabase
      .from("users")
      .select("id")
      .eq("is_host", true)
      .single() as { data: { id: number } | null };

    // Verify this track exists in our library (security check)
    const { data: track } = await supabase
      .from("tracks")
      .select("drive_file_id")
      .eq("drive_file_id", fileId)
      .single() as { data: { drive_file_id: string } | null };

    // Only allow streaming tracks that are in our library
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    if (!host) {
      return NextResponse.json({ error: "No host found" }, { status: 404 });
    }

    // Get valid access token from host's credentials
    const accessToken = await getValidAccessToken(host.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Drive not connected" },
        { status: 401 }
      );
    }

    // Handle range requests for seeking
    const rangeHeader = request.headers.get("range");

    // Fetch the file from Google Drive
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(driveUrl, { headers });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: response.status }
      );
    }

    // Create response with appropriate headers
    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Type",
      response.headers.get("Content-Type") || "audio/mpeg"
    );

    if (response.headers.get("Content-Length")) {
      responseHeaders.set(
        "Content-Length",
        response.headers.get("Content-Length")!
      );
    }

    if (response.headers.get("Content-Range")) {
      responseHeaders.set(
        "Content-Range",
        response.headers.get("Content-Range")!
      );
    }

    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Stream error:", err);
    return NextResponse.json(
      { error: "Failed to stream file" },
      { status: 500 }
    );
  }
}
