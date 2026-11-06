import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createRoom, registerRoomHandlers, getRoom, registerUpload } from '../lib/rooms.mjs';
import { handleUpload } from '../lib/uploads.mjs';
import { ffmpegPath } from '../lib/ffmpeg.mjs';
if (!process.env.DATA_DIR || !process.env.CACHE_DIR) throw Error('Use isolated test directories');
const run=promisify(execFile), room=createRoom('Library integration',false), sockets=[];
const http=createServer((req,res)=>handleUpload(req,res,getRoom,(r,t)=>registerUpload(io,r,t)));
const io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${http.address().port}`;
function event(socket,name,predicate=()=>true){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off(name,listener);reject(Error(`Timeout ${name}`));},5000);function listener(data){if(predicate(data)){clearTimeout(timeout);socket.off(name,listener);resolve(data);}}socket.on(name,listener);});}
async function join(nick, code = room.code){const s=connect(url,{transports:['websocket']});sockets.push(s);const state=event(s,'room:state');s.on('connect',()=>s.emit('join',{code,nick}));return[s,await state];}
function ack(s,name,data){return new Promise((resolve,reject)=>s.timeout(5000).emit(name,data,(err,result)=>err?reject(err):resolve(result)));}
try{
 const[a]=await join('Host'),[b,sb]=await join('Listener');
 const list=await ack(b,'playlist:save',{name:'Our first mixtape',tracks:[]});assert.ok(list.id);
 const file=process.env.DATA_DIR+'/fixture.wav';await run(ffmpegPath()||'ffmpeg',['-hide_banner','-f','lavfi','-i','sine=frequency=500:duration=5','-y',file]);
 let update=event(a,'library:update',s=>s.library.length===1);
 async function upload(){const response=await fetch(url+'/upload',{method:'POST',body:await fs.readFile(file),headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'Our song.wav'}});assert.ok(response.ok);return response.json();}
 const first=await upload();await update;assert.equal(room.queue.length,0);assert.equal(room.library.length,1);
 const second=await upload();assert.equal(second.duplicate,true);assert.equal(second.track.videoId,first.track.videoId);assert.equal(room.library.length,1);
 update=event(a,'library:update',s=>s.playlists[0].tracks.length===1);assert.equal((await ack(b,'playlist:add-track',{id:list.id,track:first.track})).ok,true);await update;
 await ack(b,'playlist:add-track',{id:list.id,track:first.track});assert.equal(room.playlists[0].tracks.length,1);
 assert.ok((await ack(b,'playlist:add-track',{id:'missing',track:first.track})).error);
 const remote={videoId:'abcdefghijk',title:'Online favorite',artist:'Artist',duration:90};await ack(a,'playlist:add-track',{id:list.id,track:remote});assert.equal(room.playlists[0].tracks.length,2);
 await ack(b,'playlist:remove-track',{id:list.id,videoId:remote.videoId});assert.equal(room.playlists[0].tracks.length,1);
 const many=Array.from({length:400},(_,i)=>({...first.track,title:`Song ${i}`}));const big=await ack(b,'playlist:save',{name:'400-song collection',tracks:many});assert.ok(big.id);assert.equal(room.playlists.at(-1).tracks.length,400);
 const[c,sc]=await join('Friend');assert.equal(sc.library.length,1);assert.equal(sc.playlists.at(-1).tracks.length,400);
 const other=createRoom('Another date',false);const[d,sd]=await join('Friend in another room',other.code);assert.equal(sd.library.length,1);assert.equal(sd.playlists.find(p=>p.name==='Our songs ♡').tracks.length,1);
 await new Promise(r=>setTimeout(r,650));const saved=JSON.parse(await fs.readFile(process.env.DATA_DIR+'/rooms.json','utf8'));assert.equal(saved[room.code].library.length,1);
 console.log('PASS: empty playlist creation, individual add/remove from either listener, duplicate prevention, durable shared upload library, reconnect snapshots, 400-song playlists, server library reused in a new room');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
