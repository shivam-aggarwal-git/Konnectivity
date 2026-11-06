"use client";
import {useEffect} from "react";
/** Keep sheets and chat above a phone's on-screen keyboard without moving playback. */
export function useAppViewport() {
 useEffect(()=>{
  const viewport=window.visualViewport;
  const update=()=>{if(!viewport||viewport.scale===1)document.documentElement.style.setProperty("--kn-app-height",`${Math.round(viewport?.height||window.innerHeight)}px`);};
  update();viewport?.addEventListener("resize",update);window.addEventListener("resize",update);
  return()=>{viewport?.removeEventListener("resize",update);window.removeEventListener("resize",update);document.documentElement.style.removeProperty("--kn-app-height");};
 },[]);
}
