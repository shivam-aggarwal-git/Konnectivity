import {getSettings} from './settings.mjs';
const cache=new Map();
export function giphyConfigured(){return Boolean(process.env.GIPHY_API_KEY?.trim()||process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim()||getSettings().giphyApiKey);}
export async function searchGiphy(query='',offset=0){
 const key=process.env.GIPHY_API_KEY?.trim()||process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim()||getSettings().giphyApiKey;
 if(!key)throw Error('Configure GIPHY in server settings.');
 const term=String(query).trim().slice(0,70),start=Math.max(0,Math.min(1000,Number(offset)||0));
 const cacheKey=JSON.stringify([term,start]);const hit=cache.get(cacheKey);if(hit&&Date.now()-hit.at<60000)return hit.value;
 const url=new URL(`https://api.giphy.com/v1/gifs/${term?'search':'trending'}`);url.search=new URLSearchParams({api_key:key,limit:'18',offset:String(start),rating:'pg-13',...(term?{q:term}:{})}).toString();
 const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('GIPHY is unavailable. Check the server configuration.');
 const payload=await response.json();const value={gifs:Array.isArray(payload.data)?payload.data:[],total:Number(payload.pagination?.total_count)||0};
 cache.set(cacheKey,{at:Date.now(),value});if(cache.size>100)cache.delete(cache.keys().next().value);return value;
}
