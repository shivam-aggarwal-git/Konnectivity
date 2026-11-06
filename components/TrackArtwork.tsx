"use client";
import {useState} from 'react';
import type {Track} from '@/lib/types';
import TogetherAnimation from './TogetherAnimation';

function ArtworkAttempt({sources,title,playing}:{sources:string[];title:string;playing:boolean}) {
  const [index,setIndex]=useState(0);
  if(index>=sources.length)return <div className="grid size-full place-items-center bg-white/[0.04]" aria-label="Shared soundtrack artwork"><TogetherAnimation playing={playing}/></div>;
  return <img src={sources[index]} alt={`${title} cover art`} className="sw-art-in size-full object-cover" onError={()=>setIndex(i=>i+1)}/>;
}
export default function TrackArtwork({track,playing}:{track:Track|null;playing:boolean}) {
  const sources=[...new Set([track?.art,track?.thumbnail,...(track&&/^[\w-]{11}$/.test(track.videoId)?[`/api/artwork?videoId=${encodeURIComponent(track.videoId)}`]:[])].filter((v):v is string=>Boolean(v)))];
  return <ArtworkAttempt key={JSON.stringify(sources)} sources={sources} title={track?.title||'Our soundtrack'} playing={playing}/>;
}
