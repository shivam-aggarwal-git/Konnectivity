import { canViewMedia, uploadAudience } from "./media-audience.mjs";
import {cookieMap,equalToken} from "./access.mjs";
import {allowed} from './permissions.mjs';
import {isHeic,convertHeic} from './heic.mjs';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { loadSync, saveNow } from './store.mjs';
const directory = path.resolve(process.env.DATA_DIR || './data', 'chat-images');
const index = globalThis.__KN_CHAT_IMAGES ??= loadSync('chat-images', {});
const imageWrites=globalThis.__KN_CHAT_IMAGE_WRITES ??= {pending:Promise.resolve()};
function persistImages(){const write=imageWrites.pending.then(()=>saveNow('chat-images',index));imageWrites.pending=write.catch(()=>{});return write;}
let activeUploads = 0;
export function imageAudience(id) { return index[id]?.audience; }
export function chatImage(id, code, participant) { const image = index[id]; return (image?.code === code || image?.rooms?.includes(code)) && canViewMedia(image?.audience, participant) ? { id, url: `/chat-media/${id}`, name: image.name } : null; }
/** Grant only an inherited background reference, never the rest of a room's photos. */
export function inheritBackground(id,fromCode,toCode){
 const record=index[id];if(!record||!chatImage(id,fromCode))return false;
 if(record.code!==toCode&&!record.rooms?.includes(toCode)){record.rooms=[...(record.rooms||[]),toCode];void persistImages().catch(()=>{});}
 return true;
}
function extension(buffer) {
 if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['png','image/png'];
 if (buffer[0]===255 && buffer[1]===216 && buffer[2]===255) return ['jpg','image/jpeg'];
 if (/^GIF8[79]a/.test(buffer.subarray(0,6).toString('ascii'))) return ['gif','image/gif'];
 if(buffer.subarray(0,4).toString()==='RIFF' && buffer.subarray(8,12).toString()==='WEBP') return ['webp','image/webp'];
 return null;
}
export async function handleChatMedia(req,res,getRoom) {
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const url=new URL(req.url,'http://localhost'), code=String(req.headers['x-room-code']||url.searchParams.get('room')||''), token=req.headers['x-upload-token'] || (req.method==='GET' ? cookieMap(req)[`kn_member_${code}`] || url.searchParams.get('token') : null);
 const room=getRoom(code), participant=room && [...room.participants.values()].find(p=>equalToken(p.uploadToken,token) && p.status!=='reconnecting');
 if(!token || !participant)return reply(403,{error:'Join this room to share or view images'});
 if(req.method==='POST'&&!allowed(room,participant,'photos'))return reply(403,{error:'The host disabled photo sharing.'});
 if(req.method==='GET') {
  const id=url.pathname.replace('/chat-media/',''), image=chatImage(id,code,participant);
  if(!image || !/^[a-f0-9]{32}$/.test(id))return reply(404,{error:'Image not found'});
  try {const record=index[id], file=path.join(directory,`${id}.${record.ext}`), stat=await fs.stat(file);res.writeHead(200,{'Content-Type':record.mime,'Content-Length':stat.size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="photo.${record.ext}"`});createReadStream(file).pipe(res);}catch{return reply(404,{error:'Image not found'});}return;
 }
 if(req.method!=='POST')return reply(405,{error:'Unsupported method'});
 if(participant.muted)return reply(403,{error:'Chat is muted'});
 let audience;
 try { audience = uploadAudience(room, participant, req.headers['x-media-recipients']); }
 catch (error) { return reply(403, {error:error.message}); }
 const limit=8*1024*1024;if(Number(req.headers['content-length'])>limit)return reply(413,{error:'Images must be 8 MB or smaller'});
 if(activeUploads>=4)return reply(429,{error:"Images are processing. Try again shortly."});
 activeUploads++;
 const quota=Math.max(8,Number(process.env.CHAT_MEDIA_MAX_MB||512))*1024*1024;
 let used=0;try{for(const name of await fs.readdir(directory)){const st=await fs.stat(path.join(directory,name));used+=st.size;}}catch{}
 if(used+activeUploads*limit>quota){activeUploads--;return reply(413,{error:'Chat image storage limit reached'});}
 let name;try{name=decodeURIComponent(String(req.headers['x-file-name']||'Photo')).slice(0,160);}catch{activeUploads--;return reply(400,{error:'Invalid filename'});}
 const chunks=[];let bytes=0;
 try {
  for await(const chunk of req){bytes+=chunk.length;if(bytes>limit){reply(413,{error:'Images must be 8 MB or smaller'});return;}chunks.push(chunk);}
  let content=Buffer.concat(chunks);if(isHeic(content))content=await convertHeic(content);if(content.length>limit)return reply(413,{error:"Converted image must be 8 MB or smaller"});const format=extension(content);if(!format)return reply(415,{error:'Choose a JPEG, PNG, GIF, WebP or HEIC image'});
  if (room.participants.get(participant.id) !== participant || participant.status === 'reconnecting' || participant.muted || !allowed(room,participant,'photos') || (audience && !allowed(room,participant,'privateMedia'))) return reply(403,{error:'Room access changed during upload.'});
  const id=crypto.randomUUID().replaceAll('-',''), [ext,mime]=format;await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,`${id}.${ext}`),content,{flag:'wx'});
  index[id]={code,name,ext,mime,audience};await persistImages();
  reply(201,{image:chatImage(id,code,participant)});
 }catch(error){if(!res.headersSent)reply(400,{error:isHeic(Buffer.concat(chunks))?'Could not convert this HEIC photo. Try a smaller photo or export as JPEG.':'Could not upload this image'});}finally{activeUploads--;}
}
