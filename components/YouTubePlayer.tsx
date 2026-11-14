"use client";
import {reconcileYouTubeVolume} from "@/lib/youtube-volume.mjs";
import {nativeTransportIntent} from "@/lib/youtube-transport.mjs";
import ShortsGestureSurface from "./ShortsGestureSurface";
import { useEffect, useRef, useState } from "react";
import type { BufferedRange } from "@/lib/media-buffer";
import { Heart, Play, Video } from "lucide-react";
type Player = { loadPlaylist(options:{playlist:string[];index:number;startSeconds:number}):void; cuePlaylist(options:{playlist:string[];index:number;startSeconds:number}):void; getPlaylist?():string[]; loadVideoById(options:{videoId:string;startSeconds:number}):void; cueVideoById(options:{videoId:string;startSeconds:number}):void; destroy():void; getCurrentTime():number; getVolume():number; isMuted():boolean; unMute():void; getPlayerState():number; getDuration():number; getVideoLoadedFraction?():number; getVideoData():{title?:string;video_id?:string;author?:string}; seekTo(t:number,a:boolean):void; playVideo():void; pauseVideo():void; setVolume(n:number):void; getIframe():HTMLIFrameElement };
declare global { interface Window { YT?: { Player:new(element:HTMLElement, options:any)=>Player }; onYouTubeIframeAPIReady?:()=>void } }
let loading:Promise<void>|undefined;
const nextFrames=new Map<string,HTMLIFrameElement>();
export function primeYouTubeFrame(videoId:string){
 if(nextFrames.has(videoId))return ()=>{};
 const frame=document.createElement('iframe');frame.referrerPolicy='strict-origin-when-cross-origin';frame.title='Preparing next video';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:240px;height:240px;visibility:hidden;pointer-events:none';
 frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
 frame.src=`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&controls=1&fs=1&cc_load_policy=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
 nextFrames.set(videoId,frame);document.body.appendChild(frame);
 return()=>{queueMicrotask(()=>{if(nextFrames.get(videoId)===frame){nextFrames.delete(videoId);frame.remove();}});};
}

function loadApi() {
 if(window.YT?.Player)return Promise.resolve();
 if(!loading)loading=new Promise<void>((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{loading=undefined;reject(Error('YouTube could not load. Check your connection or content blocker.'));};document.head.appendChild(script);
 });return loading;
}
export type PlaybackSample = { position: number; state: "checking" | "playing" | "buffering" | "stopped" | "blocked" | "interrupted" | "error" | "casting" };
type Props = { shorts?:boolean;onNextShort?:()=>void;onPreviousShort?:()=>void;videoId:string; position:number; playing:boolean; desiredPlaying:boolean; holding:boolean; volume:number; title:string; artist?:string;
 onVolume:(volume:number)=>void; onSeek:(position:number)=>void; onVideoChange:(videoId:string)=>void; onPlaying:(playing:boolean)=>void; onEnded:()=>void; onMetadata:(duration:number,title:string,artist?:string)=>void;
 getPosition:()=>number; getRunning:()=>boolean; syncKey:string; onReadyChange:(ready:boolean,key:string)=>void; onBuffer:(ranges:BufferedRange[])=>void; onPlaybackSampler:(sample:(()=>PlaybackSample)|null)=>void };
export default function YouTubePlayer(props:Props) {
 const {videoId,title,syncKey}=props;
 const latest=useRef(props);latest.current=props;
 const mount=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),ready=useRef(false),localReady=useRef(false);
 const actualSample=useRef<{position:number;time:number}|null>(null),pendingSeek=useRef(0),requestedAt=useRef(performance.now()),nativeVideo=useRef("");
 const volumeState=useRef<any>({applied:0,audible:false,prop:null,pending:null,until:0});
 const observedState=useRef<number|null>(null);
 const transportCommand=useRef<{state:number;until:number}>({state:-1,until:0}),nativeIntent=useRef<{playing:boolean;until:number}|null>(null);
 const commandTransport=(p:Player,playing:boolean)=>{const state=playing?1:2;if(p.getPlayerState()===state)return;transportCommand.current={state,until:performance.now()+2000};if(playing)p.playVideo();else p.pauseVideo();};
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
 useEffect(()=>{
  if(props.shorts)return;const abort=new AbortController();let cancelled=false;
  fetch(`/api/video-recommend?${new URLSearchParams({videoId,title,artist:props.artist||''})}`,{signal:abort.signal}).then(response=>response.ok?response.json():null).then(result=>{if(cancelled||!result?.results?.length)return;const p=player.current;if(!p||!ready.current||latest.current.videoId!==videoId)return;const existing=p.getPlaylist?.()||[];if(existing.length>1&&existing.includes(videoId))return;const ids=[...new Set<string>([videoId,...result.results.map((track:{videoId:string})=>track.videoId)])];if(ids.length<2)return;const sequence={playlist:ids,index:0,startSeconds:p.getCurrentTime()};transportCommand.current={state:latest.current.desiredPlaying?1:2,until:performance.now()+2500};requestedAt.current=performance.now();if(latest.current.desiredPlaying)p.loadPlaylist(sequence);else p.cuePlaylist(sequence);
  }).catch(()=>{});return()=>{cancelled=true;abort.abort();};
 },[videoId,title,props.artist,props.shorts,loaded]);
 useEffect(()=>{localReady.current=false;aligned.current=false;bufferSince.current=0;latest.current.onReadyChange(false,syncKey);},[syncKey]);
 useEffect(()=>{
  let disposed=false;ready.current=false;reported.current=false;setLoaded(false);setError('');setBlocked(false);
  // Set referrer policy before the first embed request. onReady is too late
  // for YouTube client identification (error 153); never send room query tokens.
  const preloaded=nextFrames.get(videoId);if(preloaded)nextFrames.delete(videoId);
  const element=preloaded||document.createElement('iframe');element.removeAttribute('style');element.removeAttribute('aria-hidden');element.removeAttribute('tabindex');
  element.title=title || 'YouTube video';
  element.referrerPolicy='strict-origin-when-cross-origin';
  element.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
  element.allowFullscreen=true;
  if(!preloaded)element.src=`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&controls=1&fs=1&cc_load_policy=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
  mount.current?.replaceChildren(element);
  loadApi().then(()=>{
   if(disposed||!window.YT)return;
   const p=new window.YT.Player(element,{videoId,host:'https://www.youtube.com',width:'100%',height:'100%',playerVars:{playsinline:1,controls:1,rel:0,fs:1,cc_load_policy:1,origin:window.location.origin,enablejsapi:1},events:{
    onReady:()=>{if(disposed)return;ready.current=true;setLoaded(true);p.getIframe().setAttribute('referrerpolicy','strict-origin-when-cross-origin');p.setVolume(0);p.seekTo(latest.current.getPosition(),true);lastSeek.current=performance.now();aligned.current=true;if(latest.current.videoId!==videoId){const next={videoId:latest.current.videoId,startSeconds:latest.current.getPosition()};if(latest.current.desiredPlaying){transportCommand.current={state:1,until:performance.now()+2000};p.loadVideoById(next);}else {transportCommand.current={state:2,until:performance.now()+2000};p.cueVideoById(next);}}else if(latest.current.desiredPlaying)commandTransport(p,true);else commandTransport(p,false);},
    onAutoplayBlocked:()=>{setBlocked(true);localReady.current=false;latest.current.onReadyChange(false,latest.current.syncKey);},
    onStateChange:(e:{data:number})=>{
     if(!ready.current)return;
     observedState.current=e.data;
     const now=performance.now(),s=latest.current,data=p.getVideoData();
     // A recommendation that changes the video inside the embed becomes room media.
     if(data.video_id&&data.video_id!==s.videoId&&now-requestedAt.current>1000){if(nativeVideo.current!==data.video_id){nativeVideo.current=data.video_id;s.onVideoChange(data.video_id);}return;}
     const intent=nativeTransportIntent({state:e.data,desiredPlaying:s.desiredPlaying,holding:s.holding,ready:ready.current,command:transportCommand.current.state,commandUntil:transportCommand.current.until,now,lastSeek:lastSeek.current,requestedAt:requestedAt.current});
     if(e.data===transportCommand.current.state||intent!==null)transportCommand.current={state:-1,until:0};
     if(intent!==null){nativeIntent.current={playing:intent,until:now+2500};s.onPlaying(intent);}
     if(e.data===1){setBlocked(false);bufferSince.current=0;localReady.current=true;latest.current.onReadyChange(true,latest.current.syncKey);}
     if(e.data===3 && !bufferSince.current)bufferSince.current=performance.now();
     if(e.data===0 && latest.current.getPosition()>p.getDuration()-3)latest.current.onEnded();
     // App-driven pause/play echoes are suppressed; user transport is shared.
    },
    onError:(e:{data:number})=>{localReady.current=false;latest.current.onReadyChange(false,latest.current.syncKey);setError([101,150].includes(e.data)?'This video cannot be embedded. Try a different YouTube video.':e.data===153?'YouTube could not verify this embed. Open the room through its HTTPS share link.':'This video is unavailable here. Try another YouTube link.');},
   }});player.current=p;
  }).catch(e=>{if(!disposed)setError(e.message);});
  return()=>{disposed=true;ready.current=false;player.current?.destroy();player.current=null;};
 // Keep this iframe alive across tracks so the initial playback permission survives.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  const p=player.current;if(!p||!ready.current)return;
  reported.current=false;localReady.current=false;aligned.current=false;previousTarget.current=null;actualSample.current=null;requestedAt.current=performance.now();nativeVideo.current="";
  bufferSince.current=0;setError('');setBlocked(false);
  p.getIframe().title=title || 'YouTube video';
  if(p.getVideoData().video_id===videoId)return;
  const next={videoId,startSeconds:latest.current.getPosition()};
  if(latest.current.desiredPlaying){transportCommand.current={state:1,until:performance.now()+2000};p.loadVideoById(next);}else {transportCommand.current={state:2,until:performance.now()+2000};p.cueVideoById(next);}
 // A title update for the same video must not reload playback.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[videoId]);
 useEffect(()=>{
  const tick=()=>{
   const p=player.current;if(!p||!ready.current)return;
   const s=latest.current,state=p.getPlayerState(),now=performance.now(),target=s.getPosition(),running=s.getRunning();
   // Polling is a fallback for browsers which miss/delay the iframe state event.
   if(!nativeIntent.current&&state!==observedState.current){observedState.current=state;const intent=nativeTransportIntent({state,desiredPlaying:s.desiredPlaying,holding:s.holding,ready:ready.current,command:transportCommand.current.state,commandUntil:transportCommand.current.until,now,lastSeek:lastSeek.current,requestedAt:requestedAt.current});if(state===transportCommand.current.state||intent!==null)transportCommand.current={state:-1,until:0};if(intent!==null){nativeIntent.current={playing:intent,until:now+2500};s.onPlaying(intent);}}
   const waiting=nativeIntent.current;
   if(waiting){if(s.desiredPlaying===waiting.playing||now>waiting.until)nativeIntent.current=null;else return;}
   const duration = p.getDuration();
   const loaded = p.getVideoLoadedFraction?.() ?? 0;
   s.onBuffer(duration > 0 && loaded > 0 ? [[0, Math.min(1, loaded) * duration]] : []);
   if(!reported.current&&p.getDuration()>0&&p.getVideoData().video_id===s.videoId){reported.current=true;s.onMetadata(p.getDuration(),p.getVideoData().title||'YouTube video',p.getVideoData().author);}
   if(state===3&&bufferSince.current&&now-bufferSince.current>650){localReady.current=false;s.onReadyChange(false,s.syncKey);}
   if(state===1){bufferSince.current=0;localReady.current=true;}
   const prime=s.desiredPlaying&&!localReady.current;
   // Prime silently while the shared clock is held. Once all listeners can
   // play, the server schedules the same resume instant for everyone.
   const volume=reconcileYouTubeVolume(volumeState.current,{desired:s.volume*100,actual:p.isMuted()?0:p.getVolume(),audible:running&&localReady.current,now});
   volumeState.current=volume.state;
   if(volume.notify!==null)s.onVolume(volume.notify);
   if(volume.apply!==null){p.setVolume(volume.apply);if(volume.apply>0&&p.isMuted())p.unMute();}
   const before=previousTarget.current;
   const jumped=Boolean(before && Math.abs(target-before.position-(running?(now-before.time)/1000:0))>.6);
   previousTarget.current={position:target,time:now};
   const actual=p.getCurrentTime(),data=p.getVideoData();
   if(data.video_id&&data.video_id!==s.videoId&&now-requestedAt.current>1500&&reported.current&&nativeVideo.current!==data.video_id){nativeVideo.current=data.video_id;s.onVideoChange(data.video_id);return;}
   const sample=actualSample.current;actualSample.current={position:actual,time:now};
   const elapsed=sample?(now-sample.time)/1000:0;
   if(sample&&elapsed<1&&!jumped&&aligned.current&&now-lastSeek.current>2000&&data.video_id===s.videoId&&Math.abs(actual-sample.position-(state===1?elapsed:0))>2){pendingSeek.current=now+3500;lastSeek.current=now;s.onSeek(actual);}
   if(jumped)pendingSeek.current=0;
   const drift=actual-target;
   if(now>pendingSeek.current&&document.visibilityState==="visible"&&(jumped||!aligned.current||Math.abs(drift)>(running?1.25:.15))&&state!==3&&(jumped||now-lastSeek.current>3000)){p.seekTo(target,true);lastSeek.current=now;aligned.current=true;}
   if((running||prime)&&state!==1&&state!==3&&now-attempt.current>1500){attempt.current=now;commandTransport(p,true);}
   if(!running&&!prime&&state!==2&&state!==5)commandTransport(p,false);
   if(localReady.current)s.onReadyChange(true,s.syncKey);
  };tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);
 },[loaded]);
 return <section className="sw-watch-card">
  <p className="sw-love-eyebrow"><Heart size={12} fill="currentColor"/> OUR LITTLE MOVIE DATE</p>
  <h2 className="mt-2 truncate font-display text-lg font-semibold">{title}</h2>
  <div className="sw-youtube-frame"><div ref={mount} className="h-full w-full"/>{props.shorts&&<ShortsGestureSurface onNext={props.onNextShort} onPrevious={props.onPreviousShort} onTap={()=>{const p=player.current;if(!p)return;const play=p.getPlayerState()!==1;if(play)p.playVideo();else p.pauseVideo();latest.current.onPlaying(play);}}/>}{!loaded&&!error&&<span className="sw-video-loading"><Video size={24}/>Getting our screen ready…</span>}</div>
  {error?<p role="alert" className="mt-3 text-sm text-pink-200">{error} <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="underline">View on YouTube</a></p>:<p className="mt-3 text-xs text-muted">{props.holding?'Keeping you together — playback resumes automatically when both screens are ready.':'Video and sound stay in step automatically. No delay settings to adjust.'}</p>}
  {blocked&&<button className="sw-video-enable" onClick={()=>{player.current?.seekTo(latest.current.getPosition(),true);player.current?.playVideo();}}><Play size={16}/>Tap once to enable video on this device</button>}
 </section>;
}
