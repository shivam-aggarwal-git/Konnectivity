import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {Server} from 'socket.io';
import {handleChatMedia} from '../lib/chat-media.mjs';
import {io as connect} from 'socket.io-client';
import {createRoom,getRoom,registerRoomHandlers} from '../lib/rooms.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test data');
const http=createServer((req,res)=>handleChatMedia(req,res,getRoom)),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});
await new Promise(r=>http.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${http.address().port}`,room=createRoom('Shared appearance',false),other=createRoom('Other room',false),sockets=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function event(s,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(name)),3000);s.once(name,data=>{clearTimeout(timer);resolve(data);});});}
async function join(r,nick){const s=connect(url,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:r.code,nick}));return[s,await ready];}
try{
 const[a,sa]=await join(room,'First'),[b,sb]=await join(room,'Partner'),[isolated,so]=await join(other,'Friend');let leaked=false;isolated.on('appearance:update',()=>leaked=true);
 let updates=[event(a,'appearance:update'),event(b,'appearance:update')];const saved=new Promise(resolve=>b.timeout(3000).emit('appearance:set',{theme:'aurora',lights:'breathe',visualizer:'wave',motion:true},(err,result)=>{assert.ifError(err);assert.equal(result.ok,true);resolve();}));await saved;const [first,second]=await Promise.all(updates);assert.deepEqual(first,second);assert.equal(first.theme,'aurora');assert.equal(first.visualizer,'wave');
 updates=[event(a,'appearance:update'),event(b,'appearance:update')];a.emit('appearance:set',{theme:'sunset'});await Promise.all(updates);assert.equal(room.appearance.visualizer,'wave');assert.equal(room.appearance.theme,'sunset');
 b.emit('appearance:set',{theme:'invalid',motion:'false',unknown:'value'});await wait(50);assert.equal(room.appearance.theme,'sunset');assert.equal(room.appearance.motion,true);assert.equal(room.appearance.unknown,undefined);assert.equal(leaked,false);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
 const upload=await fetch(url+'/chat-media',{method:'POST',headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'Together.png'},body:png});assert.equal(upload.status,201);const {image}=await upload.json();
 updates=[event(a,'appearance:update'),event(b,'appearance:update')];b.emit('appearance:set',{background:'photo',backgroundImageId:image.id,backgroundDim:.4});const photo=await Promise.all(updates);assert.deepEqual(photo[0],photo[1]);assert.equal(photo[0].backgroundImageId,image.id);
 assert.equal((await fetch(url+image.url)).status,403);assert.equal((await fetch(`${url}${image.url}?room=${room.code}&token=${sa.uploadToken}`)).status,200);assert.equal((await fetch(`${url}${image.url}?room=${other.code}&token=${so.uploadToken}`)).status,404);
 isolated.emit('appearance:set',{background:'photo',backgroundImageId:image.id});await wait(50);assert.equal(other.appearance.background,'none');
 b.emit('appearance:set',{backgroundImageId:'ffffffffffffffffffffffffffffffff'});await wait(50);assert.equal(room.appearance.backgroundImageId,image.id);
 updates=[event(a,'appearance:update'),event(b,'appearance:update')];a.emit('appearance:set',{background:'artwork',backgroundDim:10});await Promise.all(updates);assert.equal(room.appearance.background,'artwork');assert.equal(room.appearance.backgroundDim,.85);
 updates=[event(a,'appearance:update'),event(b,'appearance:update')];b.emit('appearance:set',{background:'none'});await Promise.all(updates);assert.equal(room.appearance.background,'none');
 const[,late]=await join(room,'Late listener');assert.deepEqual(late.appearance,room.appearance);await wait(650);assert.deepEqual(JSON.parse(readFileSync(process.env.DATA_DIR+'/rooms.json','utf8'))[room.code].appearance,room.appearance);
 console.log('PASS: either participant changes shared appearance, both receive identical state, partial updates retained, invalid values rejected, protected photo backgrounds, artwork/theme modes, darkness bounds, other rooms isolated, late join and persisted state');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
