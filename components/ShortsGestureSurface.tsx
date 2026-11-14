'use client';
import{useEffect,useRef}from'react';
import{verticalSwipe}from'@/lib/swipe-direction.mjs';
type Point={x:number;y:number};
export default function ShortsGestureSurface({onNext,onPrevious,onTap}:{onNext?:()=>void;onPrevious?:()=>void;onTap:()=>void}){
 const button=useRef<HTMLButtonElement>(null),start=useRef<Point|null>(null),handled=useRef(false),suppressClick=useRef(0),latest=useRef({onNext,onPrevious,onTap});latest.current={onNext,onPrevious,onTap};
 function move(point:Point){if(!start.current||handled.current)return false;const direction=verticalSwipe(start.current,point);if(!direction)return false;handled.current=true;suppressClick.current=Date.now()+1000;if(direction>0)latest.current.onNext?.();else latest.current.onPrevious?.();return true;}
 // Non-passive native touch listeners keep iOS from turning a Short swipe into
 // document scrolling or cancelling the pointer stream inside the embed.
 useEffect(()=>{const target=button.current;if(!target)return;
  const begin=(event:TouchEvent)=>{const touch=event.touches[0];if(!touch)return;start.current={x:touch.clientX,y:touch.clientY};handled.current=false;event.preventDefault();event.stopPropagation();};
  const slide=(event:TouchEvent)=>{const touch=event.touches[0];if(touch)move({x:touch.clientX,y:touch.clientY});event.preventDefault();event.stopPropagation();};
  const end=(event:TouchEvent)=>{const touch=event.changedTouches[0];if(touch)move({x:touch.clientX,y:touch.clientY});if(start.current&&!handled.current)latest.current.onTap();start.current=null;suppressClick.current=Date.now()+1000;event.preventDefault();event.stopPropagation();};
  const cancel=()=>{start.current=null;handled.current=false;};
  const options={capture:true,passive:false};target.addEventListener('touchstart',begin,options);target.addEventListener('touchmove',slide,options);target.addEventListener('touchend',end,options);target.addEventListener('touchcancel',cancel,options);
  return()=>{target.removeEventListener('touchstart',begin,true);target.removeEventListener('touchmove',slide,true);target.removeEventListener('touchend',end,true);target.removeEventListener('touchcancel',cancel,true);};
 },[]);
 return <button ref={button} type="button" className="kn-short-gesture-surface" aria-label="Shorts controls: swipe up for next, down for previous; tap to play or pause" onPointerDown={e=>{if(e.pointerType==='touch')return;start.current={x:e.clientX,y:e.clientY};handled.current=false;e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();}} onPointerMove={e=>{if(e.pointerType!=='touch'&&move({x:e.clientX,y:e.clientY})){e.preventDefault();e.stopPropagation();}}} onPointerUp={e=>{if(e.pointerType==='touch')return;move({x:e.clientX,y:e.clientY});if(start.current&&!handled.current)latest.current.onTap();start.current=null;suppressClick.current=Date.now()+1000;e.preventDefault();e.stopPropagation();}} onPointerCancel={()=>{start.current=null;}} onClick={e=>{if(e.detail===0&&Date.now()>suppressClick.current)latest.current.onTap();e.preventDefault();}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();if(e.key==='ArrowDown')latest.current.onNext?.();else latest.current.onPrevious?.();}}}/>;
}
