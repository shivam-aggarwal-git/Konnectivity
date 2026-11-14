"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Smile} from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import {emojiPlacement} from '@/lib/emoji-placement.mjs';
export default function EmojiMenuButton({onSelect,label='Choose a reaction'}:{onSelect:(emoji:string)=>void;label?:string}){
 const [open,setOpen]=useState(false),[anchor,setAnchor]=useState({left:8,top:8,width:320,maxHeight:420});const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};},[open]);
 return <><button ref={trigger} type="button" className="kn-all-emoji-button" aria-label={label} title={label} aria-expanded={open} onClick={()=>{const box=trigger.current?.getBoundingClientRect();if(box){const container=trigger.current?.closest('[role="dialog"]')||document.querySelector('.kn-expanded-player');setAnchor(emojiPlacement(box,container?.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight}));}setOpen(value=>!value);}}><Smile size={19}/></button>{open&&createPortal(<div ref={panel} className="kn-anchored-emoji" style={{position:'fixed',...anchor,zIndex:2147483000}}><EmojiPicker onSelect={emoji=>{onSelect(emoji);setOpen(false);}}/></div>,trigger.current?.closest('[role="dialog"]')||document.querySelector('.kn-expanded-player')||document.body)}</>;
}
