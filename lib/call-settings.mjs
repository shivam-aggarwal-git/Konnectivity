import {loadSync,saveNow} from './store.mjs';
export const CALL_FIELDS=['CALL_STUN_URL','CALL_TURN_URL','CALL_TURN_SECRET','CALL_RELAY_ONLY','CALL_CF_KEY_ID','CALL_CF_API_TOKEN','CALL_CF_ACCOUNT_ID','CALL_CF_ANALYTICS_TOKEN'];
const saved=loadSync('call-settings',{});
for(const key of CALL_FIELDS)if(typeof saved[key]==='string')process.env[key]=saved[key];
export function callSettingsStatus(){return Object.fromEntries(CALL_FIELDS.map(k=>[k,/SECRET|TOKEN|KEY_ID/.test(k)?Boolean(process.env[k]):process.env[k]||'']));}
export async function updateCallSettings(patch){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid settings.');const next={...Object.fromEntries(CALL_FIELDS.map(k=>[k,process.env[k]||''])),...saved};for(const [k,v] of Object.entries(patch)){if(!CALL_FIELDS.includes(k)||typeof v!=='string'||v.length>4096||/[\r\n]/.test(v))throw Error('Invalid setting.');if(k==='CALL_RELAY_ONLY'&&!['true','false',''].includes(v))throw Error('Choose a valid relay mode.');if(k==='CALL_STUN_URL'&&v&&!/^stuns?:[^\s]+$/.test(v))throw Error('Enter a STUN URL.');if(k==='CALL_TURN_URL'&&v&&!v.split(',').every(x=>/^turns?:[^\s]+$/.test(x.trim())))throw Error('Enter comma-separated TURN URLs.');next[k]=v.trim();}if(next.CALL_RELAY_ONLY==='true'&&!((next.CALL_TURN_URL&&next.CALL_TURN_SECRET)||(next.CALL_CF_KEY_ID&&next.CALL_CF_API_TOKEN)))throw Error('Configure a relay before enabling relay-only mode.');await saveNow('call-settings',next);Object.assign(saved,next);for(const k of CALL_FIELDS)if(k in next)process.env[k]=next[k];return callSettingsStatus();}
export async function testCallConfiguration(){
 const {checkTurnBudget}=await import('./turn-budget.mjs');
 const usage=await checkTurnBudget();
 if(!(process.env.CALL_CF_KEY_ID&&process.env.CALL_CF_API_TOKEN))throw Error('Cloudflare TURN credentials are not configured.');
 const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(process.env.CALL_CF_KEY_ID)}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CALL_CF_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:300}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Cloudflare rejected the TURN credentials.');
 const data=await r.json();const relays=(data.iceServers||[]).filter(s=>s.credential&&[s.urls].flat().some(u=>/^turns?:/.test(u)));
 if(!relays.length)throw Error('Cloudflare did not return a usable relay.');
 return {ok:true,provider:'Cloudflare TURN',usedGB:(usage?.usedBytes||0)/1e9,limitGB:750,checkedAt:Date.now()};
}
