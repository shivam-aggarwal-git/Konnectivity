"use client";
import {useEffect,useState} from 'react';
export type Appearance={theme:'moonlight'|'rosewood'|'candlelight'|'aurora'|'sunset'|'ocean';motion:boolean;visualizer:'orbit'|'wave'|'off';lights:'off'|'glow'|'breathe';background:'none'|'photo'|'artwork';backgroundImageId:string|null;backgroundDim:number;showArtwork:boolean};
const DEFAULT:Appearance={theme:'moonlight',motion:true,visualizer:'orbit',lights:'breathe',background:'none',backgroundImageId:null,backgroundDim:.58,showArtwork:true};
const KEY='konnectivity_appearance';
function read():Appearance{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return{theme:['moonlight','rosewood','candlelight','aurora','sunset','ocean'].includes(v.theme)?v.theme:DEFAULT.theme,motion:typeof v.motion==='boolean'?v.motion:true,visualizer:['orbit','wave','off'].includes(v.visualizer)?v.visualizer:'orbit',lights:['off','glow','breathe'].includes(v.lights)?v.lights:'breathe',background:['none','photo','artwork'].includes(v.background)?v.background:'none',backgroundImageId:typeof v.backgroundImageId==='string'&&/^[a-f0-9]{32}$/.test(v.backgroundImageId)?v.backgroundImageId:null,backgroundDim:typeof v.backgroundDim==='number'&&Number.isFinite(v.backgroundDim)?Math.max(.25,Math.min(.85,v.backgroundDim)):.58,showArtwork:typeof v.showArtwork==='boolean'?v.showArtwork:true};}catch{return DEFAULT;}}
function apply(v:Appearance){const root=document.documentElement;root.dataset.roomTheme=v.theme;root.dataset.roomMotion=v.motion?'on':'off';root.dataset.roomVisualizer=v.visualizer;}
export function receiveRoomAppearance(value:Appearance){
 try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}
 window.dispatchEvent(new CustomEvent('konnectivity:appearance',{detail:value}));
}
export function useAppearance(){
 const[value,setValue]=useState<Appearance>(DEFAULT);
 useEffect(()=>{const sync=(e?:Event)=>{const v=(e as CustomEvent<Appearance>)?.detail||read();setValue(v);apply(v);};const visibility=()=>{document.documentElement.dataset.roomVisibility=document.visibilityState;};sync();visibility();document.addEventListener('visibilitychange',visibility);window.addEventListener('konnectivity:appearance',sync);window.addEventListener('storage',sync);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('konnectivity:appearance',sync);window.removeEventListener('storage',sync);};},[]);
 const update=(patch:Partial<Appearance>)=>{const next={...value,...patch};setValue(next);apply(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}window.dispatchEvent(new CustomEvent('konnectivity:appearance',{detail:next}));window.dispatchEvent(new CustomEvent('konnectivity:appearance-request',{detail:patch}));};
 return{...value,update};
}
