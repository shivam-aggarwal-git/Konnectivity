"use client";
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
export default function MoveTrack({title,index,total,onMove}:{title:string;index:number;total:number;onMove:(position:number)=>void}){
 const[open,setOpen]=useState(false),[position,setPosition]=useState('');
 if(total<2)return null;
 return <><button type="button" className="kn-move-track" aria-label={`Move ${title} to position`} onClick={e=>{e.stopPropagation();setPosition(String(index+1));setOpen(true);}}>Move</button><Dialog open={open} onOpenChange={setOpen}><DialogContent overlayClassName="z-[120]" className="z-[130] max-w-sm"><DialogTitle className="pr-10">Move song</DialogTitle><DialogDescription className="break-words text-muted">{title} · currently {index+1} of {total}</DialogDescription><form className="flex flex-col gap-3" onSubmit={e=>{e.preventDefault();const target=Number(position);if(Number.isInteger(target)&&target>=1&&target<=total){onMove(target-1);setOpen(false);}}}><label className="text-sm">New position<input className="sw-library-field mt-2 w-full" aria-label="New song position" type="number" inputMode="numeric" min={1} max={total} step={1} required value={position} onChange={e=>setPosition(e.target.value)}/></label><button type="submit" className="kn-background-upload">Move to position {position||'…'}</button></form></DialogContent></Dialog></>;
}
