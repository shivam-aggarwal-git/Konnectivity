const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
export const isGeneratedTrack=track=>track?.addedBy==='Autoplay'||track?.autoplay===true;
export function recommendationSeed(room){
 if(room.current&&!isGeneratedTrack(room.current)&&!room.current.isShort)return room.current;
 if(room.recommendationSeed&&!room.recommendationSeed.isShort)return room.recommendationSeed;
 return [...(room.history||[])].reverse().find(track=>!isGeneratedTrack(track)&&!track.isShort)||room.queue?.find(track=>!isGeneratedTrack(track)&&!track.isShort)||null;
}
export function matchingRecommendations(tracks,seed){
 if(!seed)return [];
 const allowCjk=cjk.test(`${seed.title||''} ${seed.artist||''}`);
 return tracks.filter(track=>track?.videoId&&track.title&&track.title!=='Unknown'&&track.artist&&track.artist!=='Unknown'&&track.duration>0&&track.videoId!==seed.videoId&&!track.isShort&&(allowCjk||!cjk.test(`${track.title} ${track.artist}`)));
}
export function keepQueueTrack(track,seed){
 // Preserve every listener-selected item. Discard stale generated suggestions only.
 return !isGeneratedTrack(track)||Boolean(seed&&track.recommendationSeedId===seed.videoId&&matchingRecommendations([track],seed).length);
}

export function artistAffinity(track,seed){const words=value=>new Set(String(value||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(' ').filter(w=>w.length>2&&!['unknown','various','artists','feat','official','music'].includes(w)));const a=words(track.artist),b=words(seed.artist);return [...a].filter(w=>b.has(w)).length;}
