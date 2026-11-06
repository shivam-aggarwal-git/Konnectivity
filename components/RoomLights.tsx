"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import {useAppearance} from '@/hooks/useAppearance';

/** Visual atmosphere only: never attaches processing to the audio output. */
export default function RoomLights({position,playing}:{position:number;playing:boolean}) {
  const p=useAppearance();
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{
    const q=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(q.matches);update();
    q.addEventListener('change',update);return()=>q.removeEventListener('change',update);
  },[]);
  if(p.lights==='off')return null;
  const moving=p.motion&&!reduced;
  const pulse=p.lights==='breathe'&&moving&&playing;
  const phase=position*Math.PI/2;
  const style={
    '--light-strength':pulse ? .42+.32*(.5+.5*Math.sin(phase)):.48,
    '--light-shift':`${pulse?Math.sin(phase/2)*12:0}%`,
  } as CSSProperties;
  return <div className="kn-room-lights" data-moving={moving} data-pulsing={pulse} style={style} aria-hidden="true">
    <div className="kn-light-wash kn-light-left"/>
    <div className="kn-light-wash kn-light-right"/>
    <div className="kn-light-ribbon"/>
    <div className="kn-light-dust">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div>
  </div>;
}
