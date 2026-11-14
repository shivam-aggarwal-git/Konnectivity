'use client';
import {useEffect,useState} from 'react';
import {ArrowLeftRight,Shuffle,Users,RefreshCw} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {Button} from './ui/button';
import {notify} from './FeedbackToast';
type Room={code:string;name:string;listeners:number;inviteOnly:boolean};
export default function SwitchRoom({current,onSwitch,inline=false}:{current?:string;onSwitch?:(url:string)=>void;inline?:boolean}){
 const[open,setOpen]=useState(false),[rooms,setRooms]=useState<Room[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch(`/api/rooms/visible?exclude=${encodeURIComponent(current||'')}`,{cache:'no-store'});if(!r.ok)throw Error('Could not load rooms.');setRooms((await r.json()).rooms);}catch(e){setError(e instanceof Error?e.message:'Could not load rooms.');}finally{setLoading(false);}}
 useEffect(()=>{if(open||inline)void load();},[open,inline,current]);
 const go=(room:Room)=>{const url=`/r/${room.code}?request=1`;setOpen(false);notify(`Opening ${room.name}. Join approval still applies.`);if(onSwitch)onSwitch(url);else window.location.assign(url);};
 const content=<><div className="kn-switch-actions"><Button disabled={loading||!rooms.length} onClick={()=>go(rooms[Math.floor(Math.random()*rooms.length)])}><Shuffle size={18}/>Random room</Button><Button variant="secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/>Refresh</Button></div>{loading?<p role="status">Finding rooms…</p>:<ul className="kn-room-list">{rooms.map(room=><li key={room.code}><button onClick={()=>go(room)}><span><strong>{room.name}</strong><small>{room.inviteOnly?'Host approval required':'Open room'}</small></span><span><Users size={16}/>{room.listeners}</span></button></li>)}</ul>}{!loading&&!rooms.length&&<p className="text-muted">No visible rooms are accepting listeners right now. Private rooms stay private; use their invitation link.</p>}{error&&<p role="alert">{error}</p>}</>;
 if(inline)return <section className="kn-visible-rooms"><h2>Rooms to discover</h2><p className="text-muted">Choose a room or let us pick one. Hosts approve requests.</p>{content}</section>;
 return <><button type="button" onClick={()=>setOpen(true)}><ArrowLeftRight size={20}/>Switch room</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="kn-settings-dialog"><DialogTitle>Switch room</DialogTitle><DialogDescription>Discover visible rooms. Your current party uses the usual leave confirmation.</DialogDescription>{content}</DialogContent></Dialog></>;
}
