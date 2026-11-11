import {handleRoomAdmin} from "./lib/room-admin-http.mjs";
import {handleChatVideo} from "./lib/chat-video.mjs";
// Custom Konnectivity server: Next.js (UI + API routes) + Socket.io (realtime sync
// & chat) + a raw /audio route (range-served, yt-dlp-backed) on one HTTP server,
// so the whole app is a single process / single container.

import { guardRequest, allowedOrigin, mayRequestJoin, requestIp } from "./lib/access.mjs";
import { rateLimit } from "./lib/ratelimit.mjs";
import { createServer } from "http";
import next from "next";
import { handleChatMedia } from "./lib/chat-media.mjs";
import { handleUpload } from "./lib/uploads.mjs";
import { registerUpload, getRoom } from "./lib/rooms.mjs";
import { Server as IOServer } from "socket.io";
import { registerRoomHandlers } from "./lib/rooms.mjs";
import { handleAudioRequest, sweepCache } from "./lib/resolver.mjs";
import { ffmpegMissing } from "./lib/ffmpeg.mjs";
import { jsRuntimeMissing } from "./lib/jsruntime.mjs";
import { clearPublicUrl } from "./lib/publicurl.mjs";
import { startYtdlpUpdates } from "./lib/ytdlp.mjs";

try{process.loadEnvFile?.('.env.local');}catch(error){if(error.code!=='ENOENT')console.warn('Could not load local server configuration.');}

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer(async (req, res) => {
  try { if (await guardRequest(req,res,getRoom)) return; } catch { res.writeHead(400); res.end("Invalid request"); return; }
  if(req.url?.startsWith("/api/room-admin/")){await handleRoomAdmin(req,res,io);return;}
  if(req.url?.startsWith("/chat-video")){await handleChatVideo(req,res,getRoom);return;}
  if (req.url?.startsWith("/chat-media")) { handleChatMedia(req, res, getRoom); return; }
  if (req.url?.split("?")[0] === "/upload") { handleUpload(req, res, getRoom, (room, track) => registerUpload(io, room, track)); return; }
  if (req.url && req.url.startsWith("/audio/")) {
    handleAudioRequest(req, res, getRoom(new URL(req.url, "http://localhost").searchParams.get("room")));
    return;
  }
  handle(req, res);
});

// Accept only configured instance origins, with room authorization per connection.
const publicUrl = process.env.PUBLIC_URL || "";

const io = new IOServer(server, {
  maxHttpBufferSize: 512 * 1024,
  cors: { origin: publicUrl || false },
  allowRequest: (req, done) => done(null, io.engine.clientsCount < 256 && allowedOrigin(req) && rateLimit(`socket:${requestIp(req)}`,60,60000).ok),
});
io.use((socket,next) => { const a=socket.handshake.auth||{}; if(typeof a.code==="string" && /^[A-Z0-9]{6}$/.test(a.code) && mayRequestJoin(socket.request,getRoom(a.code),a.ownerToken)) next(); else next(new Error("Open a complete invitation link, or sign in as host.")); });
registerRoomHandlers(io, { authorizeJoin: (socket,room,owner) => socket.handshake.auth?.code === room.code && mayRequestJoin(socket.request,room,owner) });
server.requestTimeout=30000; server.headersTimeout=15000;

// Any tunnel from a previous run died with it. Drop the address now so nobody
// is handed a dead link if that process was killed before it could clean up;
// the launcher writes a fresh one once its tunnel is actually serving.
// The tunnel owns its URL lifecycle; app-only restarts must retain a live tunnel address.

// Evict cache files not played within 72h — sweep at boot and hourly.
sweepCache();
setInterval(sweepCache, 60 * 60 * 1000);

// An outdated yt-dlp fails every track with a 403. Keep it current.
startYtdlpUpdates();

server.listen(port, process.env.BIND_HOST || "127.0.0.1", () => {
  console.log(`> Konnectivity ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  if (ffmpegMissing()) {
    console.warn(
      "! ffmpeg was not found. Tracks will fail to convert.\n" +
        "  Install it and restart, or run `npm install` to fetch the bundled copy."
    );
  }
  if (jsRuntimeMissing()) {
    console.warn(
      "! No JavaScript runtime (deno) found. YouTube will bot-check this server\n" +
        "  and tracks will fail. Run `npm install` to fetch the bundled copy."
    );
  }
});
