import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'kn-turn-budget-'));process.env.DATA_DIR=dir;
const {queryTurnUsage,checkTurnBudget}=await import('../lib/turn-budget.mjs');
const accountId='a'.repeat(32),token='fixture-not-a-real-token';
let mode='under',requests=0;const fetcher=async(url,options)=>{requests++;assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');const query=JSON.parse(options.body).query;assert.match(query,/date_geq: "2026-11-01"/);assert.match(query,/egressBytes/);if(mode==='error')return {ok:false};if(mode==='invalid')return {ok:true,json:async()=>({errors:[{message:'unauthorized'}]})};return {ok:true,json:async()=>({data:{viewer:{accounts:[{callsTurnUsageAdaptiveGroups:[{sum:{egressBytes:mode==='limit'?750000000000:749999999999}}]}]}}})};};
try{
 const now=new Date('2026-11-07T12:00:00Z');assert.equal((await queryTurnUsage({accountId,token,now,fetcher})).blocked,false);mode='limit';assert.equal((await queryTurnUsage({accountId,token,now,fetcher})).blocked,true);
 mode='error';await assert.rejects(queryTurnUsage({accountId,token,now,fetcher}),/paused/);mode='invalid';await assert.rejects(queryTurnUsage({accountId,token,now,fetcher}),/Analytics/);
 process.env.CALL_CF_KEY_ID='test';process.env.CALL_CF_API_TOKEN=token;process.env.CALL_CF_ACCOUNT_ID=accountId;
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({data:{viewer:{accounts:[{callsTurnUsageAdaptiveGroups:[{sum:{egressBytes:750000000000}}]}]}}})});
 try{await assert.rejects(checkTurnBudget(),/750 GB/);globalThis.fetch=async()=>{throw Error('should not reopen');};await assert.rejects(checkTurnBudget(),/750 GB/);}finally{globalThis.fetch=original;}
 console.log('PASS: 750 decimal GB threshold, UTC month boundaries, authoritative account egress aggregation, fail-closed analytics and persisted monthly cutoff latch.');
}finally{rmSync(dir,{recursive:true,force:true});}
