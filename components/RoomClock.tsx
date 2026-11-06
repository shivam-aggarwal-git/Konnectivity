"use client";
import {useEffect,useState} from 'react';
export default function RoomClock(){const[value,setValue]=useState('');useEffect(()=>{const update=()=>setValue(new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date()));update();const timer=setInterval(update,15000);return()=>clearInterval(timer);},[]);return <time className="kn-room-clock" aria-label="Current local time" suppressHydrationWarning>{value}</time>;}
