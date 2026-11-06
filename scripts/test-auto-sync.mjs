import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {playbackPosition,playbackRunning} from '../lib/client-sync.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated test data');
const http=createServer(),io=new Server(http);registerRoomHandlers(io);await new Promise(r=>http.listen(0,'127.0.0.1',r));
const room=createRoom('Auto sync test',false),url=`http://127.0.0.1:${http.address().port}`,sockets=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const event=(s,name,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off(name,fn);reject(Error(`Timeout ${name}`));},6000);function fn(data){if(predicate(data)){clearTimeout(timer);s.off(name,fn);resolve(data);}}s.on(name,fn);});
async function join(nick){const s=connect(url,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:room.code,nick}));return[s,await ready];}
try{
 const[a]=await join('Host'),[b]=await join('Listener');
 let changed=event(a,'playback:update',s=>s.isPlaying&&s.current?.videoId==='M7lc1UVf-VE');
 b.emit('control:play-now',{track:{videoId:'M7lc1UVf-VE',title:'Search song',artist:'Artist',duration:300},preferVideo:true});
 let state=await changed;assert.equal(state.watchVideo,true);assert.equal(state.preparing,false);const key=state.syncKey;
 b.emit('sync:report',{rtt:1200});a.emit('sync:media',{key,ready:true});
 const both=[event(a,'playback:update',s=>s.syncHolding),event(b,'playback:update',s=>s.syncHolding)];b.emit('sync:media',{key,ready:false});
 const held=await Promise.all(both);assert.deepEqual(held[0],held[1]);state=held[0];assert.deepEqual(state.waitingFor,['Listener']);assert.equal(state.isPlaying,true);
 const at=playbackPosition(state,state.serverNow);assert.equal(playbackPosition(state,state.serverNow+5000),at);assert.equal(playbackRunning(state,state.serverNow+5000),false);
 // A multi-second stall freezes both clocks, rather than letting the fast
 // listener continue and forcing the slow listener to miss that part.
 await wait(5100);assert.equal(room.syncHolding,true);
 changed=event(a,'playback:update',s=>!s.syncHolding&&s.resumeAt>s.serverNow);b.emit('sync:media',{key,ready:true});state=await changed;
 assert.ok(state.resumeAt-state.serverNow>=1100);assert.equal(playbackPosition(state,state.resumeAt-1),at);assert.equal(playbackPosition(state,state.resumeAt+500),at+.5);
 await wait(Math.max(0,state.resumeAt-state.serverNow)+100);
 changed=event(a,'playback:update',s=>s.syncHolding);b.emit('sync:media',{key,ready:false});await changed;
 // Pausing while waiting cancels automatic resume; ready must not restart it.
 changed=event(a,'playback:update',s=>!s.isPlaying&&!s.syncHolding);a.emit('control:playpause');await changed;b.emit('sync:media',{key,ready:true});await wait(50);assert.equal(room.isPlaying,false);
 // Stale readiness reports from a previous track cannot hold a new selection.
 changed=event(a,'playback:update',s=>s.current?.videoId==='abcdefghijk'&&s.isPlaying);a.emit('control:play-now',{track:{videoId:'abcdefghijk',title:'Next',artist:'Artist',duration:120},preferVideo:true});state=await changed;const second=state.syncKey;
 b.emit('sync:media',{key,ready:false});await wait(50);assert.equal(room.syncHolding,false);
 changed=event(a,'playback:update',s=>s.syncHolding);b.emit('sync:media',{key:second,ready:false});await changed;
 // Background suspension releases an existing hold, and cannot re-hold the room.
 changed=event(a,'playback:update',s=>!s.syncHolding);b.emit('sync:media',{key:second,ready:false,background:true});await changed;
 b.emit('sync:media',{key:second,ready:false,background:true});await wait(80);assert.equal(room.syncHolding,false);
 b.emit('sync:media',{key:second,ready:false});await wait(80);assert.equal(room.syncHolding,false);
 b.emit('sync:media',{key:second,ready:true,background:false});await wait(80);
 changed=event(a,'playback:update',s=>s.syncHolding);b.emit('sync:media',{key:second,ready:false});await changed;
 changed=event(a,'playback:update',s=>!s.syncHolding);b.disconnect();await changed;assert.equal(room.syncHolding,false);
 const[c,sc]=await join('Listener reconnected');assert.equal(sc.watchVideo,true);assert.equal(sc.current.videoId,'abcdefghijk');assert.equal(sc.syncKey,second);
 process.env.SYNC_BUFFER_TIMEOUT_MS='120';changed=event(a,'playback:update',s=>s.syncHolding);c.emit('sync:media',{key:second,ready:false});await changed;await wait(200);assert.equal(room.syncHolding,false);c.emit('sync:media',{key:second,ready:false});await wait(50);assert.equal(room.syncHolding,false);c.emit('sync:media',{key:second,ready:true});await wait(30);changed=event(a,'playback:update',s=>s.syncHolding);c.emit('sync:media',{key:second,ready:false});await changed;delete process.env.SYNC_BUFFER_TIMEOUT_MS;
 console.log('PASS: search starts video atomically, both listeners wait through a 5-second stall, RTT-based shared resume, manual pause respected, stale reports rejected, disconnect recovery and late join');
}finally{for(const s of sockets)s.disconnect();io.close();http.close();}process.exit(0);
