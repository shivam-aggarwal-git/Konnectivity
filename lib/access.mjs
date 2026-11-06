// Private-instance and room capability checks. No credential values are logged.
import {timingSafeEqual} from 'node:crypto';
import os from 'node:os';
import {verifySession,SESSION_COOKIE,isSetupComplete} from './auth.mjs';
import {getPublicUrl} from './publicurl.mjs';
import {rateLimit} from './ratelimit.mjs';
export function equalToken(a,b){if(typeof a!=='string'||typeof b!=='string'||!a||a.length>512||a.length!==b.length)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function cookieMap(req){const out={};for(const part of String(req.headers.cookie||'').slice(0,16384).split(';')){const i=part.indexOf('=');if(i>0){try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));}catch{}}}return out;}
export function adminRequest(req){return verifySession(cookieMap(req)[SESSION_COOKIE]);}
export function participantAccess(room,token){return Boolean(room&&typeof token==='string'&&[...room.participants.values()].some(p=>equalToken(p.uploadToken,token)));}
export function roomAccess(req,room){return Boolean(room&&(adminRequest(req)||participantAccess(room,cookieMap(req)[`kn_member_${room.code}`])));}
export function mayJoin(req,room,ownerToken){return Boolean(room&&(adminRequest(req)||equalToken(ownerToken,room.ownerToken)||equalToken(cookieMap(req)[`kn_invite_${room.code}`],room.inviteToken)||roomAccess(req,room)));}
function loopback(req){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);}
export function localSetupRequest(req){return loopback(req)&&/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(String(req.headers.host||''))&&!req.headers['cf-connecting-ip']&&!req.headers['x-forwarded-for'];}
export function requestIp(req){if(loopback(req))return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'local').split(',')[0].trim().slice(0,80);return req.socket?.remoteAddress||'unknown';}
function origins(){const p=process.env.PORT||'3000';const set=new Set([`http://localhost:${p}`,`http://127.0.0.1:${p}`,`http://[::1]:${p}`]);for(const rows of Object.values(os.networkInterfaces()))for(const n of rows||[])if(n.family==='IPv4')set.add(`http://${n.address}:${p}`);try{const u=getPublicUrl()||process.env.PUBLIC_URL;if(u)set.add(new URL(u).origin);}catch{}return set;}
export function allowedOrigin(req){const allowed=origins();const host=String(req.headers.host||'');if(![...allowed].some(o=>new URL(o).host===host))return false;const origin=req.headers.origin;return !origin||allowed.has(String(origin));}
export function secureRequest(req){return Boolean(req.socket?.encrypted||(loopback(req)&&req.headers['x-forwarded-proto']==='https')||process.env.SECURE_COOKIES==='true');}
function setCookie(req,res,name,value){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureRequest(req)?'; Secure':''}`);}
function reply(res,status,error){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}));return true;}
async function smallJson(req,limit=16384){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>limit)throw Error('body_too_large');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString()||'{}');}
export async function guardRequest(req,res,getRoom){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https://www.youtube.com wss:; media-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
 if(secureRequest(req))res.setHeader('Strict-Transport-Security','max-age=31536000');
 if(!allowedOrigin(req))return reply(res,403,'origin_not_allowed');
 req.headers['x-konnectivity-secure']=secureRequest(req)?'1':'0';
 const url=new URL(req.url,'http://localhost'),p=url.pathname,admin=adminRequest(req);
 if(Number(req.headers['content-length']||0)>262144&&(p.startsWith('/api/')))return reply(res,413,'body_too_large');
 if(p==='/api/admin/session'&&req.method==='POST'&&!isSetupComplete()&&!localSetupRequest(req)&&!equalToken(req.headers['x-setup-token'],process.env.SETUP_TOKEN))return reply(res,403,'Complete initial setup locally before exposing this server');
 if(p==='/api/admin/session'&&req.method==='POST'&&!admin){const gate=rateLimit(`admin:${requestIp(req)}`,10,15*60*1000);if(!gate.ok){res.setHeader('Retry-After',String(gate.retryAfter));return reply(res,429,'Too many sign-in attempts. Try again later.');}}
 const match=p.match(/^\/r\/([A-Z0-9]{6})$/i);
 if(match&&url.searchParams.has('invite')){const room=getRoom(match[1].toUpperCase());if(!room||!equalToken(url.searchParams.get('invite'),room.inviteToken))return reply(res,403,'invalid_invitation');setCookie(req,res,`kn_invite_${room.code}`,room.inviteToken);url.searchParams.delete('invite');res.writeHead(303,{Location:url.pathname+url.search});res.end();return true;}
 if(p==='/api/room-access'&&req.method==='POST'){
  const gate=rateLimit(`member:${requestIp(req)}`,60,60000);if(!gate.ok)return reply(res,429,'rate_limited');
  try{const body=await smallJson(req),room=getRoom(String(body.code||''));if(!participantAccess(room,body.token))return reply(res,403,'Join and be approved first');setCookie(req,res,`kn_member_${room.code}`,body.token);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return true;}catch{return reply(res,400,'invalid_request');}
 }
 if(p==='/api/room-invite'&&req.method==='GET'){const room=getRoom(String(url.searchParams.get('code')||''));if(!roomAccess(req,room))return reply(res,401,'unauthorized');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({invite:room.inviteToken}));return true;}
 if(p==='/api/rooms'&&req.method==='POST'&&!admin)return reply(res,401,'Sign in as the host to create a room.');
 if(p==='/api/room-manifest'&&!mayJoin(req,getRoom(String(url.searchParams.get('code')||''))))return reply(res,401,'unauthorized');
 if(p==='/api/rooms'&&req.method==='GET'&&!mayJoin(req,getRoom(String(url.searchParams.get('code')||''))))return reply(res,401,'Open the complete invitation link or sign in as host.');
 if(p.startsWith('/audio/')){
  const room=getRoom(String(url.searchParams.get('room')||''));if(!admin&&!roomAccess(req,room)&&!participantAccess(room,url.searchParams.get('token')))return reply(res,401,'Join and be approved before listening');
  const id=p.slice(7).replace(/\.m4a$/,'');if(!admin&&room&&!([...room.library,...room.queue,...room.history,room.current].filter(Boolean).some(t=>t.videoId===id)))return reply(res,403,'Track is not in this room');
  const gate=rateLimit(`media:${requestIp(req)}`,180,60000);if(!gate.ok)return reply(res,429,'rate_limited');res.setHeader('Cache-Control','private, no-store');
 }
 if(['/api/search','/api/album','/api/lyrics','/api/recommend','/api/link'].includes(p)){
  const jar=cookieMap(req),authorized=admin||Object.keys(jar).filter(k=>k.startsWith('kn_member_')).some(k=>roomAccess(req,getRoom(k.slice(10))));if(!authorized)return reply(res,401,'Join an approved room first');
  const gate=rateLimit(`api:${requestIp(req)}`,90,60000);if(!gate.ok)return reply(res,429,'rate_limited');
 }
 return false;
}
