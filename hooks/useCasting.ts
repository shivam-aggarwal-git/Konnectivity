"use client";

import { useEffect, useState } from "react";

/**
 * Chromecast/AirPlay via the browser's own Remote Playback API — no server or
 * protocol involvement, same category as local volume.
 *
 * Best-effort: the sync loop's 0.75s hard-correction may fight a cast
 * target's own relay latency, which is harmless if audible, since local
 * output isn't what's playing on the connected device.
 *
 * `getElement` is a getter rather than a fixed ref because crossfade swaps
 * which of the two `<audio>` elements is authoritative. It must be a stable
 * `useCallback` that changes identity when the active element does — the
 * listener effect keys off it, so a getter that never changes identity would
 * leave this watching an element the room has already retired, reporting a
 * cast session that ended (or missing one that started).
 */
export function useCasting(getElement: () => HTMLMediaElement | null, mediaPath?:string) {
  const [supported, setSupported] = useState(false);
  const [publicOrigin,setPublicOrigin]=useState("");
  useEffect(()=>{let live=true;fetch("/api/share").then(r=>r.json()).then(d=>{if(live)setPublicOrigin(d.publicUrl||window.location.origin);}).catch(()=>{});return()=>{live=false;};},[]);
  const [error,setError]=useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setSupported(typeof HTMLMediaElement !== "undefined" && "remote" in HTMLMediaElement.prototype);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const remote = getElement()?.remote;
    if (!remote) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    remote.addEventListener("connect", onConnect);
    remote.addEventListener("disconnect", onDisconnect);
    // Adopt whatever this element's state already is: after a slot flip the
    // events that would have told us fired on the other element.
    setConnected(remote.state === "connected");
    return () => {
      remote.removeEventListener("connect", onConnect);
      remote.removeEventListener("disconnect", onDisconnect);
    };
  }, [supported, getElement]);

  const prompt = () => {
    setError("");const element=getElement();
    if(!element){setError("Start a song or uploaded video before casting.");return;}
    if(!element.remote){setError("Casting is unavailable in this browser. Use a compatible browser and receiver on the same network.");return;}
    if(element.src.startsWith('blob:')){
      if(!mediaPath||!publicOrigin||/localhost|127\.0\.0\.1/.test(publicOrigin)){setError("Open this room through its public HTTPS link before casting uploaded media.");return;}
      const time=element.currentTime;const paused=element.paused;
      element.src=new URL(mediaPath,publicOrigin).href;
      element.addEventListener('loadedmetadata',()=>{element.currentTime=time;if(!paused)void element.play().catch(()=>{});},{once:true});
    }
    element.remote.prompt().catch((e:Error)=>{if(e.name!=="NotAllowedError")setError("No compatible receiver was available. Check that both devices use the same Wi-Fi network.");});
  };

  return { supported, connected, prompt, error };
}
