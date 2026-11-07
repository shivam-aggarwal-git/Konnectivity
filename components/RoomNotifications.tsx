"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Socket} from 'socket.io-client';
import {Bell,BarChart3,CalendarDays,X,CheckCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
type Notice={id:string;kind:'polls'|'plans';text:string;detail:string;at:number};
export default function RoomNotifications({socket,onOpen}:{socket:Socket|null;onOpen:(view:"plans"|"polls"|"call")=>void}){
 const[items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[open,setOpen]=useState(false),[toast,setToast]=useState<Notice|null>(null);
 useEffect(()=>{if(!socket)return;socket.emit('social:get',{},(r:any)=>{if(r?.notifications)setItems(r.notifications);});const receive=(n:Notice)=>{setItems(p=>[...p.filter(x=>x.id!==n.id),n].slice(-60));setUnread(p=>p+1);setToast(n);};socket.on('social:notification',receive);return()=>{socket.off('social:notification',receive);};},[socket]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),6000);return()=>clearTimeout(t);},[toast]);
 const visit=(n:Notice)=>{setOpen(false);setToast(null);onOpen(n.kind);};
 return <><button className="kn-bell" title="Room notifications" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} onClick={()=>{setOpen(true);setUnread(0);}}><Bell size={17}/>{unread>0&&<b>{Math.min(unread,99)}</b>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="kn-notification-dialog"><DialogTitle>Room notifications</DialogTitle><DialogDescription>Plans, polls and votes from everyone in this room.</DialogDescription><button className="kn-background-upload" onClick={()=>setUnread(0)}><CheckCheck size={15}/>Mark all read</button><ul className="kn-notification-list">{items.slice().reverse().map(n=><li key={n.id}><button onClick={()=>visit(n)}>{n.kind==='polls'?<BarChart3 size={18}/>:<CalendarDays size={18}/>}<span><strong>{n.text}</strong><small>{n.detail}</small><time>{new Date(n.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></span></button></li>)}</ul>{!items.length&&<p className="text-sm text-muted">Activity will appear here when someone creates a plan or votes.</p>}</DialogContent></Dialog>{toast&&createPortal(<div className="kn-social-toast" role="status"><button onClick={()=>visit(toast)}>{toast.kind==='polls'?<BarChart3 size={20}/>:<CalendarDays size={20}/>}<span><strong>{toast.text}</strong><small>{toast.detail}</small></span></button><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={16}/></button></div>,document.body)}</>;
}
