import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
const dir=mkdtempSync(join(tmpdir(),'kn-preferences-'));
process.env.DATA_DIR=join(dir,'data');process.env.CACHE_DIR=join(dir,'cache');mkdirSync(process.env.DATA_DIR);mkdirSync(process.env.CACHE_DIR);
const {createOwnedGroup,registerRoomHandlers}=await import('../lib/rooms.mjs');
const {appearancePatch}=await import('../lib/appearance.mjs');
const {VISUALIZERS,ROOM_LIGHTS}=await import('../lib/visual-options.mjs');
const {room,credential}=createOwnedGroup('Preferences',false);
assert.equal(room.continuousPlay,true);
const track={id:'test-track',videoId:'abcdefghijk',title:'Test track',artist:'Fixture',duration:180,likes:[],votes:[]};
room.queue=[track];room.playlists=[{id:'fixture-list',name:'Keep this list',tracks:[track]}];
const http=createServer(),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const socket=connect(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],reconnection:false});
const event=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timed out: '+name)),5000);socket.once(name,v=>{clearTimeout(timer);resolve(v);});});
try{
 await event('connect');const joined=event('room:state');socket.emit('join',{code:room.code,nick:'Preference tester',ownerToken:credential,mediaKey:'test_preferences_identity'});await joined;
 const request=(name,data)=>socket.timeout(5000).emitWithAck(name,data);
 assert.equal((await request('control:continuous-play',{enabled:false})).ok,true);assert.equal(room.continuousPlay,false);assert.equal(room.shuffle,false);
 socket.emit('control:shuffle',{});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(room.shuffle,true);assert.equal(room.continuousPlay,false);
 assert.ok((await request('control:continuous-play',{enabled:'invalid'})).error);
 for(const theme of ['terminal','lavender','espresso','cherry','arctic']){assert.equal(appearancePatch({theme}).theme,theme);assert.equal((await request('appearance:set',{theme})).ok,true);assert.equal(room.appearance.theme,theme);}
 for(const visualizer of ['comet','bars','line','tunnel','rain'])assert.ok(VISUALIZERS.some(([id])=>id===visualizer)&&appearancePatch({visualizer}).visualizer===visualizer);
 for(const lights of ['prism','lanterns','meteor','nebula','dusk'])assert.ok(ROOM_LIGHTS.some(([id])=>id===lights)&&appearancePatch({lights}).lights===lights);
 const batch=[track,{...track,videoId:'lmnopqrstuv',title:'Second fixture',mediaType:'video',isShort:true}];
 const save=await request('playlist:save',{name:'Selected songs',tracks:batch});assert.equal(save.ok,true);assert.equal(room.playlists.find(p=>p.id===save.id).tracks.length,2);assert.equal(room.playlists.find(p=>p.id===save.id).tracks[1].isShort,true);
 const queueBefore=room.queue.map(t=>t.videoId),listCount=room.playlists.length;
 assert.equal((await request('settings:reset',{})).ok,true);assert.equal(room.appearance.theme,'pearl');assert.equal(room.shuffle,false);assert.equal(room.repeat,'off');assert.equal(room.volume,1);assert.equal(room.continuousPlay,true);assert.deepEqual(room.queue.map(t=>t.videoId),queueBefore);assert.equal(room.playlists.length,listCount);
 console.log('PASS: independent continuous play, invalid setting rejection, five additional themes/visualizers/lights, selected-song playlists, Shorts metadata and non-destructive preference reset');
}finally{socket.disconnect();await new Promise(resolve=>io.close(resolve));http.close();rmSync(dir,{recursive:true,force:true});}
process.exit(0);
