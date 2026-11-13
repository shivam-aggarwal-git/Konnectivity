import {cookieMap,equalToken} from './access.mjs';
import {personalCookieStatus,storePersonalCookies,clearPersonalCookies} from './room-credentials.mjs';
import {rateLimit} from './ratelimit.mjs';
export async function handleMemberCookies(req,res,getRoom) {
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(data));};
 const url=new URL(req.url,'http://localhost');const code=String(url.searchParams.get('room')||'');
 const room=getRoom(code);const token=req.headers['x-upload-token']||cookieMap(req)[`kn_member_${code}`];
 const participant=room&&[...room.participants.values()].find(member=>member.status!=='reconnecting'&&equalToken(member.uploadToken,token));
 if(!participant)return reply(403,{error:'Join and be approved before changing personal cookies.'});
 try {
  if(req.method==='POST'){
   if(!rateLimit(`member-cookies:${code}:${participant.mediaIdentity||participant.id}`,8,60000).ok)return reply(429,{error:'Wait a minute before uploading again.'});
   const limit=262144;if(Number(req.headers['content-length'])>limit)return reply(413,{error:'Choose a cookies.txt file up to 256 KB.'});
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)return reply(413,{error:'Choose a cookies.txt file up to 256 KB.'});chunks.push(chunk);}
   if(room.participants.get(participant.id)!==participant || participant.status==='reconnecting')return reply(403,{error:'Room access changed. Rejoin before uploading.'});
   storePersonalCookies(room,participant,Buffer.concat(chunks).toString('utf8'));
  } else if(req.method==='DELETE')clearPersonalCookies(room,participant);
  else if(req.method!=='GET')return reply(405,{error:'Unsupported method'});
  return reply(200,{...personalCookieStatus(room,participant),fallback:'host'});
 } catch(error){return reply(400,{error:error.message || 'Could not update your cookies.'});}
}
