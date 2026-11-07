import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=ts.transpileModule(readFileSync(new URL('../lib/browser-playback.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {stopMediaSlots}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const slots=Array.from({length:2},()=>({playing:true,src:'fixture',playbackRate:1.03,pause(){this.playing=false;},removeAttribute(key){assert.equal(key,'src');this.src='';},load(){this.cancelledPendingPlay=true;}}));
stopMediaSlots(...slots,null);for(const slot of slots){assert.equal(slot.playing,false);assert.equal(slot.src,'');assert.equal(slot.playbackRate,1);assert.equal(slot.cancelledPendingPlay,true);}
const {mediaNameKey}=await import('../lib/media-name.mjs');assert.equal(mediaNameKey('  My SONG.MP3'),mediaNameKey('My song.wav'));assert.equal(mediaNameKey('folder/song.mp4'),'song');assert.equal(mediaNameKey('ＳＯＮＧ.mp3'),'song');assert.notEqual(mediaNameKey('track 1.mp3'),mediaNameKey('track 2.mp3'));
console.log('PASS: room stop clears both crossfade slots and pending playback; normalized filename matching preserves distinct media names.');
