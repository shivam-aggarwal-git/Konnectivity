import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {certificateBundle,downloaderTrust} from '../lib/downloader-trust.mjs';
assert.equal(certificateBundle({},'darwin',p=>p==='/etc/ssl/cert.pem'),'/etc/ssl/cert.pem');assert.throws(()=>certificateBundle({SSL_CERT_FILE:'/missing'},'darwin',()=>false),/does not exist/);
const trust=downloaderTrust({noPlaylist:true});assert.notEqual(trust.flags.noCheckCertificates,true);if(process.platform==='darwin'){assert.equal(trust.options.env.SSL_CERT_FILE,'/etc/ssl/cert.pem');assert.ok(trust.flags.compatOptions.includes('no-certifi'));}
const root=mkdtempSync(path.join(tmpdir(),'kn-recovery-'));const bin=path.join(root,'fail-download');writeFileSync(bin,'#!/usr/bin/env node\nprocess.stderr.write("ERROR: [SSL: CERTIFICATE_VERIFY_FAILED] unable to get local issuer certificate\\n");process.exit(1);',{mode:0o700});
process.env.DATA_DIR=path.join(root,'data');process.env.CACHE_DIR=path.join(root,'cache');process.env.YTDLP_BINARY=bin;process.env.YTDLP_AUTO_UPDATE='false';mkdirSync(process.env.DATA_DIR);mkdirSync(process.env.CACHE_DIR);
const {createRoom,registerRoomHandlers}=await import('../lib/rooms.mjs');const room=createRoom('Recovery fixture',false),http=createServer(),io=new Server(http);registerRoomHandlers(io,{authorizeJoin:()=>true});await new Promise(r=>http.listen(0,'127.0.0.1',r));
const s=connect(`http://127.0.0.1:${http.address().port}`,{transports:['websocket'],reconnection:false});
function event(name,predicate=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off(name,fn);reject(Error('Timeout '+name));},5000);const fn=v=>{if(predicate(v)){clearTimeout(timer);s.off(name,fn);resolve(v);}};s.on(name,fn);});}
try{
 const ready=event('room:state');s.on('connect',()=>s.emit('join',{code:room.code,nick:'Host',ownerToken:room.ownerToken}));await ready;
 const first={videoId:'abcdefghijk',title:'First',artist:'Fixture',duration:120},second={videoId:'lmnopqrstuv',title:'Second',artist:'Fixture',duration:120};room.queue.push({...second,id:'second',likes:[],votes:[]});
 let paused=event('playback:update',v=>v.playbackError&&!v.preparing);s.emit('control:play-now',{track:first});let state=await paused;assert.equal(state.current.videoId,first.videoId);assert.equal(state.isPlaying,false);assert.match(state.playbackError,/certificate bundle/);assert.ok(room.queue.some(t=>t.id==='second'));assert.equal(room.history.length,0);
 paused=event('playback:update',v=>v.playbackError&&!v.preparing);s.emit('control:retry');state=await paused;assert.equal(state.current.videoId,first.videoId);assert.equal(room.history.length,0);assert.equal(room.queue.filter(t=>t.videoId===first.videoId).length,0);
 paused=event('playback:update',v=>v.current?.videoId===second.videoId&&v.playbackError);s.emit('control:skip');await paused;assert.equal(room.history.length,1);
 console.log('PASS: verified OS CA configuration, invalid bundle rejection, TLS errors pause without consuming queue, retry preserves history, and explicit skip advances.');
}finally{s.disconnect();await new Promise(r=>io.close(r));http.close();await new Promise(r=>setTimeout(r,500));rmSync(root,{recursive:true,force:true});}process.exit(0);
