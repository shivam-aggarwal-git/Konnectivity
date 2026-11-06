// Lyrica HTTP integration. Only public track metadata leaves this server.
// No YouTube credentials, browser cookies or uploaded audio are forwarded.
const cache = new Map(), pending = new Map();
const CACHE_MAX = 500, LIMIT = 1024 * 1024;
export function parseLrc(lrc) {
  const lines = [];
  for (const raw of String(lrc || "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const s of stamps) {
      lines.push({ t: Number(s[1]) * 60 + Number(s[2].replace(":", ".")), text });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

export function supportedLyrics(text){
 const letters=[...String(text||'')].filter(ch=>/\p{Letter}/u.test(ch));
 return letters.length>0&&letters.every(ch=>/[\p{Script=Latin}\p{Script=Devanagari}]/u.test(ch));
}


export function normalizeLyrica(payload) {
  const data = payload?.status === "success" ? payload.data : null;
  if (!data || typeof data !== "object") return null;
  const timed = Array.isArray(data.timed_lyrics) ? data.timed_lyrics.slice(0, 5000) : [];
  const candidate = timed.map(line => ({t: Number(line.start_time) / 1000, text: String(line.text ?? "").slice(0, 1000)}));
  const validTimes = candidate.every(line => Number.isFinite(line.t) && line.t >= 0 && line.t <= 86400);
  // Some providers append translated credits or translations. Never display those lines.
  const accepted = candidate.filter(line => supportedLyrics(line.text) || !/\p{Letter}/u.test(line.text));
  const synced = validTimes && accepted.some(line => supportedLyrics(line.text)) ? accepted.sort((a,b) => a.t-b.t) : [];
  const raw = typeof data.lyrics === "string" ? data.lyrics.slice(0, 200000) : "";
  const plain = raw.replace(/\[[^\]]*\]/g, "").split(/\r?\n/).filter(line => supportedLyrics(line) || !/\p{Letter}/u.test(line)).join("\n").trim();
  if (!synced.length && !supportedLyrics(plain)) return null;
  return {synced: synced.length ? synced : null, plain: supportedLyrics(plain) ? plain : null,
    instrumental: false, provider: "Lyrica", source: String(data.source || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40)};
}

async function request(track, sequence) {
  const endpoint = new URL(process.env.LYRICA_URL || "https://test-0k.onrender.com");
  if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Invalid Lyrica endpoint");
  endpoint.pathname = endpoint.pathname.replace(/\/$/, "") + "/lyrics/";
  endpoint.search = new URLSearchParams({artist: String(track.artist || "").slice(0,200), song: String(track.title || "").slice(0,200), timestamps:"true", sequence, pass:"true"}).toString();
  const response = await fetch(endpoint, {headers:{accept:"application/json"}, signal:AbortSignal.timeout(25000), redirect:"error"});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Lyrics service unavailable");
  if (Number(response.headers.get("content-length")) > LIMIT) { await response.body?.cancel(); throw new Error("Lyrics response too large"); }
  const reader = response.body?.getReader();
  if (!reader) return null;
  let size=0; const parts=[];
  try {
    for (;;) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT)throw new Error("Lyrics response too large");parts.push(value);}
  } catch(error) {await reader.cancel();throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return normalizeLyrica(JSON.parse(new TextDecoder().decode(bytes)));
}

export async function getLyrics(track) {
  const key=JSON.stringify([track.title,track.artist]);
  const hit=cache.get(key);
  if(hit && Date.now()-hit.at < (hit.value ? 12*60*60*1000 : 5*60*1000)) return hit.value;
  if(pending.has(key)) return pending.get(key);
  if(pending.size>=6) throw new Error("Lyrics service busy");
  const task=(async()=>{
    // Explicit provider sequences exclude LRCLIB (provider 2), including fallback.
    const value=await request(track,"7,1,3,4,5,6,8") || await request(track,"1,3,5,6,8");
    cache.set(key,{value,at:Date.now()});
    if(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
}
