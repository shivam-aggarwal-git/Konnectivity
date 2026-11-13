"use client";
import {useEffect} from 'react';
import {prepareVideo} from '@/lib/video-preload';
import {primeYouTubeFrame} from './YouTubePlayer';
import type {Track} from '@/lib/types';
export default function NextVideoPreload({track,room,token}:{track?:Track;room:string;token:string}){
 useEffect(()=>{
  if(!track)return;
  if(!track.videoId.startsWith('local_'))return primeYouTubeFrame(track.videoId);
  if(track.mediaType!=='video')return;
  const controller=new AbortController();
  void prepareVideo(`/audio/${track.videoId}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`,controller.signal).catch(()=>{});
  return()=>controller.abort();
 },[track?.videoId,room,token]);
 return null;
}
