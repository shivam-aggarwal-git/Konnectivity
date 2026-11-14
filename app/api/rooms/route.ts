import { limitedJson } from "@/lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { createOwnedGroup, createRoom, getRoom, roomCount } from "@/lib/rooms.mjs";
import { isAuthed } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Return the durable owner key only to the browser creating the group.
export async function POST(req: NextRequest) {
  const superadmin = await isAuthed();
  if (!superadmin && roomCount() >= 1000) {
    return NextResponse.json({ error: "This server has reached its group limit." }, { status: 429 });
  }
  let name: string | undefined;
  let assignLater = false;
  let discoverable = false;
  let inviteOnly: boolean | undefined;
  try {
    const body = await limitedJson(req);
    assignLater = body?.assignLater === true;
    discoverable = body?.discoverable === true;
    name = typeof body?.name === "string" ? body.name.trim().slice(0, 15) : undefined;
    inviteOnly = typeof body?.inviteOnly === "boolean" ? body.inviteOnly : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid room details." }, { status: 400 });
  }
  if (assignLater) {
    if (!superadmin) return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
    const room = createRoom(name, inviteOnly, true, { requireYoutubeCookie: true });
    return NextResponse.json({ code: room.code, name: room.name });
  }
  const { room, credential } = createOwnedGroup(name, inviteOnly, { discoverable, requireYoutubeCookie: true });
  return NextResponse.json({ code: room.code, ownerToken: credential, name: room.name }, {
    headers: { "Cache-Control": "no-store" },
  });
}

// Check a room exists (for the join screen).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  const room = code ? getRoom(code) : null;
  if (!room) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, name: room.name });
}
