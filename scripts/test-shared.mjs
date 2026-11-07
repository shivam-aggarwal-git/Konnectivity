// Run with isolated DATA_DIR and CACHE_DIR; never points at a live room.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createRoom, registerRoomHandlers, getRoom } from '../lib/rooms.mjs';
import { handleUpload } from '../lib/uploads.mjs';
import { handleAudioRequest, purgeCache } from '../lib/resolver.mjs';
import { ffmpegPath } from '../lib/ffmpeg.mjs';
if (!process.env.DATA_DIR || !process.env.CACHE_DIR) throw new Error('Set isolated DATA_DIR and CACHE_DIR before running this test');
const run = promisify(execFile), wait = ms => new Promise(r => setTimeout(r, ms));
const event = (s, e, check = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { s.off(e, handler); reject(new Error(`Timeout: ${e}`)); }, 5000);
  function handler(data) { if (check(data)) { clearTimeout(timer); s.off(e, handler); resolve(data); } }
  s.on(e, handler);
});
const http = createServer((req,res) => req.url.startsWith('/audio/') ? handleAudioRequest(req,res) : handleUpload(req,res,getRoom));
const io = new Server(http); registerRoomHandlers(io,{authorizeJoin:()=>true});
await new Promise(r => http.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${http.address().port}`;
const room = createRoom('Test together', false), sockets = [];
async function join(nick, ownerToken) {
  const socket = connect(url, { transports: ['websocket'] }); sockets.push(socket);
  const state = event(socket, 'room:state');
  socket.on('connect', () => socket.emit('join', { code: room.code, nick, ownerToken }));
  return [socket, await state];
}
try {
  const [a, sa] = await join('Host',room.ownerToken), [b, sb] = await join('Partner');
  assert.equal(sb.participants.find(p => p.id === sb.you).isHost, false);
  assert.equal(sb.volume, 1); assert.ok(sb.uploadToken);
  assert.equal(sb.participants[0].uploadToken, undefined);
  async function both(eventName, payload, predicate) {
    const states = [event(a,'playback:update',predicate), event(b,'playback:update',predicate)];
    if(payload===undefined)b.emit(eventName);else b.emit(eventName,payload); const result = await Promise.all(states);
    assert.deepEqual(result[0],result[1]); return result[0];
  }
  await both('control:volume',{ volume: .35 },s=>s.volume===.35);
  for (const ext of ['wav','mp3','flac']) {
    const file = `${process.env.DATA_DIR}/fixture.${ext}`;
    await run(ffmpegPath() || 'ffmpeg',['-hide_banner','-f','lavfi','-i','sine=frequency=440:duration=35','-y',file]);
    const response = await fetch(url+'/upload',{method:'POST', body:await fs.readFile(file), headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':`test-${ext}.${ext}`}});
    assert.equal(response.status,201); const {track} = await response.json(); assert.ok(Math.abs(track.duration-35)<.25, `Encoded fixture duration ${track.duration} should be within 250 ms of 35 seconds`);
    const states = [event(a,'playback:update',s=>s.current?.videoId===track.videoId&&s.isPlaying),event(b,'playback:update',s=>s.current?.videoId===track.videoId&&s.isPlaying)];
    b.emit('control:play-now',{track}); const initial=(await Promise.all(states))[0];assert.equal(initial.syncHolding,false);assert.equal(initial.waitingFor.length,0);
    a.emit('sync:media',{key:initial.syncKey,ready:true});await wait(30);assert.equal(room.syncHolding,false);
    await both('sync:media',{key:initial.syncKey,ready:true},s=>!s.syncHolding);

    const paused = await both('control:playpause',undefined,s=>!s.isPlaying&&!s.preparing); assert.ok(paused.pausedPosition>=0);
    await both('control:seek',{position:10},s=>s.pausedPosition===10);
    await both('control:seek',{position:0},s=>s.pausedPosition===0);
    await both('control:seek',{position:-10},s=>s.pausedPosition===0);
    await both('control:seek',{position:9999},s=>s.pausedPosition===track.duration);
    await both('control:seek',{position:5},s=>s.pausedPosition===5);
    await both('control:playpause',undefined,s=>s.isPlaying);
    const range = await fetch(`${url}/audio/${track.videoId}.m4a`,{headers:{Range:'bytes=0-99'}}); assert.equal(range.status,206); assert.equal((await range.arrayBuffer()).byteLength,100);
    const invalid = await fetch(`${url}/audio/${track.videoId}.m4a`,{headers:{Range:'bytes=99999999-'}}); assert.equal(invalid.status,416);
    await purgeCache(); assert.equal((await fetch(`${url}/audio/${track.videoId}.m4a`)).status,200);
    let updated = event(a,'library:update'); b.emit('playlist:save',{name:`Together ${ext}`,tracks:[track]}); let data = await updated;
    const list = data.playlists.at(-1); updated = event(a,'library:update'); b.emit('playlist:rename',{id:list.id,name:`Renamed ${ext}`}); data = await updated; assert.equal(data.playlists.at(-1).name,`Renamed ${ext}`);
    const queue = event(a,'queue:update',s=>s.queue.some(t=>t.videoId===track.videoId)); b.emit('queue:add-many',{tracks:list.tracks}); await queue;
  }
  const movie=`${process.env.DATA_DIR}/fixture.mp4`;
  await run(ffmpegPath()||'ffmpeg',['-hide_banner','-f','lavfi','-i','color=c=blue:s=160x90:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',movie]);
  const movieResponse=await fetch(url+'/upload',{method:'POST',body:await fs.readFile(movie),headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'movie.mp4'}});
  const movieData=await movieResponse.json();assert.equal(movieResponse.status,201,JSON.stringify(movieData));assert.equal(movieData.track.mediaType,'video');assert.equal(movieData.track.hasAudio,true);
  const silent=`${process.env.DATA_DIR}/silent.mp4`;
  await run(ffmpegPath()||'ffmpeg',['-hide_banner','-i',movie,'-an','-c:v','copy','-y',silent]);
  const silentResponse=await fetch(url+'/upload',{method:'POST',body:await fs.readFile(silent),headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'silent.mp4'}});const silentTrack=(await silentResponse.json()).track;assert.equal(silentTrack.hasAudio,false);
  const silentState=await both('control:play-now',{track:silentTrack},s=>s.current?.videoId===silentTrack.videoId&&!s.preparing);assert.equal(silentState.isPlaying,false);assert.equal(silentState.watchVideo,false);
  const silentVideo=await both('control:video',{enabled:true},s=>s.watchVideo===true);assert.equal(silentVideo.isPlaying,true);
  const movieRange=await fetch(`${url}/audio/${movieData.track.videoId}`,{headers:{Range:'bytes=0-99'}});assert.equal(movieRange.status,206);assert.equal(movieRange.headers.get('content-type'),'video/mp4');assert.equal((await movieRange.arrayBuffer()).byteLength,100);
  const duplicateName=await fetch(url+'/upload',{method:'POST',body:Buffer.from('different bytes'),headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':' MOVIE.MP4 '}});assert.equal(duplicateName.status,200);assert.equal((await duplicateName.json()).duplicate,true); // headers normalize surrounding whitespace
  const duplicateCase=await fetch(url+'/upload',{method:'POST',body:Buffer.from('different bytes'),headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'MOVIE.mp4'}});assert.equal(duplicateCase.status,200);const duplicateData=await duplicateCase.json();assert.equal(duplicateData.duplicate,true);assert.equal(duplicateData.reason,'name');assert.equal(duplicateData.track.videoId,movieData.track.videoId);
  const concurrentFile=`${process.env.DATA_DIR}/concurrent.wav`;await run(ffmpegPath()||'ffmpeg',['-hide_banner','-f','lavfi','-i','sine=frequency=880:duration=2','-y',concurrentFile]);const concurrentBytes=await fs.readFile(concurrentFile);const concurrent=await Promise.all(['Concurrent.wav','CONCURRENT.WAV'].map(name=>fetch(url+'/upload',{method:'POST',body:concurrentBytes,headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':name}})));assert.equal(concurrent.filter(r=>r.status===201).length,1);assert.ok(concurrent.every(r=>[200,201,409].includes(r.status)));const {allUploadedTracks}=await import('../lib/uploads.mjs');assert.equal(allUploadedTracks().filter(t=>t.nameKey==='concurrent').length,1);
  const movieStates=[event(a,'playback:update',s=>s.current?.mediaType==='video'&&s.isPlaying&&!s.preparing),event(b,'playback:update',s=>s.current?.mediaType==='video'&&s.isPlaying&&!s.preparing)];b.emit('control:play-now',{track:movieData.track});const movieState=await Promise.all(movieStates);assert.deepEqual(movieState[0],movieState[1]);assert.equal(movieState[0].syncHolding,false);assert.equal(movieState[0].watchVideo,false);const videoMode=await both('control:video',{enabled:true},s=>s.watchVideo===true);assert.equal(videoMode.watchVideo,true);await both('control:video',{enabled:false},s=>s.watchVideo===false);
  assert.equal((await fetch(url+'/upload',{method:'POST',body:'no'})).status,403);
  assert.equal((await fetch(url+'/upload',{method:'POST',body:'no',headers:{'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'bad.mp3'}})).status,400);
  // Queue play-now must override shuffle and remove exactly the selected item.
  room.shuffle = true; const chosen = room.queue.at(-1); const next = event(a,'playback:update',s=>s.current?.id===chosen.id&&s.isPlaying);
  b.emit('control:play-now',{id:chosen.id}); await next; assert.ok(!room.queue.some(t=>t.id===chosen.id));
  await wait(650); const saved = JSON.parse(await fs.readFile(`${process.env.DATA_DIR}/rooms.json`,'utf8'));
  assert.equal(saved[room.code].playlists.length,3); assert.equal(saved[room.code].volume,.35);
  console.log('PASS: two listeners, guest controls, WAV/MP3/FLAC uploads, audio ranges, cache retention, play-now with shuffle, playlists and durable state');
} finally { for(const s of sockets)s.disconnect(); io.close(); http.close(); }
process.exit(0);
