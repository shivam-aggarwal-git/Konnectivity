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

export function needsYoutubeCookie(room, videoId, participant) {
  return Boolean(room?.requireYoutubeCookie && !videoId?.startsWith("local_") && !roomCookieStatus(room).present && !personalCookieStatus(room, participant).present);
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

export function downloadContext(room, participant) {
  if (room && participant) {
    const personal = personalCookiePath(room, participant);
    let contents; try { contents=readFileSync(personal); } catch(error) { if(error.code!=="ENOENT") throw error; }
    if(contents) return {prefix: room.code+"-member-"+path.basename(personal,".txt").slice(0,20)+"-"+createHash("sha256").update(contents).digest("hex").slice(0,20)+"-", contents, file:null};
  }
  if (!room) return { prefix: "", file: cookiesFilePath() };
  let contents;
  try { contents = readFileSync(roomFile(room.code)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!contents && !room.roomScoped) return { prefix: "", file: cookiesFilePath() };
  const revision = contents ? createHash("sha256").update(contents).digest("hex").slice(0, 20) : "public";
  return { prefix: room.code + "-" + revision + "-", contents, file: null };
}


const personalDirectory = path.resolve(process.env.DATA_DIR || './data', 'member-cookies');
function personalCookiePath(room, participant) {
  if (!room || !/^[A-Z0-9]{6}$/.test(room.code) || !participant || !(participant.mediaIdentity || participant.uploadToken)) throw Error('Join the room first.');
  const identity=createHash('sha256').update(participant.mediaIdentity || participant.uploadToken).digest('hex');
  return path.join(personalDirectory,room.code,identity+'.txt');
}
export function personalCookieStatus(room, participant) {
  if(!room || !participant)return {present:false};
  return {present:existsSync(personalCookiePath(room,participant))};
}
export function storePersonalCookies(room, participant, text) {
  const result=validateCookies(text);if(!result.ok)throw Error(result.error);
  const file=personalCookiePath(room,participant);mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=file+'.'+randomUUID();
  try {writeFileSync(temporary,text,{mode:0o600,flag:'wx'});renameSync(temporary,file);} finally {rmSync(temporary,{force:true});}
}
export function clearPersonalCookies(room,participant) {rmSync(personalCookiePath(room,participant),{force:true});}
export function clearAllPersonalCookies(code) {if(!/^[A-Z0-9]{6}$/.test(code))throw Error('Invalid room');rmSync(path.join(personalDirectory,code),{recursive:true,force:true});}
