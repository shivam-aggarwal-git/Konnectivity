// ytmusic-api's Up Next runtime shape differs from its published types.
export function normalizeMusicTrack(song){
 const names=value=>typeof value==='string'?value:Array.isArray(value)?value.map(names).filter(Boolean).join(', '):value?.name||'';
 const raw=song.duration;const duration=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+(?::\d{1,2}){1,2}$/.test(raw)?raw.split(':').reduce((total,n)=>total*60+Number(n),0):Number(raw)||0;
 const thumbnail=song.thumbnails?.at(-1)?.url||song.thumbnail;
 return {videoId:song.videoId,title:song.name||song.title||'',artist:names(song.artists)||names(song.artist)||'Unknown',duration:Number.isFinite(duration)&&duration>=0?duration:0,...(thumbnail&&thumbnail!=='Unknown'?{thumbnail}:{} )};
}
