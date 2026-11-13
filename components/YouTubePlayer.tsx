"use client";
import { useEffect, useRef, useState } from "react";
import type { BufferedRange } from "@/lib/media-buffer";
import { Heart, Play, Video } from "lucide-react";
type Player = { destroy():void; getCurrentTime():number; getPlayerState():number; getDuration():number; getVideoLoadedFraction?():number; getVideoData():{title?:string}; seekTo(t:number,a:boolean):void; playVideo():void; pauseVideo():void; setVolume(n:number):void; getIframe():HTMLIFrameElement };
declare global { interface Window { YT?: { Player:new(element:HTMLElement, options:any)=>Player }; onYouTubeIframeAPIReady?:()=>void } }
let loading:Promise<void>|undefined;
function loadApi() {
 if(window.YT?.Player)return Promise.resolve();
 if(!loading)loading=new Promise<void>((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{loading=undefined;reject(Error('YouTube could not load. Check your connection or content blocker.'));};document.head.appendChild(script);
 });return loading;
}
export type PlaybackSample = { position: number; state: "checking" | "playing" | "buffering" | "stopped" | "blocked" | "interrupted" | "error" | "casting" };
type Props = { videoId:string; position:number; playing:boolean; desiredPlaying:boolean; holding:boolean; volume:number; title:string;
 onPlaying:(playing:boolean)=>void; onEnded:()=>void; onMetadata:(duration:number,title:string)=>void;
 getPosition:()=>number; getRunning:()=>boolean; syncKey:string; onReadyChange:(ready:boolean,key:string)=>void; onBuffer:(ranges:BufferedRange[])=>void; onPlaybackSampler:(sample:(()=>PlaybackSample)|null)=>void };
export default function YouTubePlayer(props:Props) {
 const {videoId,title,syncKey}=props;
 const latest=useRef(props);latest.current=props;
 const mount=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),ready=useRef(false),localReady=useRef(false);
 const previousTarget=useRef<{position:number;time:number}|null>(null);
 const reported=useRef(false),attempt=useRef(0),bufferSince=useRef(0),lastSeek=useRef(0),aligned=useRef(false);
 const[error,setError]=useState(''),[blocked,setBlocked]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(() => {
  props.onPlaybackSampler(() => {
   const p = player.current;
   if (error) return { state: "error", position: 0 };
   if (blocked) return { state: "blocked", position: 0 };
   if (!p || !ready.current) return { state: "checking", position: 0 };
   const status = p.getPlayerState();
   return { state: status === 1 ? "playing" : status === 3 || status === -1 ? "buffering" : "stopped", position: p.getCurrentTime() };
  });
  return () => props.onPlaybackSampler(null);
 }, [error, blocked, props.onPlaybackSampler]);
 useEffect(()=>{localReady.current=false;aligned.current=false;bufferSince.current=0;latest.current.onReadyChange(false,syncKey);},[syncKey]);
 useEffect(()=>{
  let disposed=false;ready.current=false;reported.current=false;setLoaded(false);setError('');setBlocked(false);
  // Set referrer policy before the first embed request. onReady is too late
  // for YouTube client identification (error 153); never send room query tokens.
  const element=document.createElement('iframe');
  element.title=title || 'YouTube video';
  element.referrerPolicy='strict-origin-when-cross-origin';
  element.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
  element.allowFullscreen=true;
  element.src=`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&controls=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
  mount.current?.replaceChildren(element);
  loadApi().then(()=>{
   if(disposed||!window.YT)return;
   const p=new window.YT.Player(element,{videoId,host:'https://www.youtube.com',width:'100%',height:'100%',playerVars:{playsinline:1,controls:0,rel:0,origin:window.location.origin,enablejsapi:1},events:{
    onReady:()=>{if(disposed)return;ready.current=true;setLoaded(true);p.getIframe().setAttribute('referrerpolicy','strict-origin-when-cross-origin');p.setVolume(0);p.seekTo(latest.current.getPosition(),true);lastSeek.current=performance.now();aligned.current=true;if(latest.current.desiredPlaying)p.playVideo();else p.pauseVideo();},
    onAutoplayBlocked:()=>{setBlocked(true);localReady.current=false;latest.current.onReadyChange(false,latest.current.syncKey);},
    onStateChange:(e:{data:number})=>{
     if(!ready.current)return;
     if(e.data===1){setBlocked(false);bufferSince.current=0;localReady.current=true;latest.current.onReadyChange(true,latest.current.syncKey);}
     if(e.data===3 && !bufferSince.current)bufferSince.current=performance.now();
     if(e.data===0 && latest.current.getPosition()>p.getDuration()-3)latest.current.onEnded();
     // Only the app's shared transport changes room intent. A local buffer,
     // programmatic pause or autoplay block must never pause the room by accident.
    },
    onError:(e:{data:number})=>{localReady.current=false;latest.current.onReadyChange(false,latest.current.syncKey);setError([101,150].includes(e.data)?'This video cannot be embedded. Try a different YouTube video.':e.data===153?'YouTube could not verify this embed. Open the room through its HTTPS share link.':'This video is unavailable here. Try another YouTube link.');},
   }});player.current=p;
  }).catch(e=>{if(!disposed)setError(e.message);});
  return()=>{disposed=true;ready.current=false;player.current?.destroy();player.current=null;};
 },[videoId]);
 useEffect(()=>{
  const tick=()=>{
   const p=player.current;if(!p||!ready.current)return;
   if(document.visibilityState!=="visible")return;
   const s=latest.current,state=p.getPlayerState(),now=performance.now(),target=s.getPosition(),running=s.getRunning();
   const duration = p.getDuration();
   const loaded = p.getVideoLoadedFraction?.() ?? 0;
   s.onBuffer(duration > 0 && loaded > 0 ? [[0, Math.min(1, loaded) * duration]] : []);
   if(!reported.current&&p.getDuration()>0){reported.current=true;s.onMetadata(p.getDuration(),p.getVideoData().title||'YouTube video');}
   if(state===3&&bufferSince.current&&now-bufferSince.current>650){localReady.current=false;s.onReadyChange(false,s.syncKey);}
   if(state===1){bufferSince.current=0;localReady.current=true;}
   const prime=s.desiredPlaying&&!localReady.current;
   // Prime silently while the shared clock is held. Once all listeners can
   // play, the server schedules the same resume instant for everyone.
   p.setVolume(running&&localReady.current?Math.round(s.volume*100):0);
   const before=previousTarget.current;
   const jumped=Boolean(before && Math.abs(target-before.position-(running?(now-before.time)/1000:0))>.6);
   previousTarget.current={position:target,time:now};
   const drift=p.getCurrentTime()-target;
   if((jumped||!aligned.current||Math.abs(drift)>(running?1.25:.15))&&state!==3&&(jumped||now-lastSeek.current>3000)){p.seekTo(target,true);lastSeek.current=now;aligned.current=true;}
   if((running||prime)&&state!==1&&state!==3&&now-attempt.current>1500){attempt.current=now;p.playVideo();}
   if(!running&&!prime&&state!==2&&state!==5)p.pauseVideo();
   if(localReady.current)s.onReadyChange(true,s.syncKey);
  };tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);
 },[loaded]);
 return <section className="sw-watch-card">
  <p className="sw-love-eyebrow"><Heart size={12} fill="currentColor"/> OUR LITTLE MOVIE DATE</p>
  <h2 className="mt-2 truncate font-display text-lg font-semibold">{title}</h2>
  <div className="sw-youtube-frame"><div ref={mount} className="h-full w-full"/>{!loaded&&!error&&<span className="sw-video-loading"><Video size={24}/>Getting our screen ready…</span>}</div>
  {error?<p role="alert" className="mt-3 text-sm text-pink-200">{error} <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="underline">View on YouTube</a></p>:<p className="mt-3 text-xs text-muted">{props.holding?'Keeping you together — playback resumes automatically when both screens are ready.':'Video and sound stay in step automatically. No delay settings to adjust.'}</p>}
  {blocked&&<button className="sw-video-enable" onClick={()=>{player.current?.seekTo(latest.current.getPosition(),true);player.current?.playVideo();}}><Play size={16}/>Tap once to enable video on this device</button>}
 </section>;
}
