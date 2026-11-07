import {checkTurnBudget} from './turn-budget.mjs';
// Room collaboration is separate from playback. Only seated, connected members
// can read/mutate it; server-generated identities never come from event payloads.
import {loadSync,saveDebounced} from './store.mjs';
import {createHmac} from 'node:crypto';
import {secureRequest,localSetupRequest} from './access.mjs';
export const SOCIAL_EVENTS=['social:get','comment:add','plan:create','plan:rsvp','plan:suggest','plan:close','poll:create','poll:vote','poll:close','poll:delete','call:join','call:leave','call:signal','call:decline','call:renew'];
const saved=loadSync('room-social',{});
const calls=new Map();
const invitations=new Map();
const issuedCredentials=new Map();let budgetWatch=null,budgetChecking=false;
async function revokeCredentials(id){const entries=issuedCredentials.get(id)||[];issuedCredentials.delete(id);await Promise.allSettled(entries.filter(x=>x.until>Date.now()).map(x=>fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(process.env.CALL_CF_KEY_ID)}/credentials/${encodeURIComponent(x.username)}/revoke`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CALL_CF_API_TOKEN}`},signal:AbortSignal.timeout(8000)})));}
export async function enforceCallBudget(io){
 if(!calls.size||budgetChecking||!(process.env.CALL_CF_KEY_ID&&process.env.CALL_CF_API_TOKEN))return;
 budgetChecking=true;
 try{await checkTurnBudget();}
 catch(error){
  const ids=[...calls.values()].flatMap(c=>[...c.keys()]);
  for(const id of ids)io.to(id).emit('call:ended',{message:error.message});
  for(const code of calls.keys()){calls.delete(code);const i=invitations.get(code);if(i)clearTimeout(i.timer);invitations.delete(code);io.to(code).emit('call:state',{members:[],max:6,invitation:null});}
  await Promise.allSettled(ids.map(revokeCredentials));
 }finally{budgetChecking=false;}
}
function watchBudget(io){if(budgetWatch)return;budgetWatch=setInterval(()=>void enforceCallBudget(io),30000);budgetWatch.unref?.();}

export function clearRoomSocial(code){delete saved[code];for(const id of calls.get(code)?.keys()||[])void revokeCredentials(id);calls.delete(code);const invite=invitations.get(code);if(invite)clearTimeout(invite.timer);invitations.delete(code);saveDebounced("room-social",saved);}
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export function socialSnapshot(room,member){
 const state=saved[room.code]||{plans:[],polls:[]};
 return {notifications:state.notifications||[],comments:state.comments||[],plans:state.plans.map(({responses,...p})=>({...p,canClose:Boolean(member?.isHost||p.creatorId===member?.socialId),responses:Object.values(responses),myResponse:responses[member?.socialId]?.choice||null})),polls:state.polls.map(({ballots,...p})=>({...p,canClose:Boolean(member?.isHost||p.creatorId===member?.socialId),counts:p.options.map((_,i)=>Object.values(ballots).filter(v=>v===i).length),total:Object.keys(ballots).length,myVote:ballots[member?.socialId]??null})),call:callSnapshot(room)};
}
function callSnapshot(room){return {members:[...(calls.get(room.code)?.values()||[])].map(m=>({id:m.id,nick:m.nick})),max:6,invitation:(()=>{const i=invitations.get(room.code);return i&&i.expiresAt>Date.now()?{id:i.id,from:i.from,nick:i.nick,video:i.video,expiresAt:i.expiresAt}:null;})()};}
function broadcast(io,room){for(const p of room.participants.values())if(p.status!=='reconnecting')io.to(p.id).emit('social:state',socialSnapshot(room,p));}
function callBroadcast(io,room){io.to(room.code).emit('call:state',callSnapshot(room));}
export function leaveRoomCall(io,room,id){const c=calls.get(room.code);if(c?.delete(id)){void revokeCredentials(id);if(!c.size)calls.delete(room.code);const invite=invitations.get(room.code);if(invite?.from===id){clearTimeout(invite.timer);invitations.delete(room.code);}callBroadcast(io,room);}}
async function iceConfig(socket){
 const usage=await checkTurnBudget();
 if(process.env.CALL_CF_KEY_ID&&process.env.CALL_CF_API_TOKEN){
  if(Date.now()-(socket.data.lastTurnIssue||0)<30000)throw Error('Please wait 30 seconds before requesting relay credentials again.');socket.data.lastTurnIssue=Date.now();
  const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(process.env.CALL_CF_KEY_ID)}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CALL_CF_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:300}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('The TURN provider rejected its configuration. Ask the host to check the server credentials.');
  const data=await response.json();if(!Array.isArray(data.iceServers)||!data.iceServers.some(x=>x.credential))throw Error('The TURN provider did not return usable credentials.');
  const existing=(issuedCredentials.get(socket.id)||[]).filter(x=>x.until>Date.now());for(const entry of data.iceServers)if(entry.username&&entry.credential)existing.push({username:entry.username,until:Date.now()+310000});issuedCredentials.set(socket.id,existing);
  return {iceServers:data.iceServers.map(x=>({...x,urls:(Array.isArray(x.urls)?x.urls:[x.urls]).filter(u=>typeof u==='string'&&!/:53(?:\?|$)/.test(u))})),provider:'cloudflare',relayAvailable:true,budget:usage?{usedGB:usage.usedBytes/1e9,limitGB:750,checkedAt:usage.checkedAt}:null,iceTransportPolicy:process.env.CALL_RELAY_ONLY==='true'?'relay':'all'};
 }

 const iceServers=[{urls:process.env.CALL_STUN_URL||'stun:stun.cloudflare.com:3478'}];
 if(process.env.CALL_TURN_URL&&process.env.CALL_TURN_SECRET){const username=`${Math.floor(Date.now()/1000)+3600}:${socket.id}`;iceServers.push({urls:process.env.CALL_TURN_URL.split(',').map(x=>x.trim()),username,credential:createHmac('sha1',process.env.CALL_TURN_SECRET).update(username).digest('base64')});}
 iceServers.push({urls:'stun:stun.l.google.com:19302'});
 return {iceServers,provider:process.env.CALL_TURN_URL&&process.env.CALL_TURN_SECRET?'coturn':'direct',relayAvailable:Boolean(process.env.CALL_TURN_URL&&process.env.CALL_TURN_SECRET),iceTransportPolicy:process.env.CALL_RELAY_ONLY==='true'?'relay':'all'};
}
export function registerSocial(io,socket,inRoom){
 watchBudget(io);
 const member=()=>{const r=inRoom(),p=r?.participants.get(socket.id);return r&&p&&p.status!=='reconnecting'?{r,p}:null;};
 for(const event of SOCIAL_EVENTS)socket.on(event,async(data={},ack)=>{
  const reply=(v)=>{if(typeof ack==='function')ack(v);};
  const seat=member();if(!seat)return reply({error:'Join and be approved in this room first.'});
  if(!data||typeof data!=='object'||Array.isArray(data))return reply({error:'Invalid request.'});
  const {r,p}=seat;p.socialId||=crypto.randomUUID();
  if(event==='social:get')return reply({ok:true,...socialSnapshot(r,p)});
  if(event==='call:renew'){if(!calls.get(r.code)?.has(socket.id))return reply({error:'You are not in a call.'});try{return reply({ok:true,...await iceConfig(socket)});}catch(e){leaveRoomCall(io,r,socket.id);return reply({error:e.message});}}
  if(event==='call:decline'){const invite=invitations.get(r.code);if(invite?.id===data.id&&invite.from!==socket.id)io.to(invite.from).emit('call:declined',{nick:p.nick});return reply({ok:true});}
  if(event==='call:leave'){socket.data.callAttempt=(socket.data.callAttempt||0)+1;leaveRoomCall(io,r,socket.id);return reply({ok:true});}
  if(event==='call:join'){
   if(process.env.CALL_RELAY_ONLY==='true'&&!((process.env.CALL_TURN_URL&&process.env.CALL_TURN_SECRET)||(process.env.CALL_CF_KEY_ID&&process.env.CALL_CF_API_TOKEN)))return reply({error:'The host must configure TURN before relay-only calls can work.'});
   if(!secureRequest(socket.request)&&!localSetupRequest(socket.request))return reply({error:'Calls require HTTPS or localhost.'});
   if(calls.get(r.code)?.size>=6&&!calls.get(r.code)?.has(socket.id))return reply({error:'This small-group call is full (6 people).'});
   const attempt=(socket.data.callAttempt||0)+1;socket.data.callAttempt=attempt;
   let rtc;try{rtc=await iceConfig(socket);}catch(e){return reply({error:e.message||'TURN configuration is unavailable.'});}if(!socket.connected||!member()||socket.data.callAttempt!==attempt){void revokeCredentials(socket.id);return reply({error:'Room connection ended.'});}
   let c=calls.get(r.code);if(!c){c=new Map();calls.set(r.code,c);}
   if(c.size>=6&&!c.has(socket.id))return reply({error:'This small-group call is full (6 people).'});
   const first=c.size===0;
   c.set(socket.id,{id:socket.id,nick:p.nick});
   if(first){const invite={id:crypto.randomUUID(),from:socket.id,nick:p.nick,video:data.video===true,expiresAt:Date.now()+40000,timer:null};invite.timer=setTimeout(()=>{if(invitations.get(r.code)?.id!==invite.id)return;invitations.delete(r.code);if(calls.get(r.code)?.size===1&&calls.get(r.code)?.has(invite.from)){calls.delete(r.code);io.to(invite.from).emit('call:ended',{message:'No one answered the call.'});}callBroadcast(io,r);},40000);invite.timer.unref?.();invitations.set(r.code,invite);}
   callBroadcast(io,r);return reply({ok:true,...callSnapshot(r),...rtc});
  }
  if(event==='call:signal'){
   const c=calls.get(r.code),target=typeof data.to==='string'&&c?.get(data.to);
   if(!c?.has(socket.id)||!target||!r.participants.has(target.id)||r.participants.get(target.id).status==='reconnecting')return reply({error:'Both people must be in this room call.'});
   const signal=data.signal;
   if(!signal||typeof signal!=='object'||Array.isArray(signal)||JSON.stringify(signal).length>32000)return reply({error:'Invalid call signal.'});
   if(signal.description){const d=signal.description;if(!['offer','answer'].includes(d.type)||typeof d.sdp!=='string'||d.sdp.length>30000)return reply({error:'Invalid session description.'});}
   else if(signal.candidate){if(typeof signal.candidate.candidate!=='string'||signal.candidate.candidate.length>4096)return reply({error:'Invalid ICE candidate.'});}
   else return reply({error:'Unsupported call signal.'});
   io.to(target.id).emit('call:signal',{from:socket.id,signal});return reply({ok:true});
  }
  if(p.muted)return reply({error:'The host has muted your chat.'});
  const state=saved[r.code]??={plans:[],polls:[]};
  if(event==='comment:add'){
   const text=clean(data.text,500),trackId=clean(data.trackId,64);
   if(!text)return reply({error:'Write a comment first.'});
   if(![r.current,...r.queue,...(r.library||[]),...(r.history||[])].some(t=>t?.videoId===trackId))return reply({error:'Choose a song in this room.'});
   if(Date.now()-(p.lastComment||0)<1500)return reply({error:'Please wait a moment before commenting again.'});
   p.lastComment=Date.now();state.comments||=[];
   if(state.comments.filter(c=>c.trackId===trackId).length>=100)return reply({error:'This song has reached its comment limit.'});
   state.comments.push({id:crypto.randomUUID(),trackId,text,nick:p.nick,at:Date.now()});state.comments=state.comments.slice(-500);saveDebounced('room-social',saved);broadcast(io,r);return reply({ok:true});
  }
  const owns=item=>p.isHost||item.creatorId===p.socialId;
  if(event==='plan:create'){
   const title=clean(data.title,100),venue=clean(data.venue,200),when=clean(data.when,40),budget=Number(data.budget);
   if(!title||!venue||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\+05:30$/.test(when)||!Number.isFinite(Date.parse(when))||!Number.isFinite(budget)||budget<0||budget>1000000)return reply({error:'Add a title, venue, date/time (IST), and a valid INR budget.'});
   if(state.plans.filter(x=>!x.closed).length>=20)return reply({error:'Close an existing plan first (20 active plans maximum).'});
   state.plans.push({id:crypto.randomUUID(),creatorId:p.socialId,by:p.nick,title,venue,when,budget:Math.round(budget),createdAt:Date.now(),closed:false,responses:{},suggestions:[]});
  }else if(event==='poll:create'){
   const question=clean(data.question,150),options=Array.isArray(data.options)?data.options.map(x=>clean(x,80)).filter(Boolean):[];
   if(!question||options.length<2||options.length>6||new Set(options.map(x=>x.toLowerCase())).size!==options.length)return reply({error:'Add a question and 2–6 different options.'});
   if(state.polls.filter(x=>!x.closed).length>=20)return reply({error:'Close an existing poll first (20 active polls maximum).'});
   state.polls.push({id:crypto.randomUUID(),creatorId:p.socialId,by:p.nick,question,options,ballots:{},createdAt:Date.now(),closed:false});
  }else if(event.startsWith('plan:')){
   const plan=state.plans.find(x=>x.id===data.id);if(!plan)return reply({error:'Plan not found.'});
   if(plan.closed)return reply({error:'This plan is closed.'});
   if(event==='plan:close'){if(!owns(plan))return reply({error:'Only the creator or host can close this plan.'});plan.closed=true;}
   else if(event==='plan:rsvp'){if(!['in','maybe','out'].includes(data.choice))return reply({error:'Choose in, maybe or out.'});plan.responses[p.socialId]={nick:p.nick,choice:data.choice};}
   else if(event==='plan:suggest'){const text=clean(data.text,300);if(!text)return reply({error:'Write your suggestion first.'});if(plan.suggestions.length>=50)return reply({error:'Suggestion limit reached.'});plan.suggestions.push({id:crypto.randomUUID(),nick:p.nick,text});}
  }else if(event.startsWith('poll:')){
   const poll=state.polls.find(x=>x.id===data.id);if(!poll)return reply({error:'Poll not found.'});if(event==='poll:delete'){if(!owns(poll))return reply({error:'Only the creator or host can delete this poll.'});state.polls=state.polls.filter(x=>x.id!==poll.id);saveDebounced('room-social',saved);broadcast(io,r);return reply({ok:true});}if(poll.closed)return reply({error:'This poll is closed.'});
   if(event==='poll:close'){if(!owns(poll))return reply({error:'Only the creator or host can close this poll.'});poll.closed=true;}
   else{if(!Number.isInteger(data.option)||data.option<0||data.option>=poll.options.length)return reply({error:'Choose a valid option.'});poll.ballots[p.socialId]=data.option;}
  }
  const item=event.startsWith('poll:')?(state.polls.find(x=>x.id===data.id)||state.polls.at(-1)):(state.plans.find(x=>x.id===data.id)||state.plans.at(-1));
  const labels={'poll:create':'started a poll','poll:vote':'voted in a poll','poll:close':'closed a poll','plan:create':'created a plan','plan:rsvp':'responded to a plan','plan:suggest':'suggested an idea','plan:close':'closed a plan'};
  if(labels[event]){const notification={id:crypto.randomUUID(),kind:event.startsWith('poll:')?'polls':'plans',text:`${p.nick} ${labels[event]}`,detail:item?.question||item?.title||'',at:Date.now()};state.notifications||=[];state.notifications.push(notification);state.notifications=state.notifications.slice(-60);for(const participant of r.participants.values())if(participant.status!=='reconnecting')io.to(participant.id).emit('social:notification',notification);}
  state.plans=state.plans.slice(-60);state.polls=state.polls.slice(-60);saveDebounced('room-social',saved);broadcast(io,r);reply({ok:true});
 });
 socket.on('disconnect',()=>{const r=inRoom();if(r)leaveRoomCall(io,r,socket.id);});
}
