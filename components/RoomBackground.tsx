"use client";
import {useState} from 'react';
import {useAppearance} from '@/hooks/useAppearance';
function artworkUrl(value?:string){try{const u=new URL(value||'');return u.protocol==='https:'?u.href:'';}catch{return '';}}
export default function RoomBackground({mediaQuery,artwork,videoId}:{mediaQuery:string;artwork?:string;videoId?:string}){
 const p=useAppearance();const[failed,setFailed]=useState<Record<string,boolean>>({});
 const candidates=p.background==='photo'&&p.backgroundImageId?[`/chat-media/${p.backgroundImageId}${mediaQuery}`]:p.background==='artwork'?[artworkUrl(artwork),videoId&&/^[\w-]{11}$/.test(videoId)?`/api/artwork?videoId=${encodeURIComponent(videoId)}`:'']:[];
 const source=candidates.find(value=>value&&!failed[value]);
 if(!source)return null;
 return <div className="kn-room-background" aria-hidden="true"><img src={source} alt="" onError={()=>setFailed(previous=>({...previous,[source]:true}))}/><div className="kn-background-shade" style={{opacity:p.backgroundDim}}/></div>;
}
