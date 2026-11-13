"use client";

import {useEffect, useRef, useState} from "react";
import {Users, UserPlus, ShieldCheck,Check,X,Trash2,Crown} from "lucide-react";
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
type PlaybackStatus = { listeners: {id:string; state:string; position:number|null;audioEnabled:boolean|null}[]; log:{nick:string;state:string;at:number;title:string}[] };
export type PeopleShortcut = "profile" | "name" | "mood" | "buzz" | "participants" | "admin" | "rename";
const action = "inline-flex items-center justify-center gap-2 text-left sw-focus min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10";
export default function RoomPeople({socket, list, you, isHost, pending, inviteOnly, discoverable, onApprovalChange, onApprove, onDeny, onKick, onMute, onRename, onProfile, onMood, onBuzz, mediaQuery, mood, roomName, onRoomName, shortcut,onHostRole,onBack}: {
 onBack?:()=>void;
 onHostRole?:(id:string,enabled:boolean)=>Promise<void>;
 socket: Socket | null; list: Participant[]; you:string|null; isHost:boolean; pending:PendingRequest[]; inviteOnly:boolean; discoverable:boolean;
 onApprovalChange:(enabled:boolean)=>void; onApprove:(id:string)=>void; onDeny:(id:string)=>void;
 onRename:(name:string,targetId?:string)=>Promise<void>;
 onProfile:(status:string,imageId:string|null,file?:File)=>Promise<void>;
 onMood:(label:string)=>Promise<void>; onBuzz:(targetId?:string)=>Promise<void>;
 mediaQuery:string; mood:string; roomName:string; onRoomName:(name:string)=>Promise<void>; shortcut?:{action:PeopleShortcut;id:number};
 onKick:(id:string)=>void; onMute:(id:string,muted:boolean)=>void;
}) {
 const [people,setPeople]=useState(false),[requests,setRequests]=useState(false),[removing,setRemoving]=useState<string|null>(null);
 const [nameDraft,setNameDraft]=useState<string|null>(null),[renameId,setRenameId]=useState<string|null>(null);
 const [profileDraft,setProfileDraft]=useState<{status:string;imageId:string|null;file?:File}|null>(null);
 const [roomNameDraft,setRoomNameDraft]=useState<string|null>(null);
 const [savingRoomName,setSavingRoomName]=useState(false);
 const [moodDraft,setMoodDraft]=useState<string|null>(null);
 const [feedback,setFeedback]=useState("");
 const [buzzOnly,setBuzzOnly]=useState(false);
 const [profileOnly,setProfileOnly]=useState(false);
 const [activeAction,setActiveAction]=useState<PeopleShortcut>("participants");
 const moodOnly=activeAction==="mood";
 const [preview,setPreview]=useState("");
 useEffect(()=>{if(!profileDraft?.file){setPreview("");return;}const url=URL.createObjectURL(profileDraft.file);setPreview(url);return()=>URL.revokeObjectURL(url);},[profileDraft?.file]);
 const adminView=Boolean(isHost&&activeAction==="admin");
 const own = list.find(member => member.id === you);
 const shortcutSeen=useRef<number>(0);
 useEffect(()=>{
   if(!shortcut||shortcutSeen.current===shortcut.id)return;
   shortcutSeen.current=shortcut.id;setActiveAction(shortcut.action);
   setPeople(true);setFeedback("");setRoomNameDraft(null);setMoodDraft(null);setProfileDraft(null);
   setBuzzOnly(shortcut.action==="buzz");
   setProfileOnly(shortcut.action==="profile"||shortcut.action==="rename");
   if(shortcut.action==="rename"){setRenameId(you);setNameDraft(own?.nick||"");}
   if(shortcut.action==="name")setRoomNameDraft(roomName);
   if(shortcut.action==="mood")setMoodDraft(mood);
   if(shortcut.action==="profile"){
     setProfileDraft({status:own?.profile?.status||"",imageId:own?.profile?.imageId||null});
   }
 },[shortcut,roomName,mood,list,you,isHost]);
 async function perform(task:()=>Promise<void>, success:string) {
   setFeedback("");
   try { await task();setFeedback(success); }
   catch(error) { setFeedback(error instanceof Error?error.message:"Could not complete the request."); }
 }
 const [renameError,setRenameError]=useState("");
 const [savingName,setSavingName]=useState(false);
 async function saveName() {
   if (!nameDraft?.trim() || savingName) return;
   setSavingName(true);setRenameError("");
   try { await onRename(nameDraft,renameId||undefined);setNameDraft(null);setRenameId(null); }
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
 const playbackById = new Map(playback?.listeners.map(listener => [listener.id, listener]));
 const seen=useRef(new Set<string>());
 useEffect(()=>{
   const fresh=pending.some(p=>!seen.current.has(p.id));
   seen.current=new Set(pending.map(p=>p.id));
   if(isHost&&fresh){setPeople(false);setRequests(true);}
   if(!pending.length)setRequests(false);
 },[pending,isHost]);
 return <>
  <button className={action+" flex items-center gap-2"} onClick={()=>{setActiveAction("participants");setMoodDraft(null);setRoomNameDraft(null);setProfileDraft(null);setNameDraft(null);setBuzzOnly(false);setProfileOnly(false);setPeople(true);}} aria-label={`People, ${list.filter(p=>p.status!=="reconnecting").length} listening`}><Users className="size-4"/><span className="people-active-count">{list.filter(p=>p.status!=="reconnecting").length}</span></button>
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
  <Dialog open={people} onOpenChange={open=>{setPeople(open);if(!open){setRemoving(null);setNameDraft(null);setRenameId(null);setRenameError("");setProfileDraft(null);setMoodDraft(null);setRoomNameDraft(null);setBuzzOnly(false);setFeedback("");}}}>
   <DialogContent overlayClassName="z-[100]" className="z-[110] w-[calc(100vw-1.5rem)] max-w-md max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
    {onBack&&["admin","name","mood"].includes(activeAction)&&<button type="button" className="settings-back" onClick={()=>{setPeople(false);onBack();}}>← Back to room management</button>}
    <DialogTitle className="pr-10">{moodOnly ? "Room mood" : buzzOnly ? "Buzz listeners" : profileOnly ? "Your profile" : "People in your room"}</DialogTitle>
    <DialogDescription className="text-muted">{moodOnly ? "Choose a mood for everyone listening." : profileOnly ? "Your identity in this room" : `${list.length} listening together${isHost ? " · You manage this room" : ""}`}</DialogDescription>
    {profileDraft!==null&&<form className="space-y-3 rounded-2xl border border-input p-3" onSubmit={event=>{
      event.preventDefault();const draft=profileDraft;
      void perform(async()=>{await onProfile(draft.status,draft.imageId,draft.file);setProfileDraft(null);if(profileOnly)setPeople(false);},"Profile updated.");
    }}>
      <div className="room-profile-identity">
        {preview||profileDraft.imageId ? <img alt="Current profile picture" src={preview||`/chat-media/${profileDraft.imageId}${mediaQuery}`}/> : <Avatar name={own?.nick || "Listener"} size="lg"/>}
        <div><strong>{own?.nick}</strong><small>{isHost ? "Room host" : "Room listener"}</small></div>
      </div>
      <label className="kn-profile-file">
        <span>{profileDraft.file?"Choose another photo or GIF":"Upload photo or GIF"}</span><small>Up to 20 MB</small>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/svg+xml,.svg,.heic,.heif"
          onChange={event=>setProfileDraft({...profileDraft,file:event.target.files?.[0]})}/>
      </label>
      {profileDraft.file&&<p className="break-all text-xs text-muted">{profileDraft.file.name}</p>}
      <label className="block text-sm">Status<input className="mt-1 w-full rounded-lg border border-input bg-field p-2" value={profileDraft.status} maxLength={100}
        onChange={event=>setProfileDraft({...profileDraft,status:event.target.value})}/></label>
      <div className="flex flex-wrap gap-2">
        <button className={action} aria-label="Save profile" title="Save profile"><Check size={18}/><span>Save</span></button>
        <button type="button" className={action} onClick={()=>setProfileDraft({...profileDraft,imageId:null,file:undefined})} aria-label="Clear photo" title="Clear photo"><Trash2 size={17}/><span>Clear</span></button>
        <button type="button" className={action} onClick={()=>{setProfileDraft(null);if(profileOnly)setPeople(false);}} aria-label="Cancel" title="Cancel"><X size={18}/></button>
      </div>
    </form>}
    {buzzOnly&&isHost ? <div className="flex flex-col gap-2">
      <button type="button" className={action} onClick={()=>void perform(()=>onBuzz(),"Buzz sent to the room.")}>Buzz all</button>
      {list.filter(member=>member.id!==you&&member.status!=="reconnecting").map(member=><button type="button" key={member.id} className={action}
        onClick={()=>void perform(()=>onBuzz(member.id),`Buzz sent to ${member.nick}.`)}>Buzz {member.nick}</button>)}
      {feedback&&<p className="text-sm text-muted" role="status">{feedback}</p>}
    </div> : <>
    {roomNameDraft!==null &&
      <form className="space-y-2" onSubmit={async event=>{
        event.preventDefault();
        if(savingRoomName||!roomNameDraft.trim())return;
        setSavingRoomName(true);
        try{await perform(async()=>{await onRoomName(roomNameDraft);setRoomNameDraft(null);},"Room name updated.");}
        finally{setSavingRoomName(false);}
      }}>
        <label className="block text-sm">Room name
          <input className="mt-1 w-full rounded-lg border border-input bg-field px-3 py-2" value={roomNameDraft} maxLength={80} onChange={event=>setRoomNameDraft(event.target.value)}/>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={action} disabled={savingRoomName||!roomNameDraft.trim()}>Save room name</button>
          <button type="button" className={action} disabled={savingRoomName} onClick={()=>setRoomNameDraft(null)} aria-label="Cancel" title="Cancel"><X size={18}/></button>
        </div>
      </form>}
    {adminView&&<label className="flex items-start gap-3 rounded-2xl border border-white/10 p-3"><ShieldCheck className="mt-1 size-5 shrink-0"/><span className="flex-1 text-sm"><strong className="block">Approve new joins</strong><span className="text-muted">{discoverable ? "Approval is required while random matching is on." : "Show a popup before new listeners enter."}</span></span><input type="checkbox" className="mt-1 size-6 shrink-0 accent-[var(--accent)]" checked={inviteOnly} disabled={discoverable} onChange={e=>onApprovalChange(e.target.checked)}/></label>}
    {adminView&&pending.length>0&&<button className={action} onClick={()=>{setPeople(false);setRequests(true);}}>Review {pending.length} join request{pending.length===1?"":"s"}</button>}
    {moodDraft!==null&&<form className="space-y-2" onSubmit={event=>{event.preventDefault();void perform(async()=>{await onMood(moodDraft);setMoodDraft(null);},"Mood updated.");}}>
      <label className="block text-sm">Room mood<input className="mt-1 w-full rounded-lg border border-input bg-field px-3 py-2" value={moodDraft} maxLength={40} onChange={event=>setMoodDraft(event.target.value)}/></label>
      <div className="flex flex-wrap gap-2"><button className={action}>Save mood</button><button type="button" className={action} onClick={()=>void perform(async()=>{await onMood("");setMoodDraft(null);},"Automatic mood enabled.")}>Use automatic mood</button><button type="button" className={action} onClick={()=>setMoodDraft(null)} aria-label="Cancel" title="Cancel"><X size={18}/></button></div>
    </form>}
    {feedback&&<p className="text-sm text-muted" role="status">{feedback}</p>}
    {adminView&&<p className="text-sm font-semibold">Listener management & playback status</p>}
    {!moodOnly&&!profileDraft&&<ul className="space-y-3">{(profileOnly ? list.filter(member => member.id === you) : list).map(p=><li key={p.id} className="rounded-2xl border border-white/10 p-3">
     <div className="flex min-w-0 items-center gap-3">{p.profile?.imageId?<img className="size-8 shrink-0 rounded-full object-cover" alt="" src={`/chat-media/${p.profile.imageId}${mediaQuery}`}/>:<Avatar name={p.nick} size="sm" isHost={p.isHost} status={p.status}/>}<div className="min-w-0 flex-1"><p className="break-words font-semibold">{p.nick}{p.id===you?" (you)":""}</p><p className="text-xs text-muted">{p.isHost?"Host":p.muted?"Chat muted":p.status||"Listening"}</p></div></div>
     {adminView&&<div className="mt-2 space-y-1 text-sm text-muted">
      <p>{playbackLabels[playbackById.get(p.id)?.state ?? "unknown"]}</p>
      <p>Audio setup · {playbackById.get(p.id)?.audioEnabled === true ? "Enabled" : playbackById.get(p.id)?.audioEnabled === false ? "Not yet enabled" : "Waiting for device"}</p>
     </div>}
     {p.profile?.status&&<p className="mt-1 break-words text-sm text-muted">{p.profile.status}</p>}
     {(p.id===you||adminView)&&(renameId!==p.id||nameDraft===null
      ? <button className={action+" mt-3"} onClick={()=>{setRenameId(p.id);setNameDraft(p.nick);setRenameError("");}}>Rename</button>
      : <form className="mt-3 space-y-2" onSubmit={event=>{event.preventDefault();void saveName();}}>
       <label className="block text-sm">Display name
        <input className="mt-1 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2" value={nameDraft} maxLength={24} onChange={event=>setNameDraft(event.target.value)} autoFocus/>
       </label>
       {renameError&&<p role="alert" className="text-sm text-muted">{renameError}</p>}
       <div className="flex flex-wrap gap-2">
        <button className={action} type="submit" disabled={savingName||!nameDraft.trim()}>Save name</button>
        <button className={action} type="button" disabled={savingName} onClick={()=>{setNameDraft(null);setRenameId(null);setRenameError("");}} aria-label="Cancel" title="Cancel"><X size={18}/></button>
       </div>
      </form>)}
     {p.id===you&&profileDraft===null&&<button type="button" className={action+" mt-3"} onClick={()=>setProfileDraft({status:p.profile?.status||"",imageId:p.profile?.imageId||null})}>Edit profile</button>}
     {isHost&&p.id!==you&&<button type="button" className={action+" mt-3"} onClick={()=>void perform(()=>onBuzz(p.id),`Buzz sent to ${p.nick}.`)}>Buzz {p.nick}</button>}
     {adminView&&p.id!==you&&!p.isRoomOwner&&onHostRole&&<button type="button" className={action+" mt-3"} onClick={()=>void perform(()=>onHostRole(p.id,!p.isHost),p.isHost?"Host role removed.":"Co-host added.")}><Crown size={16}/>{p.isHost?"Remove host role":"Make co-host"}</button>}
     {adminView&&p.id!==you&&!p.isHost&&<div className="mt-3">
      {removing===p.id?<><p className="mb-2 text-sm">Remove {p.nick}? They will be disconnected and temporarily blocked from rejoining.</p><div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>setRemoving(null)} aria-label="Cancel" title="Cancel"><X size={18}/></button><button className={action+" text-[var(--destructive)]"} onClick={()=>{onKick(p.id);setRemoving(null);}}>Remove now</button></div></>:<div className="grid grid-cols-2 gap-2"><button className={action} onClick={()=>onMute(p.id,!p.muted)}>{p.muted?"Unmute chat":"Mute chat"}</button><button className={action+" text-[var(--destructive)]"} onClick={()=>setRemoving(p.id)} aria-label={`Remove ${p.nick}`}>Remove</button></div>}
     </div>}
    </li>)}</ul>}
    {adminView&&Boolean(playback?.log.length)&&<details className="rounded-2xl border border-white/10 p-3">
     <summary className="cursor-pointer text-sm font-semibold">Recent playback reports</summary>
     <ol className="mt-2 max-h-40 space-y-2 overflow-auto text-xs text-muted">
      {playback?.log.slice().reverse().map((entry,index)=><li key={`${entry.at}-${index}`}>
       <time>{new Date(entry.at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}</time>
       {" · "}{entry.nick} · {playbackLabels[entry.state]} · {entry.title}
      </li>)}
     </ol>
    </details>}
    </>}
   </DialogContent>
  </Dialog>
 </>;
}
