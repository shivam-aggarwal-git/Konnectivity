import {relatedSongs,searchSongs} from './ytmusic.mjs';
import {matchingRecommendations,artistAffinity} from './recommendation-match.mjs';
export async function recommendedTracks(seed,{limit=20,exclude=[]}={}){
 if(!seed?.title||seed.isShort)return [];
 const seen=new Set([seed.videoId,...exclude]);
 let candidates=[];
 try{if(/^[\w-]{11}$/.test(seed.videoId||''))candidates=await relatedSongs(seed.videoId,40);}catch{}
 let valid=matchingRecommendations(candidates,seed).filter(t=>!seen.has(t.videoId));
 if(!valid.length){
  const artist=seed.artist&&seed.artist!=='Unknown'?seed.artist:'';
  // Recover artist metadata from the chosen recording, never search for 'Unknown'.
  const matches=await searchSongs(`${seed.title} ${artist}`.trim(),10);
  const resolved=matches.find(t=>t.videoId===seed.videoId)||matches.find(t=>t.artist&&t.artist!=='Unknown');
  const actualArtist=artist||resolved?.artist;
  if(actualArtist)valid=matchingRecommendations(await searchSongs(actualArtist,40),{...seed,artist:actualArtist}).filter(t=>!seen.has(t.videoId)&&artistAffinity(t,{artist:actualArtist})>0);
 }
 return [...new Map(valid.map(t=>[t.videoId,t])).values()].sort((a,b)=>artistAffinity(b,seed)-artistAffinity(a,seed)).slice(0,limit);
}
