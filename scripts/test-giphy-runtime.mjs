import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'kn-giphy-'));process.env.DATA_DIR=directory;
// Synthetic key and mocked transport: no configured credentials leave this process.
process.env.GIPHY_API_KEY='synthetic-test-key';
const {searchGiphy}=await import('../lib/giphy-service.mjs');const {selectedGiphy}=await import('../lib/giphy.mjs');const original=globalThis.fetch;let calls=0;
try{globalThis.fetch=async endpoint=>{const url=new URL(endpoint);assert.equal(url.hostname,'api.giphy.com');assert.equal(url.searchParams.get('api_key'),'synthetic-test-key');calls++;return Response.json({data:[{id:'abc123',title:'Fixture',images:{fixed_width:{url:'https://media0.giphy.com/media/abc123/200w.gif'}}}],pagination:{total_count:1}});};
 const response=await searchGiphy('hello');assert.equal(response.gifs.length,1);await searchGiphy('hello');assert.equal(calls,1);assert.ok(selectedGiphy({id:'abc123',url:response.gifs[0].images.fixed_width.url}));assert.equal(selectedGiphy({id:'abc123',url:'https://example.com/media/abc123/200w.gif'}),null);console.log('PASS: runtime GIPHY key, server search, caching, sendable GIF metadata and untrusted URL rejection');
}finally{globalThis.fetch=original;rmSync(directory,{recursive:true,force:true});}
