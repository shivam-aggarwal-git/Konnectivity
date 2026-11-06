// Durable local audio lives outside the disposable YouTube cache.
import path from "node:path";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadSync, saveNow } from "./store.mjs";
import { ffmpegPath } from "./ffmpeg.mjs";
const run = promisify(execFile);
const directory = path.resolve(process.env.DATA_DIR || "./data", "uploads");
const index = loadSync("uploads", {});
let writeQueue = Promise.resolve();
function persistUploads() {
  const job = writeQueue.then(() => saveNow("uploads", index));
  writeQueue = job.catch(() => {});
  return job;
}
export const isLocalId = id => typeof id === "string" && /^local_[a-f0-9]{32}$/.test(id);
export function localAudioPath(id) {
  if (!isLocalId(id)) throw new Error("Invalid local track ID");
  return path.join(directory, `${id}${index[id]?.audioExt === ".mp3" ? ".mp3" : ".m4a"}`);
}
export function allUploadedTracks() { return Object.values(index).filter(t => existsSync(localAudioPath(t.videoId))); }
export function uploadedTrack(id) {
  return isLocalId(id) && index[id] && existsSync(localAudioPath(id)) ? { ...index[id] } : null;
}
const MAX_BYTES = 100 * 1024 * 1024;
let active = 0;
export async function handleUpload(req, res, getRoom, onUploaded = () => {}) {
  const reply = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.method !== "POST") return reply(405, { error: "Use POST" });
  const room = getRoom(String(req.headers["x-room-code"] || ""));
  const token = req.headers["x-upload-token"];
  if (!token || !room || ![...room.participants.values()].some(p => p.uploadToken === token && p.status !== "reconnecting"))
    return reply(403, { error: "Join the room before uploading" });
  let name;
  try { name = decodeURIComponent(String(req.headers["x-file-name"] || "")); } catch { return reply(400, { error: "Invalid filename" }); }
  if (!/\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|aiff|aif|wma)$/i.test(name)) return reply(415, { error: "Choose an MP3, FLAC, WAV, M4A, AAC, OGG, OPUS, WEBM, AIFF or WMA file" });
  if (Number(req.headers["content-length"]) > MAX_BYTES) return reply(413, { error: "Maximum file size is 100 MB" });
  if (active >= 2) return reply(429, { error: "Two files are processing. Try again shortly." });
  active++;
  const quota=Math.max(100,Number(process.env.UPLOAD_LIBRARY_MAX_MB||10240))*1024*1024;
  const used=(await Promise.all(Object.values(index).map(async t=>{try{return (await fs.stat(localAudioPath(t.videoId))).size;}catch{return 0;}}))).reduce((a,b)=>a+b,0);
  if(used+active*MAX_BYTES>quota){active--;return reply(413,{error:"The server music library is at its storage limit. Ask the host to increase the quota."});}
  const id = `local_${crypto.randomUUID().replaceAll("-", "")}`;
  const input = path.join(directory, `${id}.input`);
  const output = localAudioPath(id);
  let complete = false;
  try {
    await fs.mkdir(directory, { recursive: true });
    let bytes = 0;
    const hash = createHash("sha256");
    await pipeline(req, new Transform({ transform(chunk, _encoding, cb) {
      bytes += chunk.length;
      hash.update(chunk);
      cb(bytes > MAX_BYTES ? new Error("Maximum file size is 100 MB") : null, chunk);
    } }), createWriteStream(input, { flags: "wx" }));
    const sha256 = hash.digest("hex");
    const existing = Object.values(index).find(track => track.sha256 === sha256 && existsSync(localAudioPath(track.videoId)));
    if (existing) { await onUploaded(room, existing); reply(200, { track: existing, duplicate: true }); return; }
    const { stdout, stderr } = await run(ffmpegPath() || "ffmpeg", [
      "-hide_banner", "-nostdin", "-protocol_whitelist", "file,pipe", "-i", input,
      "-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
      "-fs", String(MAX_BYTES), "-progress", "pipe:1", "-n", output,
    ], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    const times = [...stdout.matchAll(/out_time_us=(\d+)/g)];
    const duration = Number(times.at(-1)?.[1] || 0) / 1e6;
    if (!duration || !(await fs.stat(output)).size || (await fs.stat(output)).size >= MAX_BYTES) throw new Error("No playable audio");
    const metadata = stderr.split(/Duration:/)[0];
    const title = metadata.match(/^\s+title\s*:\s*(.+)$/mi)?.[1]?.trim() || path.basename(name).replace(/\.[^.]+$/, "");
    const artist = metadata.match(/^\s+artist\s*:\s*(.+)$/mi)?.[1]?.trim() || "Our music";
    const track = { videoId: id, title: title.slice(0, 200), artist: artist.slice(0, 200), duration, sha256 };
    index[id] = track;
    await persistUploads();
    await onUploaded(room, track);
    complete = true;
    reply(201, { track });
  } catch (error) {
    delete index[id];
    if (!res.destroyed) reply(400, { error: error.message.includes("100 MB") ? error.message : "Could not read this audio file. Try another format or a smaller file." });
  } finally {
    active--;
    await fs.unlink(input).catch(() => {});
    if (!complete) await fs.unlink(output).catch(() => {});
  }
}
