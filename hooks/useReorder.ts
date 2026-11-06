"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
export type ReorderState={activeKey:string|null;offsetY:number;targetIndex:number;fromIndex:number};
const IDLE:ReorderState={activeKey:null,offsetY:0,targetIndex:-1,fromIndex:-1};
/** Pointer drag with edge autoscroll; keyboard and exact-position actions complement it. */
export function useReorder(onDrop:(key:string,toIndex:number)=>void){
 const[state,setState]=useState<ReorderState>(IDLE);
 const drag=useRef<{key:string;from:number;count:number;startY:number;y:number;rowH:number;scroll:HTMLElement|null;startScroll:number;target:number;moved:boolean;raf:number}|null>(null);
 const recalc=useCallback(()=>{const d=drag.current;if(!d)return;const offsetY=d.y-d.startY+(d.scroll?d.scroll.scrollTop-d.startScroll:0);if(Math.abs(offsetY)>3)d.moved=true;d.target=Math.max(0,Math.min(d.count-1,d.from+Math.round(offsetY/d.rowH)));setState({activeKey:d.key,offsetY,targetIndex:d.target,fromIndex:d.from});},[]);
 const cancel=useCallback(()=>{const d=drag.current;if(d)cancelAnimationFrame(d.raf);drag.current=null;setState(IDLE);},[]);
 useEffect(()=>()=>{if(drag.current)cancelAnimationFrame(drag.current.raf);},[]);
 const start=useCallback((e:React.PointerEvent,key:string,index:number,count:number)=>{
  if(e.button!==0)return;
  const row=e.currentTarget.closest('li');let scroll=row?.parentElement||null;
  while(scroll&&scroll.scrollHeight<=scroll.clientHeight)scroll=scroll.parentElement;
  drag.current={key,from:index,count,startY:e.clientY,y:e.clientY,rowH:row?.getBoundingClientRect().height||56,scroll,startScroll:scroll?.scrollTop||0,target:index,moved:false,raf:0};
  e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();recalc();
  const tick=()=>{const d=drag.current;if(!d)return;if(d.scroll){const bounds=d.scroll.getBoundingClientRect();const speed=d.y<bounds.top+44?-Math.min(12,(bounds.top+44-d.y)/4):d.y>bounds.bottom-44?Math.min(12,(d.y-bounds.bottom+44)/4):0;if(speed){d.scroll.scrollTop+=speed;recalc();}}d.raf=requestAnimationFrame(tick);};
  drag.current.raf=requestAnimationFrame(tick);
 },[recalc]);
 const move=useCallback((e:React.PointerEvent)=>{if(drag.current){drag.current.y=e.clientY;recalc();}},[recalc]);
 const end=useCallback((e:React.PointerEvent)=>{const d=drag.current;if(!d)return;try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}cancel();if(d.moved&&d.target!==d.from)onDrop(d.key,d.target);},[cancel,onDrop]);
 const shiftFor=useCallback((index:number)=>{if(!state.activeKey||index===state.fromIndex)return 0;const h=drag.current?.rowH||56;return state.fromIndex<state.targetIndex&&index>state.fromIndex&&index<=state.targetIndex?-h:state.fromIndex>state.targetIndex&&index<state.fromIndex&&index>=state.targetIndex?h:0;},[state]);
 return{state,start,move,end,cancel,shiftFor};
}
