import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {createRoom,getRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {handleChatMedia} from '../lib/chat-media.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test state');
const first=createRoom('Personal fixture',false),http=createServer((req,res)=>handleChatMedia(req,res,getRoom)),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${http.address().port}`,sockets=[];
function event(s,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(name)),4000);s.once(name,v=>{clearTimeout(timer);resolve(v);});});}
async function join(room,nick,host=false){const s=connect(base,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:room.code,nick,...host?{ownerToken:room.ownerToken}:{}}));return[s,await ready];}
function ack(s,name,payload){return new Promise((resolve,reject)=>s.timeout(4000).emit(name,payload,(error,result)=>error?reject(error):resolve(result)));}
try{
 const[a,sa]=await join(first,'Host',true),[b]=await join(first,'Partner');
 const tracks=[{videoId:'abcdefghijk',title:'Saved reference',artist:'Fixture',duration:180}];
 const local=await ack(a,'playlist:save',{name:'Room only',tracks}),shared=await ack(b,'playlist:save',{name:'Every day',tracks});
 assert.ok(!createRoom('Before opt in',false).playlists.some(p=>p.id===shared.id));
 assert.equal((await ack(b,'playlist:persist',{id:shared.id,enabled:true})).ok,true);
 let second=createRoom('New code',false);assert.ok(second.playlists.some(p=>p.id===shared.id));assert.ok(!second.playlists.some(p=>p.id===local.id));
 const[c]=await join(second,'Other room host',true);await ack(c,'playlist:save',{id:shared.id,name:'Renamed everywhere',tracks:[...tracks,{...tracks[0],videoId:'bcdefghijkl',title:'Second reference'}]});assert.equal(first.playlists.find(p=>p.id===shared.id).name,'Renamed everywhere');
 assert.ok((await ack(b,'personal-space:set',{enabled:true})).error);
 const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
 async function upload(name){const r=await fetch(base+'/chat-media',{method:'POST',headers:{'x-room-code':first.code,'x-upload-token':sa.uploadToken,'x-file-name':name},body:gif});assert.equal(r.status,201);return (await r.json()).image;}
 const image=await upload('Background.gif'),privateImage=await upload('Private chat.gif');
 let update=event(a,'appearance:update');b.emit('appearance:set',{theme:'ocean',background:'photo',backgroundImageId:image.id,backgroundZoom:1.4});await update;
 let playback=event(a,'playback:update');b.emit('control:volume',{volume:.4});await playback;
 assert.equal((await ack(a,'personal-space:set',{enabled:true})).ok,true);
 const third=createRoom('Another new code',false);assert.equal(third.appearance.backgroundImageId,image.id);assert.equal(third.appearance.backgroundZoom,1.4);assert.equal(third.volume,.4);
 const[d,sd]=await join(third,'New room host',true);
 assert.equal((await fetch(`${base}${image.url}?room=${third.code}&token=${sd.uploadToken}`)).status,200);
 assert.equal((await fetch(`${base}${privateImage.url}?room=${third.code}&token=${sd.uploadToken}`)).status,404);
 update=event(a,'appearance:update');d.emit('appearance:set',{theme:'aurora',backgroundX:25});await update;assert.equal(first.appearance.theme,'aurora');
 await new Promise(r=>setTimeout(r,900));const profile=JSON.parse(readFileSync(process.env.DATA_DIR+'/personal-space.json'));assert.equal(profile.playlists.length,1);assert.equal(profile.playlists[0].tracks[0].videoId,'abcdefghijk');assert.equal(profile.appearance.backgroundX,25);assert.equal(readdirSync(process.env.CACHE_DIR).length,0);
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import{createRoom}from'./lib/rooms.mjs';const r=createRoom('After restart',false);if(r.appearance.theme!=='aurora'||r.volume!==.4||!r.playlists.some(p=>p.name==='Renamed everywhere'))process.exitCode=1;setTimeout(()=>process.exit(process.exitCode||0),600);`],{env:process.env,encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 assert.equal((await ack(a,'personal-space:set',{enabled:false})).ok,true);await ack(a,'playlist:persist',{id:shared.id,enabled:false});const fresh=createRoom('Local again',false);assert.equal(fresh.appearance.background,'none');assert.ok(!fresh.playlists.some(p=>p.id===shared.id));assert.ok(first.playlists.some(p=>p.id===shared.id));
 console.log('PASS: per-playlist reference opt-in, cross-code reuse/edit, unchecked isolation, host-only settings toggle, shared GIF ACL without chat-photo leakage, saved crop/volume, restart recovery, no audio copies and opt-out');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
