"use client";

import {useEffect, useRef, useState} from "react";
import {Users, UserPlus, ShieldCheck} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "./ui/dialog";
import type { Socket } from "socket.io-client";
import { EVENTS } from "@/lib/protocol.mjs";
import {Avatar} from "./ui/avatar";
import type {Participant, PendingRequest} from "@/lib/types";

const playbackLabels: Record<string, string> = {
 playing: "Playing", buffering: "Buffering", stopped: "Stopped / paused", blocked: "Playback permission needed",
 interrupted: "Audio interrupted in background", error: "Playback error", checking: "Checking playback", casting: "Casting · receiver status unavailable",
 preparing: "Preparing song", offline: "Reconnecting", unknown: "Waiting for device report",
};
type PlaybackStatus = { listeners: {id:string; state:string; position:number|null}[]; log:{nick:string;state:string;at:number;title:string}[] };
const action = "sw-focus min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10";
export default function RoomPeople({socket, list, you, isHost, pending, inviteOnly, discoverable, onApprovalChange, onApprove, onDeny, onKick, onMute, onRename}: {
 socket: Socket | null; list: Participant[]; you:string|null; isHost:boolean; pending:PendingRequest[]; inviteOnly:boolean; discoverable:boolean;
 onApprovalChange:(enabled:boolean)=>void; onApprove:(id:string)=>void; onDeny:(id:string)=>void;
 onRename:(name:string)=>Promise<void>;
 onKick:(id:string)=>void; onMute:(id:string,muted:boolean)=>void;
}) {
 const [people,setPeople]=useState(false),[requests,setRequests]=useState(false),[removing,setRemoving]=useState<string|null>(null);
 const [nameDraft,setNameDraft]=useState<string|null>(null);
 const [renameError,setRenameError]=useState("");
 const [savingName,setSavingName]=useState(false);
 async function saveName() {
   if (!nameDraft?.trim() || savingName) return;
   setSavingName(true);setRenameError("");
   try { await onRename(nameDraft);setNameDraft(null); }
   catch (error) { setRenameError(error instanceof Error ? error.message : "Could not change your name."); }
   finally { setSavingName(false); }
 }
 const [playback, setPlayback] = useState<PlaybackStatus | null>(null);
 useEffect(() => {
   if (!people || !isHost || !socket) return;
   let active = true;
   const update = () => {
     if (!socket.connected) { setPlayback(null); return; }
     socket.timeout(1800).emit(EVENTS.PLAYBACK_HOST_STATUS, {}, (error: Error | null, status: PlaybackStatus) => {
       if (active) setPlayback(error || !Array.isArray(status?.listeners) ? null : status);
     });
   };
   update();
   const timer = setInterval(update, 2500);
   return () => { active = false; clearInterval(timer); setPlayback(null); };
 }, [people, isHost, socket]);
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
  <Dialog open={people} onOpenChange={open=>{setPeople(open);if(!open){setRemoving(null);setNameDraft(null);setRenameError("");}}}>
   <DialogContent overlayClassName="z-[100]" className="z-[110] w-[calc(100vw-1.5rem)] max-w-md max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
    <DialogTitle className="pr-10">People in your room</DialogTitle>
    <DialogDescription className="text-muted">{list.length} listening together{isHost?" · You manage this room":""}</DialogDescription>
    {isHost&&<label className="flex items-start gap-3 rounded-2xl border border-white/10 p-3"><ShieldCheck className="mt-1 size-5 shrink-0"/><span className="flex-1 text-sm"><strong className="block">Approve new joins</strong><span className="text-muted">{discoverable ? "Approval is required while random matching is on." : "Show a popup before new listeners enter."}</span></span><input type="checkbox" className="mt-1 size-6 shrink-0 accent-[var(--accent)]" checked={inviteOnly} disabled={discoverable} onChange={e=>onApprovalChange(e.target.checked)}/></label>}
    {isHost&&pending.length>0&&<button className={action} onClick={()=>{setPeople(false);setRequests(true);}}>Review {pending.length} join request{pending.length===1?"":"s"}</button>}
    {isHost&&<p className="text-sm font-semibold">Live playback status</p>}
    <ul className="space-y-3">{list.map(p=><li key={p.id} className="rounded-2xl border border-white/10 p-3">
     <div className="flex min-w-0 items-center gap-3"><Avatar name={p.nick} size="sm" isHost={p.isHost} status={p.status}/><div className="min-w-0 flex-1"><p className="break-words font-semibold">{p.nick}{p.id===you?" (you)":""}</p><p className="text-xs text-muted">{p.isHost?"Host":p.muted?"Chat muted":p.status||"Listening"}</p></div></div>
     {isHost&&<p className="mt-2 text-sm text-muted">{playbackLabels[playback?.listeners.find(listener=>listener.id===p.id)?.state ?? "unknown"]}</p>}
     {p.id===you&&(nameDraft===null
      ? <button className={action+" mt-3"} onClick={()=>setNameDraft(p.nick)}>Rename</button>
      : <form className="mt-3 space-y-2" onSubmit={event=>{event.preventDefault();void saveName();}}>
       <label className="block text-sm">Display name
        <input className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" value={nameDraft} maxLength={24} onChange={event=>setNameDraft(event.target.value)} autoFocus/>
       </label>
       {renameError&&<p role="alert" className="text-sm text-muted">{renameError}</p>}
       <div className="flex flex-wrap gap-2">
        <button className={action} type="submit" disabled={savingName||!nameDraft.trim()}>Save name</button>
        <button className={action} type="button" disabled={savingName} onClick={()=>{setNameDraft(null);setRenameError("");}}>Cancel</button>
       </div>
      </form>)}
     {isHost&&p.id!==you&&!p.isHost&&<div className="mt-3">
      {removing===p.id?<><p className="mb-2 text-sm">Remove {p.nick}? They will be disconnected and temporarily blocked from rejoining.</p><div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>setRemoving(null)}>Cancel</button><button className={action+" text-[var(--destructive)]"} onClick={()=>{onKick(p.id);setRemoving(null);}}>Remove now</button></div></>:<div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>onMute(p.id,!p.muted)}>{p.muted?"Unmute chat":"Mute chat"}</button><button className={action+" text-[var(--destructive)]"} onClick={()=>setRemoving(p.id)} aria-label={`Remove ${p.nick}`}>Remove</button></div>}
     </div>}
    </li>)}</ul>
    {isHost&&Boolean(playback?.log.length)&&<details className="rounded-2xl border border-white/10 p-3">
     <summary className="cursor-pointer text-sm font-semibold">Recent playback reports</summary>
     <ol className="mt-2 max-h-40 space-y-2 overflow-auto text-xs text-muted">
      {playback?.log.slice().reverse().map((entry,index)=><li key={`${entry.at}-${index}`}>
       <time>{new Date(entry.at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}</time>
       {" · "}{entry.nick} · {playbackLabels[entry.state]} · {entry.title}
      </li>)}
     </ol>
    </details>}
   </DialogContent>
  </Dialog>
 </>;
}
