import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookiesFilePath, validateCookies } from "./ytcookies.mjs";

const directory = path.resolve(process.env.DATA_DIR || "./data", "room-cookies");
function roomFile(code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Invalid room code");
  return path.join(directory, code + ".txt");
}

export function roomCookieStatus(room) {
  const present = existsSync(roomFile(room.code));
  return { present, usesServerCookie: !present && !room.roomScoped && Boolean(cookiesFilePath()) };
}

export const YOUTUBE_SETUP_MESSAGE = "Ask the group admin to upload YouTube cookies in room settings.";

export function needsYoutubeCookie(room, videoId) {
  return Boolean(room?.requireYoutubeCookie && !videoId?.startsWith("local_") && !roomCookieStatus(room).present);
}

export function storeRoomCookies(code, text) {
  const result = validateCookies(text);
  if (!result.ok) throw new Error(result.error);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = roomFile(code);
  const temp = file + "." + randomUUID();
  try {
    writeFileSync(temp, text, { mode: 0o600, flag: "wx" });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

export function clearRoomCookies(code) {
  rmSync(roomFile(code), { force: true });
}

/** Never let yt-dlp write back to the stored room credential. */
export function withDownloadCookies(context, run) {
  if (!context.contents) return run(context.file);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "download-" + randomUUID() + ".txt");
  writeFileSync(file, context.contents, { mode: 0o600, flag: "wx" });
  return Promise.resolve().then(() => run(file)).finally(() => rmSync(file, { force: true }));
}

export function downloadContext(room) {
  if (!room) return { prefix: "", file: cookiesFilePath() };
  let contents;
  try { contents = readFileSync(roomFile(room.code)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!contents && !room.roomScoped) return { prefix: "", file: cookiesFilePath() };
  const revision = contents ? createHash("sha256").update(contents).digest("hex").slice(0, 20) : "public";
  return { prefix: room.code + "-" + revision + "-", contents, file: null };
}
