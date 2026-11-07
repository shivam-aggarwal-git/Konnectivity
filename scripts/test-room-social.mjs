// Real Socket.io and HTTP regression tests, isolated from personal rooms/media.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
const root=mkdtempSync(path.join(tmpdir(),'kn-social-'));process.env.DATA_DIR=path.join(root,'data');process.env.CACHE_DIR=path.join(root,'cache');process.env.YTDLP_AUTO_UPDATE='false';mkdirSync(process.env.DATA_DIR);mkdirSync(process.env.CACHE_DIR);
const {createRoom,getRoom,registerRoomHandlers}=await import('../lib/rooms.mjs');
const {guardRequest,allowedOrigin,mayJoin}=await import('../lib/access.mjs');
const {enforceCallBudget}=await import('../lib/social.mjs');
const {handleChatVideo,videoRange}=await import('../lib/chat-video.mjs');
const room=createRoom('Room social fixture',true),other=createRoom('Other room',false),sockets=[];
const http=createServer(async(req,res)=>{try{if(await guardRequest(req,res,getRoom))return;if(req.url.startsWith('/chat-video'))return await handleChatVideo(req,res,getRoom);res.writeHead(200);res.end('ok');}catch{res.writeHead(400);res.end();}});
const io=new Server(http,{maxHttpBufferSize:512*1024,allowRequest:(req,done)=>done(null,allowedOrigin(req))});io.use((s,next)=>mayJoin(s.request,getRoom(s.handshake.auth.code),s.handshake.auth.ownerToken)?next():next(Error('unauthorized')));registerRoomHandlers(io,{authorizeJoin:(s,r,t)=>mayJoin(s.request,r,t)});
await new Promise(r=>http.listen(0,'127.0.0.1',r));process.env.PORT=String(http.address().port);const base=`http://127.0.0.1:${process.env.PORT}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function event(s,name){return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Timeout: '+name)),3000);s.once(name,v=>{clearTimeout(t);resolve(v);});});}
function request(s,name,data={}){return new Promise((resolve,reject)=>s.timeout(3000).emit(name,data,(e,r)=>e?reject(Error(name+": "+e.message)):resolve(r)));}
async function client(r,nick,host=false){const cookie=host?'':`kn_invite_${r.code}=${r.inviteToken}`;const s=connect(base,{transports:['websocket'],extraHeaders:{Cookie:cookie},auth:{code:r.code,ownerToken:host?r.ownerToken:null},reconnection:false});sockets.push(s);await event(s,'connect');const ready=event(s,r.inviteOnly&&!host?'join:pending':'room:state');s.emit('join',{code:r.code,nick,ownerToken:host?r.ownerToken:null});return {s,state:await ready};}
try{
 const host=await client(room,'Host',true),pending=await client(room,'Guest');
 assert.match((await request(pending.s,'social:get')).error,/approved/);assert.match((await request(pending.s,'call:join')).error,/approved/);
 const ready=event(pending.s,'room:state');host.s.emit('host:approve',{id:pending.s.id});const guestState=await ready,guest=pending.s;
 const cross=await client(other,'Other host',true);
 assert.equal((await request(host.s,'plan:create',{title:'Party',venue:'Metro gate 2',when:'2026-12-01T18:00:00+05:30',budget:350})).ok,true);
 let state=await request(guest,'social:get'),plan=state.plans[0];assert.equal(plan.budget,350);assert.equal((await request(cross.s,'social:get')).plans.length,0);
 await request(guest,'plan:rsvp',{id:plan.id,choice:'in'});await request(guest,'plan:rsvp',{id:plan.id,choice:'maybe'});state=await request(guest,'social:get');assert.equal(state.plans[0].responses.length,1);assert.equal(state.plans[0].myResponse,'maybe');
 assert.ok((await request(guest,'plan:close',{id:plan.id})).error);assert.ok((await request(host.s,'plan:create',{title:'bad',venue:'X',when:'bad',budget:-1})).error);
 await request(guest,'plan:suggest',{id:plan.id,text:'Potluck?'});state=await request(host.s,'social:get');assert.equal(state.plans[0].suggestions[0].text,'Potluck?');
 const pollNotice=event(guest,'social:notification');await request(host.s,'poll:create',{question:'Party kab?',options:['Saturday','Sunday']});assert.match((await pollNotice).text,/started a poll/);state=await request(guest,'social:get');const poll=state.polls[0];
 await request(guest,'poll:vote',{id:poll.id,option:0});await request(guest,'poll:vote',{id:poll.id,option:1});state=await request(guest,'social:get');assert.deepEqual(state.polls[0].counts,[0,1]);assert.equal(state.polls[0].total,1);assert.ok((await request(guest,'poll:vote',{id:poll.id,option:50})).error);assert.ok((await request(guest,'poll:close',{id:poll.id})).error);
 room.participants.get(guest.id).muted=true;assert.ok((await request(guest,'poll:vote',{id:poll.id,option:0})).error);room.participants.get(guest.id).muted=false;
 await request(host.s,'poll:close',{id:poll.id});assert.ok((await request(guest,'poll:vote',{id:poll.id,option:0})).error);assert.ok((await request(guest,'poll:delete',{id:poll.id})).error);assert.equal((await request(host.s,'poll:delete',{id:poll.id})).ok,true);assert.equal((await request(guest,'social:get')).polls.length,0);
 // Call admission, explicit consent, cross-room signaling, departures and removal.
 assert.ok((await request(host.s,'call:signal',{to:guest.id,signal:{description:{type:'offer',sdp:'x'}}})).error);
 const hc=await request(host.s,'call:join',{video:true});assert.equal(hc.ok,true);assert.equal(hc.invitation.video,true);assert.equal(hc.invitation.nick,'Host');const decline=event(host.s,'call:declined');await request(guest,'call:decline',{id:hc.invitation.id});assert.equal((await decline).nick,'Guest');assert.equal(hc.members.length,1);assert.equal(hc.iceServers[0].urls.startsWith('stun:'),true);
 await request(guest,'call:join');await request(cross.s,'call:join');
 const crossRequest=io.sockets.sockets.get(cross.s.id).request;crossRequest.headers['x-forwarded-for']='203.0.113.99';await request(cross.s,'call:leave');assert.match((await request(cross.s,'call:join')).error,/HTTPS/);delete crossRequest.headers['x-forwarded-for'];await request(cross.s,'call:join');
 const extra=[];for(let n=0;n<5;n++){const c=await client(other,'Caller '+n);extra.push(c.s);assert.equal((await request(c.s,'call:join')).ok,true);}const overflow=await client(other,'Overflow');assert.match((await request(overflow.s,'call:join')).error,/full/);for(const s of extra)await request(s,'call:leave');
 
 assert.ok((await request(host.s,'call:signal',{to:cross.s.id,signal:{description:{type:'offer',sdp:'x'}}})).error);
 const got=event(guest,'call:signal');assert.equal((await request(host.s,'call:signal',{to:guest.id,signal:{description:{type:'offer',sdp:'fixture'}}})).ok,true);assert.equal((await got).from,host.s.id);
 await request(guest,'call:leave');assert.ok((await request(host.s,'call:signal',{to:guest.id,signal:{description:{type:'offer',sdp:'x'}}})).error);
 process.env.CALL_TURN_URL='turn:relay.example:3478';process.env.CALL_TURN_SECRET='synthetic-test-secret';const config=await request(guest,'call:join');assert.equal(config.relayAvailable,true);assert.ok(config.iceServers[1].username.endsWith(':'+guest.id));assert.ok(config.iceServers[1].credential);
 // Locations are range-checked and emitted only to admitted room members.
 assert.ok((await request(guest,'chat:send',{location:{lat:999,lng:0}})).error);const message=event(host.s,'chat:new');await request(guest,'chat:send',{text:'Meet here',location:{lat:28.61,lng:77.2,label:'Metro'}});assert.equal((await message).location.label,'Metro');
 // Authenticated video upload, isolated access, exact and suffix ranges.
 const body=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(60,1)]),headers={'x-room-code':room.code,'x-upload-token':guestState.uploadToken,'x-file-name':encodeURIComponent('Test.mp4')};
 assert.equal((await fetch(base+'/chat-video',{method:'POST',body})).status,403);
 let response=await fetch(base+'/chat-video',{method:'POST',headers,body});assert.equal(response.status,201);const video=(await response.json()).video;
 const query=`?room=${room.code}&token=${guestState.uploadToken}`;
 response=await fetch(base+video.url+query,{headers:{Range:'bytes=5-14'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,10);assert.equal(response.headers.get('content-range'),`bytes 5-14/${body.length}`);
 response=await fetch(base+video.url+query,{headers:{Range:'bytes=-4'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,4);
 assert.equal((await fetch(base+video.url+query,{headers:{Range:'bytes=999-'}})).status,416);
 assert.equal((await fetch(base+video.url+`?room=${other.code}&token=${cross.state.uploadToken}`)).status,404);
 assert.equal((await fetch(base+'/chat-video',{method:'POST',headers,body:'not a video'})).status,415);
 assert.equal(videoRange('bytes=0-1,4-5',100),false);assert.equal(videoRange('bytes=-0',100),false);
 const vm=event(host.s,'chat:new');await request(guest,'chat:send',{videoId:video.id,text:'Look!'});assert.equal((await vm).video.id,video.id);assert.ok((await request(cross.s,'chat:send',{videoId:video.id})).error);
 const floating=event(host.s,'player:message');assert.equal((await request(guest,'player:message',{text:'I miss you',emoji:'❤️'})).ok,true);const messageData=await floating;assert.equal(messageData.text,'I miss you');assert.equal(messageData.duration,15000);assert.ok(messageData.sentAt);const cleared=event(host.s,'player:message');await request(guest,'player:message',{clear:true});assert.equal(await cleared,null);room.participants.get(guest.id).lastPlayerMessage=0;await request(guest,'player:message',{text:'Persistent message',emoji:'💕',duration:null});assert.equal(room.playerMessage.duration,null);await wait(500);assert.equal(JSON.parse(readFileSync(path.join(process.env.DATA_DIR,'rooms.json'),'utf8'))[room.code].playerMessage.duration,null);room.participants.get(guest.id).lastPlayerMessage=0;await request(guest,'player:message',{text:'Timed message',emoji:'❤️',duration:30000});assert.equal(room.playerMessage.duration,30000);assert.ok((await request(guest,'player:message',{text:'Invalid',emoji:'❤️',duration:1})).error);assert.ok((await request(guest,'player:message',{text:'Again',emoji:'❤️'})).error);assert.ok((await request(cross.s,'room:policy',{flushOnHostLeave:true})).ok);assert.ok((await request(guest,'room:policy',{flushOnHostLeave:true})).error);
 room.current={videoId:'fixtureSong',title:'Comments fixture'};const commentState=event(host.s,'social:state');assert.equal((await request(guest,'comment:add',{trackId:'fixtureSong',text:'Love this song'})).ok,true);assert.equal((await commentState).comments.at(-1).text,'Love this song');assert.equal((await request(cross.s,'social:get')).comments.length,0);assert.ok((await request(cross.s,'comment:add',{trackId:'fixtureSong',text:'No access'})).error);room.participants.get(guest.id).muted=true;assert.ok((await request(guest,'comment:add',{trackId:'fixtureSong',text:'Muted'})).error);room.participants.get(guest.id).muted=false;assert.ok((await request(guest,'comment:add',{trackId:'fixtureSong',text:'Too fast'})).error);assert.ok((await request(host.s,'social:get')).notifications.some(n=>n.kind==='polls'));
 const kicked=event(guest,'kicked');host.s.emit('host:kick',{id:guest.id});await kicked;await wait(80);assert.equal((await request(host.s,'social:get')).call.members.some(p=>p.id===guestState.you),false);
 assert.equal((await fetch(base+video.url+query)).status,403);
 await wait(550);assert.ok(readFileSync(path.join(process.env.DATA_DIR,'room-social.json'),'utf8').includes('Party kab?'));
 const policy=await fetch(base);assert.match(policy.headers.get('permissions-policy'),/camera=\(self\)/);
 const originalFetch=globalThis.fetch;
 process.env.CALL_CF_KEY_ID='fixture-key';process.env.CALL_CF_API_TOKEN='fixture-token';process.env.CALL_CF_ACCOUNT_ID='b'.repeat(32);
 globalThis.fetch=async()=>({ok:true,json:async()=>({data:{viewer:{accounts:[{callsTurnUsageAdaptiveGroups:[{sum:{egressBytes:750000000000}}]}]}}})});
 const cutoff=event(host.s,'call:ended');await enforceCallBudget(io);assert.match((await cutoff).message,/750 GB/);assert.equal((await request(host.s,'social:get')).call.members.length,0);assert.match((await request(host.s,'call:join')).error,/750 GB/);
 globalThis.fetch=originalFetch;delete process.env.CALL_CF_KEY_ID;delete process.env.CALL_CF_API_TOKEN;delete process.env.CALL_CF_ACCOUNT_ID;
 assert.ok((await request(host.s,'room:policy',{flushOnHostLeave:false})).error);const ended=event(host.s,'room:ended');await request(host.s,'room:leave');await ended;assert.equal(getRoom(room.code),undefined);assert.equal(mayJoin({headers:{cookie:`kn_invite_${room.code}=${room.inviteToken}`}},getRoom(room.code)),false);const fresh=createRoom('Fresh room',false);assert.notEqual(fresh.code,room.code);assert.notEqual(fresh.inviteToken,room.inviteToken);const freshHost=await client(fresh,'Fresh host',true);const freshGuest=await client(fresh,'Fresh guest');const disconnectedEnd=event(freshGuest.s,'room:ended');freshHost.s.disconnect();await disconnectedEnd;assert.equal(getRoom(fresh.code),undefined);
 console.log('PASS: live plans, RSVP changes, suggestions, INR/IST validation, poll vote changes/closure, muted/pending/outsider isolation, room-only call consent/signaling/removal, short-lived TURN credentials, location validation, private video upload/ranges/access revocation and collaboration persistence.');
}finally{for(const s of sockets)s.disconnect();await new Promise(r=>io.close(r));http.close();await wait(500);rmSync(root,{recursive:true,force:true});}
process.exit(0);
