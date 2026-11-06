import assert from 'node:assert/strict';
import {normalizeLyrica,getLyrics} from '../lib/lyrics.mjs';
const response={status:'success',data:{source:'fixture',lyrics:'Hello love',timed_lyrics:[{start_time:2450,text:'Hello love'}]}};
assert.equal(normalizeLyrica(response).synced[0].t,2.45);
assert.equal(normalizeLyrica({status:'success',data:{lyrics:'Hello love'}}).synced,null);
assert.equal(normalizeLyrica({status:'success',data:{lyrics:'تم ہی ہو'}}),null);
assert.equal(normalizeLyrica({status:'success',data:{timed_lyrics:[{start_time:'bad',text:'Hello'}]}}),null);
assert.equal(normalizeLyrica({status:'success',data:{timed_lyrics:[{start_time:0,text:'作曲: Fixture'},{start_time:1000,text:'Hello love'}]}}).synced.length,1);
const original=globalThis.fetch;let calls=0;
try{
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers.Cookie,undefined);assert.equal(options.redirect,'error');assert.equal(new URL(url).searchParams.get('pass'),'true');assert.ok(!new URL(url).searchParams.get('sequence').split(',').includes('2'));return new Response(JSON.stringify(response));};
 const track={title:'Synthetic coalescing fixture',artist:'Fixture'};
 await Promise.all([getLyrics(track),getLyrics(track)]);await getLyrics(track);assert.equal(calls,1);
 globalThis.fetch=async()=>new Response('x'.repeat(1024*1024+1));
 await assert.rejects(getLyrics({title:'Oversize fixture',artist:'Fixture'}),/too large/);
 globalThis.fetch=async()=>new Response('invalid JSON');await assert.rejects(getLyrics({title:'Invalid JSON fixture',artist:'Fixture'}));
 console.log('PASS: Lyrica timing, script filtering, plain results, coalescing, caching, no cookies, exact provider selection and bounded responses');
}finally{globalThis.fetch=original;}
