"use client";
import {MessageSquare,X} from 'lucide-react';
export default function ChatNotice({count,sender,preview,onOpen,onDismiss}:{count:number;sender:string;preview:string;onOpen:()=>void;onDismiss:()=>void}){
 return <aside className="kn-chat-notice" aria-label="Unread chat notification">
  <button type="button" className="kn-chat-notice-open" onClick={onOpen} aria-label={`Open chat, ${count} unread ${count===1?'message':'messages'}`}>
   <span className="kn-chat-notice-icon"><MessageSquare size={18}/><b>{count>99?'99+':count}</b></span>
   <span className="kn-chat-notice-copy" role="status" aria-live="polite"><strong>{count} new {count===1?'message':'messages'}</strong><span>{sender}: {preview}</span></span>
  </button>
  <button type="button" className="kn-chat-notice-close" aria-label="Dismiss chat notification" onClick={onDismiss}><X size={16}/></button>
 </aside>;
}
