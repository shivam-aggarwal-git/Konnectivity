import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createRoom,getRoom,registerRoomHandlers} from '../lib/rooms.mjs';
import {handleChatMedia} from '../lib/chat-media.mjs';
if(!process.env.DATA_DIR||!process.env.CACHE_DIR)throw Error('Use isolated DATA_DIR and CACHE_DIR');
const server=createServer((req,res)=>handleChatMedia(req,res,getRoom)),io=new Server(server);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`,room=createRoom('Media test',false),other=createRoom('Private room',false),sockets=[];
// This suite checks explicit end-of-queue behavior; continuous play is covered separately.
room.continuousPlay=false;
const event=(socket,name,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(name,fn);reject(Error(`Timeout ${name}`));},5000);function fn(data){if(predicate(data)){clearTimeout(timer);socket.off(name,fn);resolve(data);}}socket.on(name,fn);});
const ack=(socket,name,data)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(name,data,(err,result)=>err?reject(err):resolve(result)));
async function join(nick,target=room,owner=false){const s=connect(url,{transports:['websocket']});sockets.push(s);const ready=event(s,'room:state');s.on('connect',()=>s.emit('join',{code:target.code,nick,ownerToken:owner?target.ownerToken:undefined}));return[s,await ready];}
try{
 const[a,sa]=await join('Host',room,true),[b,sb]=await join('Listener'),[c,sc]=await join('Other room',other);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
 const headers={'x-room-code':room.code,'x-upload-token':sb.uploadToken,'x-file-name':'Us.png'};
 const upload=await fetch(url+'/chat-media',{method:'POST',headers,body:png});assert.equal(upload.status,201);const{image}=await upload.json();
 assert.equal((await fetch(url+image.url)).status,403);
 const view=await fetch(`${url}${image.url}?room=${room.code}&token=${sa.uploadToken}`);assert.equal(view.status,200);assert.equal(view.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await view.arrayBuffer()),png);
 assert.equal((await fetch(`${url}${image.url}?room=${other.code}&token=${sc.uploadToken}`)).status,404);
 const messages=[event(a,'chat:new',m=>m.image?.id===image.id),event(b,'chat:new',m=>m.image?.id===image.id)];assert.equal((await ack(b,'chat:send',{text:'For you ♡',imageId:image.id})).ok,true);for(const m of await Promise.all(messages)){assert.equal(m.text,'For you ♡');assert.equal(m.nick,'Listener');}
 assert.ok((await ack(c,'chat:send',{text:'No',imageId:image.id})).error);
 assert.equal((await ack(b,'chat:send',{imageId:image.id})).ok,true);
 assert.equal((await fetch(url+'/chat-media',{method:'POST',headers,body:'<svg>no</svg>'})).status,415);
 assert.equal((await fetch(url+'/chat-media',{method:'POST',headers,body:Buffer.alloc(8*1024*1024+1)})).status,413);
 let changed=event(b,'participants:update',s=>s.participants.find(p=>p.id===sb.you)?.muted);a.emit('host:mute',{id:sb.you,muted:true});await changed;
 assert.equal((await fetch(url+'/chat-media',{method:'POST',headers,body:png})).status,403);assert.ok((await ack(b,'chat:send',{imageId:image.id})).error);
 const enabled=[event(a,'playback:update',s=>s.watchVideo),event(b,'playback:update',s=>s.watchVideo)];assert.equal((await ack(b,'control:video',{enabled:true})).ok,true);await Promise.all(enabled);
 const playing=[event(a,'playback:update',s=>s.current?.videoId==='M7lc1UVf-VE'&&s.isPlaying),event(b,'playback:update',s=>s.current?.videoId==='M7lc1UVf-VE'&&s.isPlaying)];
 assert.ok((await ack(b,'control:video-play',{url:'https://example.com/watch?v=M7lc1UVf-VE'})).error);
 assert.equal((await ack(b,'control:video-play',{url:'https://youtu.be/M7lc1UVf-VE'})).ok,true);await Promise.all(playing);assert.equal(room.preparing,false);assert.equal(room.current.duration,0);
 changed=event(a,'playback:update',s=>s.current?.duration===300);b.emit('control:video-metadata',{videoId:'M7lc1UVf-VE',duration:300,title:'YouTube API sample'});await changed;assert.equal(room.current.title,'YouTube API sample');
 changed=event(a,'playback:update',s=>!s.isPlaying);b.emit('control:play-state',{playing:false});await changed;
 changed=event(a,'playback:update',s=>s.pausedPosition===123);b.emit('control:seek',{position:123});await changed;
 const[d,sd]=await join('Late listener');assert.equal(sd.watchVideo,true);assert.equal(sd.pausedPosition,123);assert.equal(sd.isPlaying,false);
 changed=event(a,'playback:update',s=>s.isPlaying);b.emit('control:play-state',{playing:true});await changed;b.emit('control:play-state',{playing:true});await new Promise(r=>setTimeout(r,50));assert.equal(room.isPlaying,true);
 changed=event(a,'playback:update',s=>!s.current);b.emit('control:skip');await changed;assert.equal((await ack(b,'control:video',{enabled:false})).ok,true);assert.equal(room.watchVideo,false);
 console.log('PASS: room-protected images, captions and image-only chat, file limits/type checks, moderation, shared video mode, video preparation without audio downloads, idempotent play/pause, seeking and late joins');
}finally{for(const s of sockets)s.disconnect();io.close();server.close();}process.exit(0);
