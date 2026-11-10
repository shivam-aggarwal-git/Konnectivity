import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Server } from "socket.io";
import { createSession, SESSION_COOKIE, setAdminPassword } from "../lib/auth.mjs";
import { mayJoin } from "../lib/access.mjs";
import { handleRoomAdmin } from "../lib/room-admin-http.mjs";
import { createOwnedGroup, createRoom, getRoom } from "../lib/rooms.mjs";
import { downloadContext, withDownloadCookies } from "../lib/room-credentials.mjs";

assert.ok(process.env.DATA_DIR && process.env.CACHE_DIR, "Use isolated test state");
await setAdminPassword("Synthetic-room-admin-test-password");
const server = createServer((req, res) => void handleRoomAdmin(req, res, io));
const io = new Server(server);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const headers = { Cookie: `${SESSION_COOKIE}=${createSession()}` };
const first = createRoom("First", true, true);
const second = createRoom("Second", true, true);
const legacy = createRoom("Legacy", true);
const jar = value => `# Netscape HTTP ${"Cookie File"}\n.youtube.com\tTRUE\t/\tTRUE\t0\tLOGIN_INFO\t${value}\n`;
function request(room, action, method = "GET", auth = {}, body) {
  return fetch(`${base}/api/room-admin/${room.code}/${action}`, { method, headers: auth, body });
}
try {
  writeFileSync(path.join(process.env.DATA_DIR, "cookies.txt"), jar("legacy"));
  assert.equal(downloadContext(first).file, null);
  assert.ok(downloadContext(legacy).file);
  const delegation = await request(first, "delegate", "POST", headers);
  assert.equal(delegation.status, 200);
  const link = new URL((await delegation.json()).link);
  const claim = new URLSearchParams(link.hash.slice(1)).get("room-claim");
  const claimHeaders = { "x-room-admin-key": claim };
  assert.equal(mayJoin({ headers: headers }, first, null), false);
  assert.equal((await request(first, "cookies", "GET", headers)).status, 403);
  assert.equal((await request(second, "claim", "POST", claimHeaders)).status, 403);
  const accepted = await request(first, "claim", "POST", claimHeaders);
  assert.equal(accepted.status, 200);
  const token = (await accepted.json()).credential;
  assert.equal((await request(first, "claim", "POST", claimHeaders)).status, 403);
  assert.equal((await request(first, "delegate", "POST", headers)).status, 409);
  const roomHeaders = { "x-room-admin-key": token };
  assert.ok(mayJoin({ headers: {} }, first, token));
  assert.equal(mayJoin({ headers: {} }, second, token), false);
  assert.equal((await request(first, "cookies")).status, 403);
  assert.equal((await request(second, "cookies", "POST", roomHeaders, jar("wrong-room"))).status, 403);
  assert.equal((await request(second, "room", "DELETE", roomHeaders)).status, 403);
  assert.equal((await request(first, "delegate", "POST", roomHeaders)).status, 403);
  const upload = await request(first, "cookies", "POST", roomHeaders, jar("first-only"));
  assert.equal(upload.status, 200);
  assert.deepEqual(await upload.json(), { present: true, usesServerCookie: false });
  const context = downloadContext(first);
  assert.notEqual(context.prefix, downloadContext(second).prefix);
  assert.equal(downloadContext(second).contents, undefined);
  await withDownloadCookies(context, file => {
    assert.equal(readFileSync(file, "utf8"), jar("first-only"));
    assert.equal(statSync(file).mode & 0o777, 0o600);
    writeFileSync(file, jar("modified-by-downloader"));
  });
  assert.equal(downloadContext(first).contents.toString(), jar("first-only"));
  assert.equal((await request(first, "delegate", "DELETE", headers)).status, 409);
  assert.equal((await request(first, "room", "DELETE", headers)).status, 200);
  assert.equal(getRoom(first.code), undefined);
  assert.ok(getRoom(second.code));
  assert.equal((await request(first, "room", "DELETE", headers)).status, 404);
  assert.equal(downloadContext(first).contents, undefined);
  const created = createOwnedGroup("Creator is admin", true);
  const creatorHeaders = { "x-room-admin-key": created.credential };
  assert.ok(mayJoin({ headers: {} }, created.room, created.credential));
  assert.equal((await request(created.room, "room", "DELETE", creatorHeaders)).status, 200);
  assert.equal(getRoom(created.room.code), undefined);
  function bulk(auth, confirmation, codes) {
    return fetch(`${base}/api/room-admin/rooms`, {
      method: "DELETE", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation, codes }),
    });
  }
  const codes = [second.code, legacy.code];
  assert.equal((await bulk(roomHeaders, "DELETE ALL", codes)).status, 403);
  assert.equal((await bulk(headers, "wrong", codes)).status, 400);
  assert.equal((await bulk(headers, "DELETE ALL", [second.code])).status, 409);
  assert.ok(getRoom(second.code) && getRoom(legacy.code));
  assert.equal((await request(second, "cookies", "POST", { "x-room-admin-key": second.ownerToken || "invalid" }, jar("blocked"))).status, 403);
  const unrelated = createRoom("Unselected", true, true);
  const picked = await bulk(headers, "DELETE SELECTED", [unrelated.code]);
  assert.equal(picked.status, 200);
  assert.deepEqual(await picked.json(), { deleted: 1, failed: 0 });
  assert.equal(getRoom(unrelated.code), undefined);
  assert.ok(getRoom(second.code) && getRoom(legacy.code));
  assert.equal((await bulk(headers, "DELETE SELECTED", [unrelated.code, second.code])).status, 409);
  assert.ok(getRoom(second.code));
  const wiped = await bulk(headers, "DELETE ALL", codes);
  assert.equal(wiped.status, 200);
  assert.deepEqual(await wiped.json(), { deleted: 2, failed: 0 });
  assert.equal(getRoom(second.code), undefined);
  assert.equal(getRoom(legacy.code), undefined);
  console.log("PASS: room-only admin credentials, cross-room denial, private cookie copies, scoped cache identities, single-use claims, and superadmin single/bulk deletion");
} finally {
  io.close();
}
