import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
const directory=await mkdtemp(path.join(tmpdir(),'kn-personal-youtube-'));process.env.DATA_DIR=directory;
try {
 const {storeRoomCookies,storePersonalCookies,clearPersonalCookies,downloadContext,needsYoutubeCookie}=await import('../lib/room-credentials.mjs');
 const {handleMemberCookies}=await import('../lib/member-cookies-http.mjs');
 const alice={id:'alice',status:'listening',uploadToken:'alice-private-upload-token',mediaIdentity:'alice-persistent-identity'};
 const bob={id:'bob',status:'listening',uploadToken:'bob-private-upload-token',mediaIdentity:'bob-persistent-identity'};
 const room={code:'ABC123',roomScoped:true,requireYoutubeCookie:true,participants:new Map([[alice.id,alice],[bob.id,bob]])};
 const cookie=value=>`.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\t${value}\n`;
 storeRoomCookies(room.code,cookie('host-value'));storePersonalCookies(room,alice,cookie('alice-value'));storePersonalCookies(room,bob,cookie('bob-value'));
 const host=downloadContext(room),a=downloadContext(room,alice),b=downloadContext(room,bob);
 assert.equal(a.contents.toString(),cookie('alice-value'));assert.equal(b.contents.toString(),cookie('bob-value'));
 assert.notEqual(a.prefix,b.prefix);assert.notEqual(a.prefix,host.prefix);
 clearPersonalCookies(room,alice);assert.equal(downloadContext(room,alice).prefix,host.prefix);assert.equal(downloadContext(room,bob).prefix,b.prefix);
 async function request(method,token,body='') {const req=Readable.from([Buffer.from(body)]);req.url='/api/member-cookies?room=ABC123';req.method=method;req.headers={'x-upload-token':token};let status,result;await handleMemberCookies(req,{writeHead(code){status=code;},end(value){result=JSON.parse(value);}},code=>code===room.code?room:null);return {status,result};}
 assert.equal((await request('GET','not-a-member')).status,403);
 const response=await request('GET',bob.uploadToken);assert.equal(response.status,200);assert.deepEqual(response.result,{present:true,fallback:'host'});assert(!JSON.stringify(response).includes('bob-value'));
 assert.equal((await request('POST',bob.uploadToken,'invalid cookie')).status,400);assert.equal(downloadContext(room,bob).prefix,b.prefix);
 assert.equal((await request('DELETE',alice.uploadToken)).status,200);assert.equal(downloadContext(room,bob).prefix,b.prefix);
 const {clearRoomCookies}=await import('../lib/room-credentials.mjs');clearRoomCookies(room.code);
 assert.equal(needsYoutubeCookie(room,'M7lc1UVf-VE',alice),true);assert.equal(needsYoutubeCookie(room,'M7lc1UVf-VE',bob),false);
 console.log('Personal cookie authorization, isolation, fallback and invalid-upload checks passed.');
}finally {await rm(directory,{recursive:true,force:true});}
