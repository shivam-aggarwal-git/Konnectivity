"use client";
import {useEffect} from "react";

/** Shared dismissal for native anchored menus. Disclosures are intentionally excluded. */
export default function MenuDismiss(){
 useEffect(()=>{
  const openMenus=()=>document.querySelectorAll<HTMLDetailsElement>('details.chat-more-menu[open],details[data-menu][open]');
  const outside=(event:PointerEvent)=>{const target=event.target;if(!(target instanceof Node))return;openMenus().forEach(menu=>{if(!menu.contains(target))menu.open=false;});};
  const selected=(event:MouseEvent)=>{const target=event.target;if(!(target instanceof Element))return;const action=target.closest('button,a[href]');const menu=action?.closest<HTMLDetailsElement>('details.chat-more-menu,details[data-menu]');if(menu)menu.open=false;};
  const escape=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;const menus=[...openMenus()];menus.forEach(menu=>menu.open=false);menus.at(-1)?.querySelector<HTMLElement>('summary')?.focus();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('click',selected);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('click',selected);document.removeEventListener('keydown',escape);};
 },[]);
 return null;
}
