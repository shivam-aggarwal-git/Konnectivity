"use client";
import {useEffect,useState} from 'react';
import {useAppearance} from '@/hooks/useAppearance';
export default function RoomLights({position,playing}:{position:number;playing:boolean}){const p=useAppearance();const[reduce,setReduce]=useState(false);useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduce(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);if(p.lights==='off')return null;const pulse=p.lights==='breathe'&&p.motion&&!reduce&&playing;const intensity=pulse ? .09+.06*(.5+.5*Math.sin(position*Math.PI/3)):.09;return <div className="kn-room-lights" aria-hidden="true" style={{opacity:intensity}}/>;}
