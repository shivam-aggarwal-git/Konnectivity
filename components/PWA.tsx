"use client";

import { useEffect } from "react";

// Registers the service worker so Konnectivity is installable as a PWA.
export default function PWA() {
  useEffect(() => {
    // Service workers only work in a secure context (HTTPS or localhost).
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}
