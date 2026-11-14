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

  // Some providers append translated credits or translations. Never display those lines.
  const accepted = candidate.filter(line => Number.isFinite(line.t) && line.t >= 0 && line.t <= 86400 && (supportedLyrics(line.text) || !/\p{Letter}/u.test(line.text)));
  const synced = accepted.some(line => supportedLyrics(line.text)) ? accepted.sort((a,b) => a.t-b.t) : [];
  const raw = typeof data.lyrics === "string" ? data.lyrics.slice(0, 200000) : "";
  const fromLrc=parseLrc(raw).filter(line=>supportedLyrics(line.text));
  if(!synced.length&&fromLrc.length)synced.push(...fromLrc);
  const plain = raw.replace(/\[[^\]]*\]/g, "").split(/\r?\n/).filter(line => supportedLyrics(line) || !/\p{Letter}/u.test(line)).join("\n").trim();
  if (!synced.length && !supportedLyrics(plain)) return null;
  return {synced: synced.length ? synced : null, plain: supportedLyrics(plain) ? plain : null,
    instrumental: false, provider: "Lyrica", source: String(data.source || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40)};
}

export function lyricSearchTrack(track){
 let title=String(track.title||'').replace(/\[[^\]]*(?:official|video|audio|lyrics|HD|4K)[^\]]*\]/gi,'').replace(/\([^)]*(?:official|video|audio|lyrics|HD|4K)[^)]*\)/gi,'').split('|')[0].replace(/\b(?:official|full)\s+(?:music\s+)?(?:video|audio|song|lyrics?)\b|\b(?:lyrical|video)\s+song\b/gi,'').replace(/\s*[-–:]\s*$/,'').trim();
 const artist=String(track.artist||'').replace(/ - Topic$|VEVO$/gi,'').split(/,|\s+(?:feat\.?|ft\.?)\s+/i)[0].trim();
 if(artist&&title.toLowerCase().startsWith(artist.toLowerCase()+' - '))title=title.slice(artist.length+3);
 return {...track,title,artist};
}
async function request(track, sequence) {
  const endpoint = new URL(process.env.LYRICA_URL || "https://test-0k.onrender.com");
  if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Invalid Lyrica endpoint");
  endpoint.pathname = endpoint.pathname.replace(/\/$/, "") + "/lyrics/";
  endpoint.search = new URLSearchParams({artist: String(track.artist || "").slice(0,200), song: String(track.title || "").slice(0,200), timestamps:"true", sequence, pass:"true"}).toString();
  const response = await fetch(endpoint, {headers:{accept:"application/json"}, signal:AbortSignal.timeout(45000), redirect:"error"});
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
  const payload=JSON.parse(new TextDecoder().decode(bytes));
  if(payload?.status!=="success"&&/timeout|unavailable|rate|busy|failed/i.test(String(payload?.message||payload?.error||'')))throw Error('Lyrics service unavailable');
  return normalizeLyrica(payload);
}

export async function getLyrics(track, {refresh=false} = {}) {
  const key=JSON.stringify(["lyrics-v3",track.title,track.artist]);
  const hit=cache.get(key);
  if(!refresh&&hit?.value&&Date.now()-hit.at<12*60*60*1000)return hit.value;
  if(pending.has(key)) return pending.get(key);
  if(pending.size>=6) throw new Error("Lyrics service busy");
  const task=(async()=>{
    // Explicit provider sequences exclude LRCLIB (provider 2), including fallback.
    const clean=lyricSearchTrack(track);let value=null,lastError;
    for(const [candidate,sequence] of [[clean,"4,7,3,1,5,6,8"],[track,"3,1,5,6,8"]]){try{value=await request(candidate,sequence);if(value)break;}catch(error){lastError=error;}}
    if(!value&&lastError)throw lastError;
    if(value)cache.set(key,{value,at:Date.now()});
    if(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
}
