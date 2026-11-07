import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {playbackPosition,playbackRunning} from '../lib/client-sync.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test data');
const http=createServer(),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));
const room=createRoom('Auto sync test',false),url=`http://127.0.0.1:${http.address().port}`,sockets=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const event=(s,name,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off(name,fn);reject(Error(`Timeout ${name}`));},6000);function fn(data){if(predicate(data)){clearTimeout(timer);s.off(name,fn);resolve(data);}}s.on(name,fn);});
async function join(nick){const s=connect(url,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:room.code,nick}));return[s,await ready];}
try{
 const[a]=await join('Host'),[b]=await join('Listener');
 assert.equal(room.watchVideo,false);b.emit('control:video',{enabled:true});await wait(50);
 let changed=event(a,'playback:update',s=>s.isPlaying&&s.current?.videoId==='M7lc1UVf-VE');
 b.emit('control:play-now',{track:{videoId:'M7lc1UVf-VE',title:'Search song',artist:'Artist',duration:300},preferVideo:true});
 let state=await changed;assert.equal(state.watchVideo,true);assert.equal(state.preparing,false);const key=state.syncKey;
 // Slow, blocked and background listeners never freeze the shared clock.
 for(const flags of [{ready:false},{ready:false,blocked:true},{ready:false,background:true},{ready:true}]){
  changed=event(a,'playback:update');b.emit('sync:media',{key,...flags});state=await changed;
  assert.equal(state.syncHolding,false);assert.deepEqual(state.waitingFor,[]);assert.equal(state.resumeAt,0);
  assert.equal(playbackRunning(state,state.serverNow+5000),true);
  assert.ok(playbackPosition(state,state.serverNow+5000)>playbackPosition(state,state.serverNow)+4.9);
 }
 changed=event(a,'playback:update',s=>!s.isPlaying);a.emit('control:playpause');await changed;b.emit('sync:media',{key,ready:true});await wait(30);assert.equal(room.isPlaying,false);
 changed=event(a,'playback:update',s=>s.isPlaying);a.emit('control:playpause');await changed;
 b.emit('sync:media',{key:'stale-key',ready:false});await wait(30);assert.equal(room.syncHolding,false);
 // Replay resets the authoritative clock and rejects an old end notification.
 a.emit('control:seek',{position:90});await wait(30);const oldKey=room.syncKey;changed=event(a,'playback:update',s=>s.syncKey!==oldKey&&s.pausedPosition===0&&s.isPlaying);a.emit('control:replay',{});const replay=await changed;assert.notEqual(replay.syncKey,oldKey);assert.equal(replay.pausedPosition,0);const replayTrack=room.current.videoId;a.emit('track:ended',{videoId:replayTrack,syncKey:oldKey});await wait(30);assert.equal(room.current.videoId,replayTrack);
 // Uploaded files also start without waiting for any readiness report.
 room.current.videoId='local_readiness_fixture';room.playToken++;room.isPlaying=true;
 changed=event(a,'playback:update',s=>s.current?.videoId==='local_readiness_fixture');a.emit('control:seek',{position:0});state=await changed;
 assert.equal(state.syncHolding,false);assert.deepEqual(state.waitingFor,[]);
 changed=event(a,'playback:update');b.emit('sync:media',{key:state.syncKey,ready:false});state=await changed;assert.equal(state.syncHolding,false);
 console.log('PASS: immediate playback, independent buffering, blocked/background listeners cannot hold others, pause respected, atomic replay and stale end rejection');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
