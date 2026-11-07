import {loadSync,saveNow} from './store.mjs';
const LIMIT=750_000_000_000; // Decimal GB, matching provider bandwidth units.
const latch=loadSync('call-budget',{});let cached=null,pending=null;
export async function queryTurnUsage({accountId,token,now=new Date(),fetcher=fetch}){
 if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!token)throw Error('Cloudflare account analytics must be configured before relay calls are enabled.');
 const month=now.toISOString().slice(0,7),from=month+'-01',to=now.toISOString().slice(0,10);
 const query=`query { viewer { accounts(filter: {accountTag: ${JSON.stringify(accountId)}}) { callsTurnUsageAdaptiveGroups(limit: 1, filter: {date_geq: ${JSON.stringify(from)}, date_leq: ${JSON.stringify(to)}}) { sum { egressBytes } } } } }`;
 const r=await fetcher('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Unable to verify monthly call bandwidth. Calls are paused to protect the usage limit.');
 const data=await r.json(),accounts=data?.data?.viewer?.accounts;
 if(data.errors?.length||!Array.isArray(accounts)||accounts.length!==1||!Array.isArray(accounts[0].callsTurnUsageAdaptiveGroups))throw Error('Cloudflare usage could not be verified. Check Account Analytics permission.');
 let used=0;for(const row of accounts[0].callsTurnUsageAdaptiveGroups){const n=row?.sum?.egressBytes;if(typeof n!=='number'||!Number.isFinite(n)||n<0)throw Error('Invalid Cloudflare usage response. Calls are paused.');used+=n;}
 return {month,accountId,usedBytes:used,limitBytes:LIMIT,checkedAt:Date.now(),blocked:used>=LIMIT};
}
export async function checkTurnBudget(){
 if(!(process.env.CALL_CF_KEY_ID&&process.env.CALL_CF_API_TOKEN))return null;
 const month=new Date().toISOString().slice(0,7);
 if(latch.month===month&&latch.accountId===process.env.CALL_CF_ACCOUNT_ID&&latch.blocked)throw Error('The 750 GB monthly call bandwidth limit has been reached. Calls are disabled until next month.');
 if(cached&&cached.month===month&&cached.accountId===process.env.CALL_CF_ACCOUNT_ID&&Date.now()-cached.checkedAt<15000)return cached;
 if(pending)return pending;
 pending=(async()=>{const result=await queryTurnUsage({accountId:process.env.CALL_CF_ACCOUNT_ID,token:process.env.CALL_CF_ANALYTICS_TOKEN||process.env.CALL_CF_API_TOKEN});
  if(result.blocked){Object.assign(latch,result);await saveNow('call-budget',latch);throw Error('The 750 GB monthly call bandwidth limit has been reached. Calls are disabled until next month.');}
  cached=result;return result;
 })();try{return await pending;}finally{pending=null;}
}
