import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    server_time: Date.now(),
  });
}

export async function POST() {
  return NextResponse.json({
    server_time: Date.now(),
  });
}
