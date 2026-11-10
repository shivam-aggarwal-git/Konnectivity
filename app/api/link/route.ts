import { getRoom } from "@/lib/rooms.mjs";
import { downloadContext } from "@/lib/room-credentials.mjs";
import { isAuthed } from "@/lib/guard";
import { NextRequest, NextResponse } from "next/server";
import { resolveLink, resolveYoutubePlaylist } from "@/lib/links.mjs";
import { clientIp, rateLimit } from "@/lib/ratelimit.mjs";

export const dynamic = "force-dynamic";

// A Spotify playlist is up to a hundred searches against YouTube Music, so a
// link costs far more than a search does. Generous for a person pasting a few
// playlists; low enough that a script can't use the instance as a free
// Spotify-to-YouTube converter.
const LIMIT = Number(process.env.LINK_IMPORT_LIMIT ?? 30);

/** Resolve a pasted YouTube or Spotify link into playable tracks. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  const ip = clientIp(req) ?? "local";
  const gate = rateLimit(`link:${ip}`, LIMIT, 60 * 60 * 1000);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many links in the last hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  try {
    const code = req.nextUrl.searchParams.get("room");
    const room = code ? getRoom(code) : null;
    if (code && !room) return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    const context = room || await isAuthed() ? downloadContext(room) : { prefix: "", file: null };
    return NextResponse.json(await (req.nextUrl.searchParams.get("playlist")==="1"?resolveYoutubePlaylist(url, context):resolveLink(url, context)));
  } catch (err) {
    return NextResponse.json(
      { error: "link_failed", message: req.nextUrl.searchParams.get("playlist")==="1"?"Could not read this playlist. Use a public or unlisted YouTube playlist, or one your server account can access.":"Could not read this link. Check its visibility and try again." },
      { status: 422 }
    );
  }
}
