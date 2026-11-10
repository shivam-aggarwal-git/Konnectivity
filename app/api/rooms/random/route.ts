import { NextResponse } from "next/server";
import { randomDiscoverableRoom } from "@/lib/rooms.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const room = randomDiscoverableRoom();
  return NextResponse.json(room ? { code: room.code } : {
    error: "No groups are accepting requests right now. A group admin must be online with random matching enabled.",
  }, { status: room ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
