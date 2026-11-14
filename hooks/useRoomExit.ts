"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
export function useRoomExit(enabled:boolean,onLeave:(nextHostId?:string)=>Promise<void>){
 const [target,setTarget]=useState<string|null>(null),[leaving,setLeaving]=useState(false),[error,setError]=useState('');
 const allow=useRef(false),initialized=useRef(false),callback=useRef(onLeave);callback.current=onLeave;
 useEffect(()=>{if(!enabled)return;
  if(!initialized.current){history.pushState({...history.state,knRoomGuard:true},'',location.href);initialized.current=true;}
  const unload=(e:BeforeUnloadEvent)=>{if(!allow.current){e.preventDefault();e.returnValue='';}};
  const back=()=>{if(allow.current)return;history.pushState({...history.state,knRoomGuard:true},'',location.href);setTarget('/');};
  const click=(e:MouseEvent)=>{if(allow.current||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=(e.target as Element)?.closest?.('a');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;const href=a.getAttribute('href');if(!href||href.startsWith('#'))return;const url=new URL(href,location.href);if(url.href===location.href)return;e.preventDefault();e.stopPropagation();setTarget(url.href);};
  window.addEventListener('beforeunload',unload);window.addEventListener('popstate',back);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',back);document.removeEventListener('click',click,true);};
 },[enabled]);
 const confirm=useCallback(async(nextHostId?:string)=>{if(leaving)return;setLeaving(true);setError('');try{await callback.current(nextHostId);allow.current=true;window.location.assign(target||'/');}catch(e){setError(e instanceof Error?e.message:'Could not leave the room. Please try again.');setLeaving(false);}},[target,leaving]);
 return {open:target!==null,leaving,error,request:(destination='/')=>setTarget(destination),cancel:()=>{if(!leaving){setTarget(null);setError('');}},confirm};
}
