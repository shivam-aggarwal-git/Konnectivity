"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Smile} from 'lucide-react';
import EmojiPicker from './EmojiPicker';
export default function EmojiMenuButton({onSelect,label='Choose a reaction'}:{onSelect:(emoji:string)=>void;label?:string}){
 const [open,setOpen]=useState(false),[anchor,setAnchor]=useState({left:8,top:8});const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};},[open]);
 return <><button ref={trigger} type="button" className="kn-all-emoji-button" aria-label={label} title={label} aria-expanded={open} onClick={()=>{const box=trigger.current?.getBoundingClientRect();if(box)setAnchor({left:Math.max(8,Math.min(window.innerWidth-328,box.right-320)),top:Math.max(8,box.top-Math.min(420,window.innerHeight*.5)-8)});setOpen(value=>!value);}}><Smile size={19}/></button>{open&&createPortal(<div ref={panel} className="kn-anchored-emoji" style={{position:'fixed',...anchor,zIndex:2147483000}}><EmojiPicker onSelect={emoji=>{onSelect(emoji);setOpen(false);}}/></div>,trigger.current?.closest('[role="dialog"]')||document.querySelector('.kn-expanded-player')||document.body)}</>;
}
