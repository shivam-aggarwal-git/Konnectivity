'use client';
import {useEffect,useState} from 'react';
import {Play,RefreshCw} from 'lucide-react';
import type{Track}from'@/lib/types';
export default function VideoSuggestions({track,onPlay}:{track:Track;onPlay:(track:Track)=>void}){
 const[rows,setRows]=useState<Track[]>([]),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(track.isShort)return;let active=true;setLoading(true);setRows([]);const query=new URLSearchParams({videoId:track.videoId,title:track.title,artist:track.artist});fetch(`/api/video-recommend?${query}`).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(active)setRows(data.results||[]);}).catch(()=>{}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[track.videoId,track.title,track.artist,track.isShort,retry]);
 if(track.isShort)return null;
 return <section className="kn-video-suggestions" aria-label="Watch next inside Konnectivity"><div><strong>Watch next</strong><button type="button" aria-label="Refresh recommended videos" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/></button></div>{loading?<p role="status">Finding related videos…</p>:!rows.length?<p>Related videos are unavailable. Search for another video above.</p>:<ul>{rows.map(row=><li key={row.videoId}><button type="button" aria-label={`Watch ${row.title} inside Konnectivity`} onClick={()=>onPlay({...row,mediaType:'video'})}><img src={row.thumbnail} alt="" loading="lazy"/><span><strong>{row.title}</strong><small>{row.artist}</small></span><Play size={17}/></button></li>)}</ul>}</section>;
}
