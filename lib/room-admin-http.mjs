import { adminRequest, roomAdminKey } from "./access.mjs";
import { deleteRooms, deleteRoom, getRoom, issueRoomAdminClaim, claimRoomAdmin } from "./rooms.mjs";
import { clearRoomCookies, roomCookieStatus, storeRoomCookies } from "./room-credentials.mjs";
import { getPublicUrl } from "./publicurl.mjs";

export async function handleRoomAdmin(req, res, io) {
  const url = new URL(req.url, "http://localhost");
  const match = /^\/api\/room-admin\/([A-Z0-9]{6})\/(cookies|delegate|claim|room)$/.exec(url.pathname);
  const reply = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/api/room-admin/rooms") {
    if (!adminRequest(req)) return reply(403, { error: "Superadmin access required." });
    if (req.method !== "DELETE") return reply(405, { error: "Method not allowed." });
    const parts = [];
    let size = 0;
    let body;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 262144) return reply(413, { error: "Room list is too large." });
        parts.push(chunk);
      }
      body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch {
      return reply(400, { error: "Invalid room deletion request." });
    }
    const all = body?.confirmation === "DELETE ALL";
    if ((!all && body?.confirmation !== "DELETE SELECTED") || !Array.isArray(body.codes) || !body.codes.length ||
        body.codes.some(code => typeof code !== "string" || !/^[A-Z0-9]{6}$/.test(code))) {
      return reply(400, { error: "Confirm deletion of all rooms." });
    }
    const result = deleteRooms(io, new Set(body.codes), all);
    if (!result) return reply(409, { error: "The room list changed. Review it and confirm again." });
    if (result.failed) return reply(500, { error: `Deleted ${result.deleted} rooms. ${result.failed} could not be removed.` });
    return reply(200, result);
  }
  if (!match) return reply(404, { error: "Unknown room action." });
  const [, code, action] = match;
  const room = getRoom(code);
  const superadmin = adminRequest(req);
  const key = req.headers["x-room-admin-key"];
  const scoped = roomAdminKey(room, key);
  const authorized = action === "claim" || (action === "cookies"
    ? scoped || (superadmin && room && !room.roomScoped)
    : superadmin || (action === "room" && scoped && room.roomScoped));
  if (!authorized) return reply(403, { error: "Room administrator access required." });
  if (!room) return reply(404, { error: "Room not found." });

  try {
    if (action === "claim" && req.method === "POST") {
      const credential = claimRoomAdmin(room, key);
      if (!credential) return reply(403, { error: "The setup invitation is invalid or has already been used." });
      return reply(200, { credential });
    }
    if (action === "cookies") {
      if (req.method === "POST") {
        const parts = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 262144) return reply(413, { error: "Cookie file exceeds 256 KB." });
          parts.push(chunk);
        }
        // An upload can finish after the room was deleted or the key revoked.
        if (getRoom(code) !== room || (!roomAdminKey(room, key) && !(superadmin && !room.roomScoped))) {
          return reply(403, { error: "Room access changed. Sign in again." });
        }
        try { storeRoomCookies(code, Buffer.concat(parts).toString("utf8")); }
        catch (error) { return reply(400, { error: error.code ? "Could not save the cookie file." : error.message }); }
      } else if (req.method === "DELETE") {
        clearRoomCookies(code);
      } else if (req.method !== "GET") {
        return reply(405, { error: "Method not allowed." });
      }
      return reply(200, roomCookieStatus(room));
    }
    if (action === "delegate" && req.method === "POST") {
      const token = issueRoomAdminClaim(room, true);
      if (!token) return reply(409, { error: "This room already has an administrator or is a legacy room." });
      const base = getPublicUrl() || `http://localhost:${process.env.PORT || "3000"}`;
      return reply(200, { link: `${base}/r/${code}?host=1#room-claim=${encodeURIComponent(token)}` });
    }
    if (action === "delegate" && req.method === "DELETE") {
      if (!room.roomScoped || room.delegatedAdmin) return reply(409, { error: "Only unused setup invitations can be canceled." });
      issueRoomAdminClaim(room, false);
      return reply(200, { ok: true });
    }
    if (action === "room" && req.method === "DELETE") {
      deleteRoom(io, room, superadmin ? "The superadmin deleted this room." : "The room admin deleted this room.");
      return reply(200, { ok: true });
    }
    return reply(405, { error: "Method not allowed." });
  } catch {
    return reply(500, { error: "Could not complete the room action." });
  }
}
