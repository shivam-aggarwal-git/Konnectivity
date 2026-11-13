"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Smile} from 'lucide-react';
import {ReactionBar} from './BottomPlayer';

/** A movable control stays above the focus player, but yields to other controls. */
export default function FloatingReactions({onReact}:{onReact:(emoji:string)=>void}){
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 const position=useRef({x:0,y:0}),drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null),suppress=useRef(false);
 const checkCollision=useRef<()=>void>(()=>{});
 const [host,setHost]=useState<HTMLElement|null>(null);
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[covered,setCovered]=useState(false);
 useEffect(()=>{
  setMounted(true);
  const place=(reset=false)=>{const width=window.innerWidth,height=window.visualViewport?.height||window.innerHeight;let saved=null;try{saved=reset?null:JSON.parse(localStorage.getItem('kn-reaction-position')||'null');}catch{}
   position.current={x:Math.max(8,Math.min(width-52,saved?.x??width-52)),y:Math.max(8,Math.min(height-52,saved?.y??height*.52))};
   if(root.current)root.current.style.transform=`translate3d(${position.current.x}px,${position.current.y}px,0)`;
  };
  const reset=()=>{try{localStorage.removeItem('kn-reaction-position');}catch{}place(true);};
  const frame=requestAnimationFrame(()=>place());window.addEventListener('resize',reset);window.visualViewport?.addEventListener('resize',reset);window.addEventListener('konnectivity:reset-reaction-position',reset);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',reset);window.visualViewport?.removeEventListener('resize',reset);window.removeEventListener('konnectivity:reset-reaction-position',reset);};
 },[]);
 useEffect(()=>{
  if(!mounted)return;
  const check=()=>{setHost(document.querySelector<HTMLElement>(".kn-expanded-player")||document.body);const box=button.current?.getBoundingClientRect();if(!box)return;
   const overlays=Array.from(document.querySelectorAll<HTMLElement>('.player-volume-popup,[data-playlist-menu],.kn-search-results,[role="dialog"]'));
   const overlap=overlays.some(el=>{if(el.closest('.kn-expanded-player')===el||el.classList.contains('kn-expanded-player'))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top;});setCovered(overlap);
  };
  checkCollision.current=check;check();const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-state','hidden']});window.addEventListener('resize',check);
  return()=>{observer.disconnect();window.removeEventListener('resize',check);};
 },[mounted,open]);
 useEffect(()=>{if(!open)return;const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',escape);};},[open]);
 if(!mounted)return null;
 return createPortal(<div ref={root} className="kn-floating-reactions" data-covered={covered} aria-label="Floating room reactions" style={{transform:`translate3d(${position.current.x}px,${position.current.y}px,0)`}}>
  {open&&!covered&&<ReactionBar className={`kn-floating-reaction-options ${position.current.y<300?"kn-floating-menu-down":""}`} onReact={emoji=>{onReact(emoji);setOpen(false);}}/>}
  <button ref={button} type="button" aria-label="Reactions" title="Reactions · drag to move, or use arrow keys" aria-expanded={open} tabIndex={covered?-1:0}
   onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,left:position.current.x,top:position.current.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>6)d.moved=true;if(!d.moved)return;position.current={x:Math.max(8,Math.min(window.innerWidth-52,d.left+dx)),y:Math.max(8,Math.min((window.visualViewport?.height||window.innerHeight)-52,d.top+dy))};if(root.current)root.current.style.transform=`translate3d(${position.current.x}px,${position.current.y}px,0)`;}}
   onPointerUp={()=>{suppress.current=Boolean(drag.current?.moved);drag.current=null;checkCollision.current();try{localStorage.setItem('kn-reaction-position',JSON.stringify(position.current));}catch{}}}
   onPointerCancel={()=>{drag.current=null;suppress.current=true;}}
   onKeyDown={e=>{const offsets:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};const delta=offsets[e.key];if(!delta)return;e.preventDefault();position.current={x:Math.max(8,Math.min(window.innerWidth-52,position.current.x+delta[0])),y:Math.max(8,Math.min(window.innerHeight-52,position.current.y+delta[1]))};if(root.current)root.current.style.transform=`translate3d(${position.current.x}px,${position.current.y}px,0)`;checkCollision.current();try{localStorage.setItem('kn-reaction-position',JSON.stringify(position.current));}catch{}}}
   onClick={()=>{if(suppress.current){suppress.current=false;return;}setOpen(v=>!v);}}><Smile size={20}/></button>
 </div>,host||document.body);
}
