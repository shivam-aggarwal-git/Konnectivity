"use client";
import {useRef,type TouchEvent} from 'react';
export function usePlayerSwipe({onUp,onDown,zone}:{onUp:()=>void;onDown:()=>void;zone?:string}){
 const start=useRef<{x:number;y:number}|null>(null);
 return {
  onTouchStart:(event:TouchEvent)=>{
   const target=event.target as HTMLElement;
   if(!matchMedia('(max-width: 767px)').matches||event.touches.length!==1||target.closest('input,textarea,select,[role="slider"]')||(zone&&!target.closest(zone))){start.current=null;return;}
   start.current={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },
  onTouchEnd:(event:TouchEvent)=>{const origin=start.current;start.current=null;if(!origin||!event.changedTouches[0])return;const dx=event.changedTouches[0].clientX-origin.x,dy=event.changedTouches[0].clientY-origin.y;if(Math.abs(dy)<65||Math.abs(dy)<Math.abs(dx)*1.4)return;event.preventDefault();if(dy<0)onUp();else onDown();},
  onTouchCancel:()=>{start.current=null;},
 };
}
