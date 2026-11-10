"use client";

import {useEffect, useRef, useState} from "react";
import {Users, UserPlus, ShieldCheck} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "./ui/dialog";
import {Avatar} from "./ui/avatar";
import type {Participant, PendingRequest} from "@/lib/types";

const action = "sw-focus min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10";
export default function RoomPeople({list, you, isHost, pending, inviteOnly, discoverable, onApprovalChange, onApprove, onDeny, onKick, onMute}: {
 list: Participant[]; you:string|null; isHost:boolean; pending:PendingRequest[]; inviteOnly:boolean; discoverable:boolean;
 onApprovalChange:(enabled:boolean)=>void; onApprove:(id:string)=>void; onDeny:(id:string)=>void;
 onKick:(id:string)=>void; onMute:(id:string,muted:boolean)=>void;
}) {
 const [people,setPeople]=useState(false),[requests,setRequests]=useState(false),[removing,setRemoving]=useState<string|null>(null);
 const seen=useRef(new Set<string>());
 useEffect(()=>{
   const fresh=pending.some(p=>!seen.current.has(p.id));
   seen.current=new Set(pending.map(p=>p.id));
   if(isHost&&fresh){setPeople(false);setRequests(true);}
   if(!pending.length)setRequests(false);
 },[pending,isHost]);
 return <>
  <button className={action+" flex items-center gap-2"} onClick={()=>setPeople(true)} aria-label={`People, ${list.length} listening`}><Users className="size-4"/><span>{list.length}</span></button>
  {isHost&&pending.length>0&&<button className={action+" flex items-center gap-2 bg-accent-soft"} onClick={()=>setRequests(true)}><UserPlus className="size-4"/><span>{pending.length} waiting</span></button>}
  <Dialog open={requests&&isHost} onOpenChange={setRequests}>
   <DialogContent overlayClassName="z-[100]" className="z-[110] w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-6">
    <DialogTitle className="pr-10 leading-snug">Someone wants to join</DialogTitle>
    <DialogDescription className="text-muted">Let them into your listening room, or decline their request. They cannot listen or read chat until approved.</DialogDescription>
    <ul className="space-y-3" aria-live="polite">{pending.map(p=><li key={p.id} className="rounded-2xl border border-white/10 p-3">
     <div className="mb-3 flex min-w-0 items-center gap-3"><Avatar name={p.nick} size="sm"/><span className="min-w-0 break-words font-semibold">{p.nick}</span></div>
     <div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>onDeny(p.id)} aria-label={`Decline ${p.nick}`}>Decline</button><button className={action+" bg-accent-soft text-[var(--accent-2)]"} onClick={()=>onApprove(p.id)} aria-label={`Approve ${p.nick}`}>Let in</button></div>
    </li>)}</ul>
   </DialogContent>
  </Dialog>
  <Dialog open={people} onOpenChange={open=>{setPeople(open);if(!open)setRemoving(null);}}>
   <DialogContent overlayClassName="z-[100]" className="z-[110] w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-6">
    <DialogTitle className="pr-10">People in your room</DialogTitle>
    <DialogDescription className="text-muted">{list.length} listening together{isHost?" · You manage this room":""}</DialogDescription>
    {isHost&&<label className="flex items-start gap-3 rounded-2xl border border-white/10 p-3"><ShieldCheck className="mt-1 size-5 shrink-0"/><span className="flex-1 text-sm"><strong className="block">Approve new joins</strong><span className="text-muted">{discoverable ? "Approval is required while random matching is on." : "Show a popup before new listeners enter."}</span></span><input type="checkbox" className="mt-1 size-6 shrink-0 accent-[var(--accent)]" checked={inviteOnly} disabled={discoverable} onChange={e=>onApprovalChange(e.target.checked)}/></label>}
    {isHost&&pending.length>0&&<button className={action} onClick={()=>{setPeople(false);setRequests(true);}}>Review {pending.length} join request{pending.length===1?"":"s"}</button>}
    <ul className="space-y-3">{list.map(p=><li key={p.id} className="rounded-2xl border border-white/10 p-3">
     <div className="flex min-w-0 items-center gap-3"><Avatar name={p.nick} size="sm" isHost={p.isHost} status={p.status}/><div className="min-w-0 flex-1"><p className="break-words font-semibold">{p.nick}{p.id===you?" (you)":""}</p><p className="text-xs text-muted">{p.isHost?"Host":p.muted?"Chat muted":p.status||"Listening"}</p></div></div>
     {isHost&&p.id!==you&&!p.isHost&&<div className="mt-3">
      {removing===p.id?<><p className="mb-2 text-sm">Remove {p.nick}? They will be disconnected and temporarily blocked from rejoining.</p><div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>setRemoving(null)}>Cancel</button><button className={action+" text-[var(--destructive)]"} onClick={()=>{onKick(p.id);setRemoving(null);}}>Remove now</button></div></>:<div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>onMute(p.id,!p.muted)}>{p.muted?"Unmute chat":"Mute chat"}</button><button className={action+" text-[var(--destructive)]"} onClick={()=>setRemoving(p.id)} aria-label={`Remove ${p.nick}`}>Remove</button></div>}
     </div>}
    </li>)}</ul>
   </DialogContent>
  </Dialog>
 </>;
}
