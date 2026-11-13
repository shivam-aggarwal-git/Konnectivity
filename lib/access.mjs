import { needsYoutubeCookie, YOUTUBE_SETUP_MESSAGE } from "./room-credentials.mjs";
import { BRANDING_MAX_BYTES } from "./branding-limit.mjs";
// Private-instance and room capability checks. No credential values are logged.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import os from 'node:os';
import {isIP} from 'node:net';
import {verifySession,SESSION_COOKIE,isSetupComplete} from './auth.mjs';
import {getPublicUrl} from './publicurl.mjs';
import {rateLimit} from './ratelimit.mjs';
export function equalToken(a,b){if(typeof a!=='string'||typeof b!=='string'||!a||a.length>512||a.length!==b.length)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function cookieMap(req){const out=Object.create(null);for(const part of String(req.headers.cookie||'').slice(0,16384).split(';')){const i=part.indexOf('=');if(i>0){try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));}catch{}}}return out;}
export function adminRequest(req){return verifySession(cookieMap(req)[SESSION_COOKIE]);}
export function participantAccess(room,token,{allowReconnecting=false}={}){
 return Boolean(room&&typeof token==="string"&&[...room.participants.values()].some(p=>
  (allowReconnecting||p.status!=="reconnecting")&&equalToken(p.uploadToken,token)));
}
export function roomKeyHash(key) {
 return typeof key === "string" && /^[a-zA-Z0-9_-]{20,128}$/.test(key)
   ? createHash("sha256").update(key).digest("hex") : null;
}
export function roomAdminKey(room, key) {
 if (!room) return false;
 return room.roomScoped ? equalToken(roomKeyHash(key), room.delegatedAdmin) : equalToken(key, room.ownerToken);
}
export function roomAccess(req,room){return Boolean(room&&((!room.roomScoped&&adminRequest(req))||participantAccess(room,cookieMap(req)[`kn_member_${room.code}`])));}
export function mayJoin(req,room,key){return Boolean(room&&(roomAdminKey(room,key)||equalToken(cookieMap(req)[`kn_invite_${room.code}`],room.inviteToken)||roomAccess(req,room)));}
export function mayRequestJoin(req,room,key){
 if (room?.discoverable || mayJoin(req,room,key)) return true;
 if (!room) return false;
 const token = cookieMap(req)[`kn_member_${room.code}`];
 return [...room.participants.values()].some(member => member.status === "reconnecting" && equalToken(member.uploadToken, token));
}
function loopback(req){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);}
export function localSetupRequest(req){return loopback(req)&&/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(String(req.headers.host||''))&&!req.headers['cf-connecting-ip']&&!req.headers['x-forwarded-for'];}
function trustedProxy(req) {
 const publicUrl = getPublicUrl();
 if (!publicUrl || !loopback(req)) return false;
 try { return new URL(publicUrl).host === req.headers.host; } catch { return false; }
}
export function requestIp(req) {
 const forwarded = trustedProxy(req) && String(req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || '').split(',').at(-1).trim();
 return forwarded && isIP(forwarded) ? forwarded : req.socket?.remoteAddress || 'unknown';
}
function origins(){const p=process.env.PORT||'3000';const set=new Set([`http://localhost:${p}`,`http://127.0.0.1:${p}`,`http://[::1]:${p}`]);for(const rows of Object.values(os.networkInterfaces()))for(const n of rows||[])if(n.family==='IPv4')set.add(`http://${n.address}:${p}`);try{const u=getPublicUrl();if(u)set.add(new URL(u).origin);}catch{}return set;}
export function secureRequest(req) {
 return Boolean(req.socket?.encrypted || (trustedProxy(req) && req.headers['x-forwarded-proto'] === 'https') || process.env.SECURE_COOKIES === 'true');
}
export function allowedOrigin(req) {
 const host = req.headers.host;
 const allowed = origins();
 const origin = req.headers.origin;
 if (![...allowed].some(value => new URL(value).host === host)) return false;
 return !origin || (allowed.has(origin) && origin === `${secureRequest(req) ? 'https' : 'http'}://${host}`);
}
function setCookie(req,res,name,value){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureRequest(req)?'; Secure':''}`);}
function reply(res,status,error){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}));return true;}
async function smallJson(req,limit=16384){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>limit)throw Error('body_too_large');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString()||'{}');}
export async function guardRequest(req,res,getRoom){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=(self), display-capture=(self)');
 const nonce = randomBytes(18).toString('base64');
 const scriptPolicy = process.env.NODE_ENV === 'development' ? "'unsafe-inline' 'unsafe-eval'" : `'nonce-${nonce}'`;
 const csp = `default-src 'self'; script-src 'self' ${scriptPolicy} https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://www.youtube.com https://api.giphy.com https://pingback.giphy.com; media-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
 req.headers['content-security-policy'] = csp;
 res.setHeader('Content-Security-Policy',csp);
 if(secureRequest(req))res.setHeader('Strict-Transport-Security','max-age=31536000');
 if(!allowedOrigin(req))return reply(res,403,'origin_not_allowed');
 if(!['GET','HEAD','OPTIONS'].includes(req.method) && ['cross-site','same-site'].includes(req.headers['sec-fetch-site'])) return reply(res,403,'cross_origin_request');
 req.headers['x-konnectivity-secure']=secureRequest(req)?'1':'0';
 const url=new URL(req.url,'http://localhost'),p=url.pathname,admin=adminRequest(req);
 if (p.startsWith('/admin') || p.startsWith('/api/admin/') || p === '/api/settings') res.setHeader('Cache-Control','private, no-store');
 const brandingUpload=admin&&req.method==='PUT'&&/^\/api\/branding\/(logo|favicon)$/.test(p);
 if(Number(req.headers['content-length']||0)>(brandingUpload?BRANDING_MAX_BYTES:262144)&&p.startsWith('/api/'))return reply(res,413,'body_too_large');
 if(p==='/api/admin/session'&&req.method==='POST'&&!isSetupComplete()&&!localSetupRequest(req)&&!equalToken(req.headers['x-setup-token'],process.env.SETUP_TOKEN))return reply(res,403,'Complete initial setup locally before exposing this server');
 if(p==='/api/admin/session'&&req.method==='POST'){const gate=rateLimit(`admin:${requestIp(req)}`,10,15*60*1000);if(!gate.ok){res.setHeader('Retry-After',String(gate.retryAfter));return reply(res,429,'Too many sign-in attempts. Try again later.');}}
 const match=p.match(/^\/r\/([A-Z0-9]{6})$/i);
 if(match&&url.searchParams.has('invite')){const room=getRoom(match[1].toUpperCase());if(!room||!equalToken(url.searchParams.get('invite'),room.inviteToken))return reply(res,403,'invalid_invitation');setCookie(req,res,`kn_invite_${room.code}`,room.inviteToken);url.searchParams.delete('invite');res.writeHead(303,{Location:url.pathname+url.search});res.end();return true;}
 if(p==='/api/room-access'&&req.method==='POST'){
  const gate=rateLimit(`member:${requestIp(req)}`,60,60000);if(!gate.ok)return reply(res,429,'rate_limited');
  try{const body=await smallJson(req),room=getRoom(String(body.code||''));if(!participantAccess(room,body.token))return reply(res,403,'Join and be approved first');setCookie(req,res,`kn_member_${room.code}`,body.token);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return true;}catch{return reply(res,400,'invalid_request');}
 }
 if(p==='/api/room-invite'&&req.method==='GET'){const room=getRoom(String(url.searchParams.get('code')||''));if(!roomAccess(req,room))return reply(res,401,'unauthorized');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({invite:room.inviteToken}));return true;}
 if((p==='/api/rooms'&&req.method==='POST')||p==='/api/rooms/random'){
  if(!isSetupComplete())return reply(res,409,'This server must be set up first.');
  if(!admin){
   const creating=req.method==='POST'&&p==='/api/rooms';
   const gate=rateLimit(`groups:${creating?'create':'discover'}:${requestIp(req)}`,creating?5:30,creating?3600000:60000);
   if(!gate.ok){res.setHeader('Retry-After',String(gate.retryAfter));return reply(res,429,'Too many requests. Try again later.');}
  }
 }
 if(p==='/api/room-manifest'&&!mayJoin(req,getRoom(String(url.searchParams.get('code')||''))))return reply(res,401,'unauthorized');
 if(p==='/api/rooms'&&req.method==='GET'&&!mayRequestJoin(req,getRoom(String(url.searchParams.get('code')||''))))return reply(res,401,'Open the complete invitation link or sign in as host.');
 if(p.startsWith('/audio/')){
  const room=getRoom(String(url.searchParams.get('room')||''));if(!(admin&&!room?.roomScoped)&&!roomAccess(req,room)&&!participantAccess(room,url.searchParams.get('token')||cookieMap(req)[`kn_member_${room?.code}`],{allowReconnecting:true}))return reply(res,401,'Join and be approved before listening');
  const id=p.slice(7).replace(/\.m4a$/,'');if((!admin||room?.roomScoped)&&room&&!([...room.library,...room.queue,...room.history,room.current].filter(Boolean).some(t=>t.videoId===id)))return reply(res,403,'Track is not in this room');
  const memberToken=url.searchParams.get("token")||cookieMap(req)[`kn_member_${room?.code}`];
  const member=room&&[...room.participants.values()].find(p=>equalToken(p.uploadToken,memberToken));
  if(needsYoutubeCookie(room,id,member))return reply(res,409,YOUTUBE_SETUP_MESSAGE);
  const gate=rateLimit(`media:${requestIp(req)}`,180,60000);if(!gate.ok)return reply(res,429,'rate_limited');res.setHeader('Cache-Control','private, no-store');
 }
 if(['/api/gifs/image','/api/gifs','/api/artwork','/api/search','/api/album','/api/lyrics','/api/recommend','/api/link'].includes(p)){
  const code = p === "/api/link" ? url.searchParams.get("room") : null;
  const room = code ? getRoom(code) : null;
  if (code && !roomAccess(req, room)) return reply(res, 401, "Join this room before importing links");
  if (needsYoutubeCookie(room)) return reply(res, 409, YOUTUBE_SETUP_MESSAGE);
  const jar=cookieMap(req),authorized=admin||Object.keys(jar).filter(k=>k.startsWith('kn_member_')).some(k=>roomAccess(req,getRoom(k.slice(10))));if(!authorized)return reply(res,401,'Join an approved room first');
  const gate=p==="/api/gifs/image" ? rateLimit(`gif-preview:${requestIp(req)}`,180,60000) : rateLimit(`api:${requestIp(req)}`,90,60000);if(!gate.ok)return reply(res,429,'rate_limited');
 }
 return false;
}
