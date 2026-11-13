"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Pencil, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Socket } from "socket.io-client";
import type { Participant, Track } from "@/lib/types";
import AnimatedChatText from "./AnimatedChatText";

type Comment = {id:string;trackId:string;text:string;nick:string;at:number;editedAt?:number;tags?:string[];
  canEdit?:boolean;likes:number;dislikes:number;myVote:number};

export default function SongComments({socket, track, members, compact=false,onClose}: {onClose?:()=>void;compact?:boolean;socket:Socket|null;track:Track|null;members:Participant[]}) {
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{const show=()=>setCollapsed(false);window.addEventListener("konnectivity:show-comments",show);return()=>window.removeEventListener("konnectivity:show-comments",show);},[]);
  const [comments,setComments]=useState<Comment[]>([]);
  const [text,setText]=useState("");
  const [tags,setTags]=useState<string[]>([]);
  const [editing,setEditing]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [posted,setPosted]=useState(false);
  const input=useRef<HTMLTextAreaElement>(null);
  const [mention,setMention]=useState<{start:number;end:number;query:string}|null>(null);
  const [selected,setSelected]=useState(0);
  const suggestions=mention?members.filter(member=>member.status!=="reconnecting"&&member.nick.toLowerCase().includes(mention.query.toLowerCase())).slice(0,8):[];
  function findMention(value:string,caret:number){const hit=value.slice(0,caret).match(/(?:^|\s)@([^@\n]{0,40})$/);setMention(hit?{start:caret-hit[1].length-1,end:caret,query:hit[1]}:null);setSelected(0);}
  function insertMention(member:Participant){if(!mention)return;const value=text.slice(0,mention.start)+"@"+member.nick+" "+text.slice(mention.end);const caret=mention.start+member.nick.length+2;setText(value);setTags(ids=>Array.from(new Set([...ids,member.id])).slice(0,8));setMention(null);requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(caret,caret);});}
  useEffect(()=>{
    if(!socket)return;
    const receive=(state:{comments?:Comment[]})=>{if(Array.isArray(state?.comments))setComments(state.comments);};
    socket.emit("social:get",{},receive);socket.on("social:state",receive);
    return()=>{socket.off("social:state",receive);};
  },[socket]);
  useEffect(()=>{setEditing(null);setText("");setTags([]);setError("");},[track?.videoId]);
  if(!track)return <p className="text-sm text-muted">Comments and listener tags become available when a song is playing.</p>;
  const shown=comments.filter(comment=>comment.trackId===track.videoId);
  async function action(event:string,payload:object) {
    if(busy)return false;
    if(!socket?.connected){setError("Reconnecting to your room. Try posting again in a moment.");return false;}
    setBusy(true);setError("");
    try {
      const result=await socket.timeout(5000).emitWithAck(event,payload);
      if(result?.error)throw Error(result.error);
      return true;
    } catch(error) { setError(error instanceof Error?error.message:"Could not update the comment.");return false; }
    finally { setBusy(false); }
  }
  return <section className={`kn-song-comments ${compact?"kn-song-comments-inline":""}`} id={compact?"kn-song-comments-inline":"kn-song-comments"}>
    <h3><span className="song-comments-at" aria-hidden="true">@</span><span className="sr-only">Song comments</span><span>{shown.length}</span><button type="button" aria-label="Close song comments" title="Close comments" onClick={()=>onClose?onClose():setCollapsed(v=>!v)}><ChevronDown size={18}/></button></h3>
    <div className="kn-comment-content" hidden={collapsed}>
    {!compact&&<p>About “{track.title}” · shared with this room.</p>}
    <ul aria-label="Song comments">{shown.map(comment=><li key={comment.id}>
      <strong>{comment.nick}</strong><time>{new Date(comment.at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</time>
      <p><AnimatedChatText text={comment.text}/>{comment.editedAt&&<small className="ml-2">Edited</small>}</p>
      {Boolean(comment.tags?.length)&&<p className="text-xs text-muted">{comment.tags?.filter(name=>!comment.text.includes("@"+name)).map(name=>"@"+name).join(" ")}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" className="inline-flex items-center gap-1" aria-pressed={comment.myVote===1} aria-label="Like comment" disabled={busy} onClick={()=>void action("comment:vote",{id:comment.id,vote:1})}><ThumbsUp size={14}/>{comment.likes}</button>
        <button type="button" className="inline-flex items-center gap-1" aria-pressed={comment.myVote===-1} aria-label="Dislike comment" disabled={busy} onClick={()=>void action("comment:vote",{id:comment.id,vote:-1})}><ThumbsDown size={14}/>{comment.dislikes}</button>
        {comment.canEdit&&<button type="button" aria-label="Edit comment" onClick={()=>{setEditing(comment.id);setText(comment.text);setTags([]);}}><Pencil size={14}/></button>}
      </div>
    </li>)}</ul>
    <form onSubmit={async event=>{event.preventDefault();if(!text.trim())return;
      if(await action(editing?"comment:edit":"comment:add",editing?{id:editing,text}:{trackId:track.videoId,text,tags:tags.filter(id=>{const member=members.find(m=>m.id===id);return member&&text.includes("@"+member.nick);})})){setText("");setTags([]);setMention(null);setEditing(null);setPosted(true);}
    }}>
      {mention&&<div className="kn-mention-list" role="listbox" aria-label="Tag a listener">{suggestions.length?suggestions.map((member,i)=><button key={member.id} type="button" role="option" aria-selected={i===selected} onMouseDown={e=>e.preventDefault()} onClick={()=>insertMention(member)}>@{member.nick}</button>):<p>No matching listeners</p>}</div>}
      <button type="button" className="inline-comment-tag" aria-label="Tag listeners in song comment" onClick={()=>{const value=text+(text&&!text.endsWith(" ")?" ":"")+"@";setText(value);findMention(value,value.length);requestAnimationFrame(()=>input.current?.focus());}}> @ </button>
      <label className="song-comment-label"><span className={compact?"sr-only":""}>Your comment</span><textarea ref={input} rows={compact?1:2} aria-label={editing?"Edit song comment":"Comment on this song"} placeholder={editing?"Edit your comment…":"Leave a comment…"}
        maxLength={500} value={text} onChange={event=>{setText(event.target.value);findMention(event.target.value,event.target.selectionStart);setPosted(false);}}
        onClick={event=>findMention(text,event.currentTarget.selectionStart)} onKeyDown={event=>{if(mention){if(event.key==="Escape"){event.preventDefault();setMention(null);return;}if(suggestions.length&&["ArrowDown","ArrowUp","Enter","Tab"].includes(event.key)){event.preventDefault();if(event.key==="ArrowDown")setSelected(i=>(i+1)%suggestions.length);else if(event.key==="ArrowUp")setSelected(i=>(i+suggestions.length-1)%suggestions.length);else insertMention(suggestions[selected]||suggestions[0]);return;}}if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/></label>
      <button type="submit" aria-label={editing?"Save comment":"Post song comment"} disabled={busy||!text.trim()}><Send size={16}/><span>{busy?"Posting…":editing?"Save":"Post"}</span></button>
    </form>
    {editing&&<button type="button" className="mt-2 text-xs underline" onClick={()=>{setEditing(null);setText("");}}>Cancel edit</button>}
    {posted&&<p role="status" className="text-sm text-success">Comment posted to the room.</p>}
    {error&&<p role="alert">{error}</p>}
    </div>
  </section>;
}
