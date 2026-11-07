"use client";
import {useEffect,useRef,useState} from 'react';
import type {AnimationItem} from 'lottie-web';
import AmbientVisualizer from './AmbientVisualizer';
import {Heart} from 'lucide-react';
import {useAppearance} from '@/hooks/useAppearance';
export default function TogetherAnimation({playing=false}:{playing?:boolean}){
 const host=useRef<HTMLDivElement>(null),animation=useRef<AnimationItem|null>(null);const[loaded,setLoaded]=useState(false);const prefs=useAppearance();
 useEffect(()=>{let disposed=false;import('lottie-web').then(({default:lottie})=>{if(disposed||!host.current)return;const item=lottie.loadAnimation({container:host.current,renderer:'svg',loop:true,autoplay:false,path:'/animations/together.json',rendererSettings:{progressiveLoad:true}});animation.current=item;item.addEventListener('DOMLoaded',()=>{if(!disposed){item.goToAndStop(15,true);setLoaded(true);}});item.addEventListener('data_failed',()=>{if(!disposed)setLoaded(false);});}).catch(()=>{});return()=>{disposed=true;animation.current?.destroy();animation.current=null;};},[]);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>{const a=animation.current;if(!a)return;if(loaded&&playing&&prefs.motion&&prefs.visualizer==='orbit'&&!query.matches&&document.visibilityState==='visible')a.play();else a.pause();};sync();query.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);return()=>{query.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};},[loaded,playing,prefs.motion,prefs.visualizer]);
 return <div className="kn-together-art" aria-hidden="true"><div className="kn-orbit-ring"/><div className="kn-orbit-ring kn-orbit-ring-2"/><div ref={host} className="kn-lottie" style={{visibility:prefs.visualizer==='orbit'?'visible':'hidden'}}/>{prefs.visualizer!=='orbit'&&prefs.visualizer!=='off'&&<AmbientVisualizer playing={playing} art/>}{(!loaded||prefs.visualizer==='off')&&<Heart className="kn-heart-fallback" size={42}/>}<span className="kn-record-caption">ONE BEAT. TWO HEARTS</span></div>;
}
