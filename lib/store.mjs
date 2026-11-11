// Tiny JSON-file persistence (no native deps — portable across Node 20/24 and
// Docker). Each namespace is one file under DATA_DIR, written debounced.
// Adequate for friends-scale; swap for SQLite later if it ever needs it.

import { promises as fs, readFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import path from "path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

try { chmodSync(DATA_DIR,0o700); for(const name of ["admin.json","settings.json","cookies.txt"])if(existsSync(path.join(DATA_DIR,name)))chmodSync(path.join(DATA_DIR,name),0o600); } catch {}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/** Load a namespace synchronously at startup. Returns `fallback` if missing. */
export function loadSync(name, fallback) {
  try {
    const raw = readFileSync(filePath(name), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const timers = new Map();
const writes = new Map();

function writeSnapshot(name, data) {
  const contents = JSON.stringify(data, null, 2);
  const destination = filePath(name);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const write = (writes.get(name) || Promise.resolve()).then(async () => {
    try {
      await fs.writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  });
  const settled = write.catch(() => {});
  writes.set(name, settled);
  void settled.then(() => { if (writes.get(name) === settled) writes.delete(name); });
  return write;
}

export function saveDebounced(name, data, ms = 400) {
  clearTimeout(timers.get(name));
  timers.set(name, setTimeout(() => {
    timers.delete(name);
    writeSnapshot(name, data).catch(error => console.error(`store: failed to write ${name}:`, error.code || "unknown"));
  }, ms));
}

export async function saveNow(name, data) {
  clearTimeout(timers.get(name));
  timers.delete(name);
  await writeSnapshot(name, data);
}
