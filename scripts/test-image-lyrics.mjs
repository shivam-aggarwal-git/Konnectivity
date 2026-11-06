import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,getRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {handleChatMedia} from '../lib/chat-media.mjs';
import {supportedLyrics,getLyrics} from '../lib/lyrics.mjs';
import {isHeic,convertHeic} from '../lib/heic.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated data');
assert.ok(supportedLyrics('Hello, my love ♥'));assert.ok(supportedLyrics('तुम ही हो'));assert.ok(supportedLyrics('Tum hi ho'));assert.equal(supportedLyrics('تم ہی ہو'),false);assert.equal(supportedLyrics('তুমি আমার'),false);assert.equal(supportedLyrics('நீ தான்'),false);assert.equal(supportedLyrics('Hello تم'),false);
const nativeFetch=globalThis.fetch;let lyricCalls=0;globalThis.fetch=async url=>{assert.equal(new URL(url).searchParams.get('pass'),'true');assert.ok(!new URL(url).searchParams.get('sequence').split(',').includes('2'));return new Response(JSON.stringify({status:'success',data:++lyricCalls===1?{lyrics:'تم ہی ہو'}:{lyrics:'Tum hi ho',timed_lyrics:[{start_time:1000,text:'Tum hi ho'}]}}),{status:200,headers:{'Content-Type':'application/json'}});};
const lyrics=await getLyrics({videoId:'test-languages',title:'Fixture',artist:'Fixture',duration:120});assert.equal(lyrics.synced[0].text,'Tum hi ho');globalThis.fetch=nativeFetch;
const fake=Buffer.alloc(24);fake.write('ftyp',4);fake.write('heic',8);assert.ok(isHeic(fake));await assert.rejects(convertHeic(fake));assert.equal(isHeic(Buffer.from('not heic')),false);
const http=createServer((req,res)=>handleChatMedia(req,res,getRoom)),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));
const room=createRoom('Image tests',false),base=`http://127.0.0.1:${http.address().port}`,s=connect(base,{transports:['websocket']});
try{
 const state=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('join timeout')),3000);s.once('room:state',v=>{clearTimeout(t);resolve(v);});s.on('connect',()=>s.emit('join',{code:room.code,nick:'Image tester'}));});
 async function upload(bytes,name){return fetch(base+'/chat-media',{method:'POST',headers:{'x-room-code':room.code,'x-upload-token':state.uploadToken,'x-file-name':name},body:bytes});}
 const gif=process.env.GIF_TEST_FILE?readFileSync(process.env.GIF_TEST_FILE):Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
 let response=await upload(gif,'Animated.gif');assert.equal(response.status,201);let {image}=await response.json();response=await fetch(`${base}${image.url}?room=${room.code}&token=${state.uploadToken}`);assert.equal(response.headers.get('content-type'),'image/gif');assert.deepEqual(Buffer.from(await response.arrayBuffer()),gif);
 assert.equal((await upload(fake,'Broken.HEIC')).status,400);
 if(process.env.HEIC_TEST_FILE){response=await upload(readFileSync(process.env.HEIC_TEST_FILE),'Photo.HEIC');assert.equal(response.status,201);({image}=await response.json());response=await fetch(`${base}${image.url}?room=${room.code}&token=${state.uploadToken}`);assert.equal(response.headers.get('content-type'),'image/jpeg');const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes[0],255);assert.equal(bytes[1],216);console.log('PASS: real HEIC uploaded, converted and served as JPEG');}
 console.log('PASS: Hindi/English script selection, regional/Urdu rejection, fallback lyric search, malformed HEIC recovery, exact GIF preservation and protected image serving');
}finally{s.disconnect();io.close();http.close();}process.exit(0);
