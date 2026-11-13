"use client";

import { useEffect, useState } from "react";

/** Keep iOS audio on the browser's media element and system volume controls. */
export function useRoomAudioSession(enabled: boolean) {
  const [nativeVolumeOnly,setNativeVolumeOnly]=useState(false);
  useEffect(() => {
    if (!enabled) return;
    setNativeVolumeOnly(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const resume = () => {
      if (document.documentElement.dataset.knCallActive === "true") return;
      const session = (navigator as Navigator & {audioSession?:{type:string}}).audioSession;
      if (session) { try { session.type = "playback"; } catch {} }
    };
    const onVisible = () => { if (document.visibilityState === "visible") resume(); };
    resume();
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("pageshow",resume);
    return () => {
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("pageshow",resume);
    };
  }, [enabled]);
  return nativeVolumeOnly;
}
