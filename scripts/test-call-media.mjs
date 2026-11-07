import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=ts.transpileModule(readFileSync(new URL('../lib/call-media.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {acquireMedia,restoreAudioSession,mediaPermissionError}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let resolveMedia,stopped=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{audioSession:{type:'playback'},mediaDevices:{getUserMedia:()=>new Promise(r=>{resolveMedia=r;})}}});
try{
 const waiting=acquireMedia({audio:true},10);assert.equal(navigator.audioSession.type,'play-and-record');await assert.rejects(waiting,/permission timed out/);assert.equal(navigator.audioSession.type,'auto');resolveMedia({getTracks:()=>[{stop:()=>stopped++}]});await new Promise(r=>setTimeout(r,0));assert.equal(stopped,1);
 const media={getTracks:()=>[]};navigator.mediaDevices.getUserMedia=async()=>{assert.equal(navigator.audioSession.type,'play-and-record');return media;};assert.equal(await acquireMedia({audio:true},100),media);
 restoreAudioSession();assert.equal(navigator.audioSession.type,'auto');navigator.mediaDevices.getUserMedia=async()=>{throw Error('Permission denied');};await assert.rejects(acquireMedia({audio:true},100),/Permission denied/);assert.equal(navigator.audioSession.type,'auto');
 assert.match(mediaPermissionError({name:'NotAllowedError',message:'raw platform error'}).message,/access is blocked/);assert.match(mediaPermissionError({name:'NotReadableError'}).message,/busy/);assert.match(mediaPermissionError({name:'NotFoundError'}).message,/No microphone/);
 console.log('PASS: bounded media-permission waiting, immediate cleanup of late capture, successful preview and permission rejection.');
}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
