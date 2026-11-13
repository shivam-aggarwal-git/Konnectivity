"use client";
import {useAppearance} from '@/hooks/useAppearance';
export default function AmbientVisualizer({playing,art=false,room=false,preview}:{playing:boolean;art?:boolean;room?:boolean;preview?:{visualizer:string;motion:boolean}}){
 const shared=useAppearance();const p=preview||shared;if(p.visualizer==='off')return null;
 return <div className={`kn-ambient-viz ${room?'kn-viz-room':art?'kn-viz-art':'kn-viz-strip'}`} data-style={p.visualizer} data-moving={playing&&p.motion} aria-hidden="true">{Array.from({length:p.visualizer==='tunnel'?6:p.visualizer==='rings'||p.visualizer==='orbit'?5:24},(_,i)=><i key={i} style={{'--i':i,'--h':`${15+Math.round(Math.sin(i*.7)**2*65)}%`,'--x':`${8+(i*37%85)}%`,'--y':`${10+(i*23%80)}%`} as React.CSSProperties}/>)}</div>;
}
