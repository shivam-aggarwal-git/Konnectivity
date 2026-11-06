// Regression tests use disposable data only, never a personal cookie or library.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {statSync} from 'node:fs';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,getRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {guardRequest,allowedOrigin,mayJoin,equalToken,localSetupRequest} from '../lib/access.mjs';
import {setAdminPassword,createSession,SESSION_COOKIE} from '../lib/auth.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test data');
assert.equal(localSetupRequest({headers:{host:'localhost:3000'},socket:{remoteAddress:'203.0.113.1'}}),false);
assert.equal(localSetupRequest({headers:{host:'localhost:3000','x-forwarded-for':'203.0.113.1'},socket:{remoteAddress:'127.0.0.1'}}),false);
assert.equal(localSetupRequest({headers:{host:'localhost:3000'},socket:{remoteAddress:'127.0.0.1'}}),true);
await setAdminPassword('Synthetic-test-password-only');
const room=createRoom('Private security fixture',true),sockets=[];
const http=createServer(async(req,res)=>{try{if(await guardRequest(req,res,getRoom))return;res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');}catch{res.writeHead(400);res.end();}});
const io=new Server(http,{maxHttpBufferSize:512*1024,allowRequest:(req,done)=>done(null,allowedOrigin(req))});
io.use((s,next)=>mayJoin(s.request,getRoom(s.handshake.auth.code),s.handshake.auth.ownerToken)?next():next(Error('unauthorized')));
registerRoomHandlers(io,{authorizeJoin:(s,r,t)=>mayJoin(s.request,r,t)});
await new Promise(r=>http.listen(0,'127.0.0.1',r));process.env.PORT=String(http.address().port);
const base=`http://127.0.0.1:${process.env.PORT}`,wait=ms=>new Promise(r=>setTimeout(r,ms));
function event(s,name){return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(`Timeout ${name}`)),3000);s.once(name,x=>{clearTimeout(t);resolve(x);});});}
function socket(headers={},auth={code:room.code}){const s=connect(base,{transports:['websocket'],extraHeaders:headers,auth,reconnection:false});sockets.push(s);return s;}
async function status(p,options={},expected=401){const r=await fetch(base+p,options);assert.equal(r.status,expected,p);return r;}
try{
 assert.equal(equalToken('é','a'),false);
 await status('/audio/local_00000000000000000000000000000000');
 await status('/api/search?q=test');
 await status('/api/artwork?videoId=M7lc1UVf-VE');
 await status('/api/rooms',{method:'POST',body:'{}'});
 await status('/api/room-invite?code='+room.code);
 await status('/',{headers:{Origin:'https://untrusted.example'}},403);
 const blocked=socket();assert.match((await event(blocked,'connect_error')).message,/unauthorized/);
 const cross=socket({Origin:'https://untrusted.example'},{code:room.code,ownerToken:room.ownerToken});await event(cross,'connect_error');
 const invite=await status(`/r/${room.code}?invite=${room.inviteToken}`,{redirect:'manual'},303);
 assert.equal(invite.headers.get('location'),`/r/${room.code}`);
 const cookie=invite.headers.get('set-cookie').split(';')[0];assert.match(invite.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
 const host=socket({},{code:room.code,ownerToken:room.ownerToken});await event(host,'connect');
 let ready=event(host,'room:state');host.emit('join',{code:room.code,nick:'Host',ownerToken:room.ownerToken});await ready;
 const guest=socket({Cookie:cookie});await event(guest,'connect');
 let pending=event(guest,'join:pending');guest.emit('join',{code:room.code,nick:'Guest'});await pending;
 let leaked=false;guest.on('chat:new',()=>leaked=true);host.emit('chat:send',{text:'Private until approved'});await wait(100);assert.equal(leaked,false);assert.equal(room.participants.has(guest.id),false);
 await status('/api/search?q=test',{headers:{Cookie:cookie}});
 ready=event(guest,'room:state');host.emit('host:approve',{id:guest.id});const state=await ready;assert.ok(state.uploadToken);
 const member=await status('/api/room-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:room.code,token:state.uploadToken})},200);
 const memberCookie=member.headers.get('set-cookie').split(';')[0];await status('/api/search?q=test',{headers:{Cookie:memberCookie}},200);
 const id='local_00000000000000000000000000000000';await status(`/audio/${id}?room=${room.code}&token=${state.uploadToken}`,{},403);room.library.push({videoId:id});await status(`/audio/${id}?room=${room.code}&token=${state.uploadToken}`,{},200);
 guest.emit('join',null);guest.emit('control:seek',{position:{invalid:true}});guest.emit('chat:send',null);await wait(100);await status('/',{},200);
 const adminCookie=`${SESSION_COOKIE}=${createSession()}`;await status('/api/rooms',{method:'POST',headers:{Cookie:adminCookie},body:'{}'},200);
 await status('/api/settings',{method:'POST',headers:{'Content-Length':'270000'},body:'x'.repeat(270000)},413);
 for(let n=0;n<10;n++)await status('/api/admin/session',{method:'POST',body:'{}'},200);
 await status('/api/admin/session',{method:'POST',body:'{}'},429);
 assert.equal(statSync(process.env.DATA_DIR).mode&0o777,0o700);assert.equal(statSync(process.env.DATA_DIR+'/admin.json').mode&0o777,0o600);
 console.log('PASS: private media/search/room creation, capability invitations, origin rejection, pending guest isolation, member cookies, track scope, malformed events, bounded bodies, login rate limiting and private file permissions');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
