"use client";
import {useEffect,useState} from 'react';
import {MessageCircle,Send} from 'lucide-react';
import type {Socket} from 'socket.io-client';
import type {Track} from '@/lib/types';
type Comment={id:string;trackId:string;text:string;nick:string;at:number};
export default function SongComments({socket,track}:{socket:Socket|null;track:Track|null}){
 const[comments,setComments]=useState<Comment[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!socket)return;const receive=(s:any)=>{if(Array.isArray(s?.comments))setComments(s.comments);};socket.emit('social:get',{},receive);socket.on('social:state',receive);return()=>{socket.off('social:state',receive);};},[socket]);
 useEffect(()=>{setText('');setError('');},[track?.videoId]);
 if(!track)return null;
 const shown=comments.filter(c=>c.trackId===track.videoId);
 return <section className="kn-song-comments"><h3><MessageCircle size={16}/>Song comments <span>{shown.length}</span></h3><p>About “{track.title}” · shared with this room.</p><ul>{shown.map(c=><li key={c.id}><strong>{c.nick}</strong><time>{new Date(c.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><p>{c.text}</p></li>)}</ul><form onSubmit={e=>{e.preventDefault();if(!socket||busy||!text.trim())return;setBusy(true);setError('');socket.timeout(5000).emit('comment:add',{trackId:track.videoId,text},(err:any,r:any)=>{setBusy(false);if(err||r?.error)setError(r?.error||'Could not send comment.');else setText('');});}}><input aria-label="Comment on this song" placeholder="Leave a comment…" maxLength={500} value={text} onChange={e=>setText(e.target.value)}/><button title="Post song comment" aria-label="Post song comment" disabled={busy||!text.trim()}><Send size={16}/></button></form>{error&&<p role="alert">{error}</p>}</section>;
}
