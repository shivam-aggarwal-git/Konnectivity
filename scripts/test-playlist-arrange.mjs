import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {appearancePatch} from '../lib/appearance.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test data');
const http=createServer(),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));
const room=createRoom('Arrange fixture',false);room.watchVideo=true;room.current={id:'playing',videoId:'abcdefghijk',title:'Current fixture',artist:'Fixture',duration:180};
const sockets=[];
function event(s,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(name)),3000);s.once(name,v=>{clearTimeout(timer);resolve(v);});});}
async function join(nick){const s=connect(`http://127.0.0.1:${http.address().port}`,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:room.code,nick}));await ready;return s;}
function ack(s,name,payload){return new Promise((resolve,reject)=>s.timeout(3000).emit(name,payload,(error,reply)=>error?reject(error):resolve(reply)));}
const tracks=Array.from({length:62},(_,i)=>({videoId:`song${String(i).padStart(7,'0')}`,title:`Fixture ${i+1}`,artist:'Fixture',duration:180}));
try{
 const a=await join('First'),b=await join('Second');
 const first=await ack(a,'playlist:save',{name:'First 62',tracks}),second=await ack(b,'playlist:save',{name:'Second 3',tracks:tracks.slice(0,3)});
 const update=event(a,'library:update');assert.equal((await ack(b,'playlist:reorder',{id:first.id,fromIndex:55,toIndex:5,expectedVideoId:tracks[55].videoId,expectedTitle:tracks[55].title})).ok,true);await update;
 assert.equal(room.playlists.find(p=>p.id===first.id).tracks[5].title,'Fixture 56');
 assert.ok((await ack(b,'playlist:reorder',{id:first.id,fromIndex:55,toIndex:5,expectedVideoId:tracks[55].videoId,expectedTitle:tracks[55].title})).error);
 assert.ok((await ack(b,'playlist:reorder',{id:first.id,fromIndex:0,toIndex:9999})).error);
 const queued=await ack(b,'playlist:queue',{ids:[first.id,second.id]});assert.equal(queued.count,65);assert.equal(room.queue.length,65);assert.equal(room.current.id,'playing');assert.equal(room.queue[5].title,'Fixture 56');assert.equal(room.queue[62].title,'Fixture 1');
 assert.equal((await ack(a,'playlist:queue',{ids:[second.id]})).count,3);assert.equal(room.queue.length,68);
 assert.ok((await ack(b,'playlist:queue',{ids:['missing']})).error);assert.equal(room.queue.length,68);
 let appearance=event(a,'appearance:update');b.emit('appearance:set',{backgroundFit:'contain',backgroundX:20,backgroundY:80,backgroundZoom:1.8,backgroundBlur:0});const v=await appearance;assert.equal(v.backgroundFit,'contain');assert.equal(v.backgroundZoom,1.8);
 const late=await join('Late listener');assert.equal(room.appearance.backgroundZoom,1.8);
 assert.deepEqual(appearancePatch({backgroundX:-5,backgroundY:200,backgroundZoom:99,backgroundBlur:-1}),{backgroundX:0,backgroundY:100,backgroundZoom:3,backgroundBlur:0});
 await new Promise(r=>setTimeout(r,700));const saved=JSON.parse(readFileSync(process.env.DATA_DIR+'/rooms.json'));assert.equal(saved[room.code].playlists.find(p=>p.id===first.id).tracks[5].title,'Fixture 56');assert.equal(saved[room.code].appearance.backgroundX,20);
 console.log('PASS: shared saved playlist 56→6 reorder, stale/invalid rejection, 62+3 playlist batch, append without replacing current song, repeated playlist batches, shared crop/zoom/fit and durable order');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
