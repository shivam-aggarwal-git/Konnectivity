"use client";
import {useState} from 'react';
import {useAppearance} from '@/hooks/useAppearance';
function artworkUrl(value?:string){try{const u=new URL(value||'');return u.protocol==='https:'?u.href:'';}catch{return '';}}
export default function RoomBackground({mediaQuery,artwork}:{mediaQuery:string;artwork?:string}){
 const p=useAppearance();const[failed,setFailed]=useState('');
 const source=p.background==='photo'&&p.backgroundImageId?`/chat-media/${p.backgroundImageId}${mediaQuery}`:p.background==='artwork'?artworkUrl(artwork):'';
 if(!source||source===failed)return null;
 return <div className="kn-room-background" aria-hidden="true"><img src={source} alt="" onError={()=>setFailed(source)}/><div className="kn-background-shade" style={{opacity:p.backgroundDim}}/></div>;
}
