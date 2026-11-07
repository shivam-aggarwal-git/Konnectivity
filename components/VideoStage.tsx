"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {RotateCcw,Maximize,Minimize,Eye,EyeOff} from 'lucide-react';
export default function VideoStage({children,transport,onReplay,hidden,onToggle}:{children:ReactNode;transport:ReactNode;onReplay:()=>void;hidden:boolean;onToggle:()=>void}){
 const[full,setFull]=useState(false);
 useEffect(()=>{if(!full)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setFull(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[full]);
 return <div className="kn-video-stage" data-fullscreen={full} data-controls-hidden={hidden}><div className="kn-video-toolbar">{!hidden&&<button onClick={onReplay} title="Replay from the start" aria-label="Replay video"><RotateCcw size={17}/></button>}<button onClick={()=>setFull(v=>!v)} title={full?'Exit fullscreen':'Fullscreen'} aria-label={full?'Exit fullscreen video':'Fullscreen video'}>{full?<Minimize size={17}/>:<Maximize size={17}/>}</button><button onClick={onToggle} title={hidden?'Show media controls':'Hide media controls'} aria-label={hidden?'Show media controls':'Hide media controls'}>{hidden?<Eye size={17}/>:<EyeOff size={17}/>}</button></div>{children}{full&&!hidden&&<div className="kn-fullscreen-transport">{transport}</div>}</div>;
}
