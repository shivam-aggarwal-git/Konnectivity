"use client";
import {useEffect,useState} from 'react';
import {Clock3} from 'lucide-react';
export default function RoomClock(){
 const[now,setNow]=useState<Date|null>(null);
 useEffect(()=>{const update=()=>setNow(new Date());update();const timer=setInterval(update,15000);return()=>clearInterval(timer);},[]);
 const time=now?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).format(now):'—';
 const date=now?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(now):'—';
 return <time className="kn-room-clock" dateTime={now?.toISOString()} aria-label={`Local time ${time}, ${date}`}><Clock3 size={12} aria-hidden="true"/><span className="kn-clock-label">Local time</span><b>{time}</b><span className="kn-clock-date">{date}</span></time>;
}
