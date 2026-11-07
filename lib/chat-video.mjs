import {promises as fs,createReadStream} from 'node:fs';
import path from 'node:path';
import {loadSync,saveNow} from './store.mjs';
import {equalToken} from './access.mjs';
const dir=path.resolve(process.env.DATA_DIR||'./data','chat-videos');
const index=loadSync('chat-videos',{});let pending=Promise.resolve(),active=0;
const LIMIT=50*1024*1024;
export function chatVideo(id,code){const v=index[id];return v?.code===code?{id,url:`/chat-video/${id}`,name:v.name}:null;}
export function videoRange(range,size){
 if(!range)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return false;
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Math.min(size-1,Number(m[2])):size-1):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&start<size?{start,end}:false;
}
export async function handleChatVideo(req,res,getRoom){
 const reply=(status,error)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}));};
 const url=new URL(req.url,'http://localhost'),code=String(req.headers['x-room-code']||url.searchParams.get('room')||''),token=req.headers['x-upload-token']||url.searchParams.get('token');
 const room=getRoom(code),p=room&&[...room.participants.values()].find(p=>p.status!=='reconnecting'&&equalToken(p.uploadToken,token));
 if(!p)return reply(403,'Join this room to share or view videos.');
 if(req.method==='GET'||req.method==='HEAD'){
  const id=url.pathname.slice('/chat-video/'.length),v=index[id];if(!/^[a-f0-9]{32}$/.test(id)||!chatVideo(id,code))return reply(404,'Video not found.');
  try{const file=path.join(dir,`${id}.${v.ext}`),stat=await fs.stat(file),range=videoRange(req.headers.range,stat.size);
   if(range===false){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}
   const start=range?.start||0,end=range?.end??stat.size-1;
   res.writeHead(range?206:200,{'Content-Type':v.mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="video.${v.ext}"`,...(range?{'Content-Range':`bytes ${start}-${end}/${stat.size}`}:{})});
   if(req.method==='HEAD')return res.end();const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
  }catch{return reply(404,'Video not found.');}
 }
 if(req.method!=='POST')return reply(405,'Unsupported method.');if(p.muted)return reply(403,'Chat is muted.');
 if(active>=2)return reply(429,'Two videos are uploading. Try again shortly.');
 const bytes=Number(req.headers['content-length']);if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>LIMIT)return reply(413,'Choose a video up to 50 MB.');
 const quota=Math.max(50,Number(process.env.CHAT_VIDEO_MAX_MB)||1024)*1024*1024;
 if(Object.values(index).reduce((n,v)=>n+v.size,0)+(active+1)*LIMIT>quota)return reply(413,'Video storage is full.');
 active++;let handle,file,id;try{
  const chunks=[];let received=0;for await(const chunk of req){received+=chunk.length;if(received>LIMIT||received>bytes){reply(413,'Video exceeds its size limit.');return;}chunks.push(chunk);}
  if(received!==bytes)return reply(400,'Incomplete upload.');const b=Buffer.concat(chunks);
  const mp4=b.length>12&&b.subarray(4,8).toString()==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V ','MSNV','qt  '].includes(b.subarray(8,12).toString());
  const webm=b.length>8&&b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))&&b.subarray(0,4096).includes(Buffer.from('webm'));
  if(!mp4&&!webm)return reply(415,'Use an MP4 or WebM video.');
  // Recheck membership after reading the body: a removed member cannot finish an upload.
  if(!room.participants.has(p.id)||p.status==='reconnecting'||p.muted)return reply(403,'Room access ended.');
  let name;try{name=decodeURIComponent(String(req.headers['x-file-name']||'Shared video')).slice(0,160);}catch{return reply(400,'Invalid filename.');}
  id=crypto.randomUUID().replaceAll('-','');const ext=mp4?'mp4':'webm';await fs.mkdir(dir,{recursive:true,mode:0o700});file=path.join(dir,`${id}.${ext}`);handle=await fs.open(file,'wx',0o600);await handle.writeFile(b);await handle.close();handle=null;
  index[id]={code,name,ext,mime:mp4?'video/mp4':'video/webm',size:received};const writing=pending.then(()=>saveNow('chat-videos',index));pending=writing.catch(()=>{});await writing;
  res.writeHead(201,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({video:chatVideo(id,code)}));
 }catch{if(id)delete index[id];if(handle)await handle.close().catch(()=>{});if(file)await fs.unlink(file).catch(()=>{});if(!res.headersSent)reply(400,'Could not upload this video.');}finally{active--;}
}
