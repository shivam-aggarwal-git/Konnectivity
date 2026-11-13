"use client";

import { useEffect } from "react";

// Registers the service worker so Konnectivity is installable as a PWA.
export default function PWA() {
  useEffect(() => {
    // A tab may still reference an immutable chunk from the previous build.
    // Recover once, preserving the room URL and saved identity, without loops.
    const recover=(event:ErrorEvent|PromiseRejectionEvent)=>{
      const reason='reason' in event?event.reason:event.error||event.message;
      const message=String(reason?.message||reason||'');
      if(!/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message))return;
      try{const last=Number(sessionStorage.getItem('kn-chunk-recovery'))||0;if(Date.now()-last<300000)return;sessionStorage.setItem('kn-chunk-recovery',String(Date.now()));window.location.reload();}catch{}
    };
    window.addEventListener('error',recover);window.addEventListener('unhandledrejection',recover);

    // Service workers only work in a secure context (HTTPS or localhost).
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    return()=>{window.removeEventListener("error",recover);window.removeEventListener("unhandledrejection",recover);};
  }, []);
  return null;
}
