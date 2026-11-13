"use client";

import { useEffect, useRef, useState } from "react";

const maxBytes = 24 * 1024 * 1024;

export function usePausedAudioDownload(source: string | undefined, paused: boolean, buffering: boolean, fullyBuffered: boolean) {
  const [download, setDownload] = useState<{ source: string; url: string }>();
  const attempt = useRef<{ source: string; controller: AbortController; url?: string } | null>(null);

  useEffect(() => () => {
    const current = attempt.current;
    if (current?.source !== source) return;
    current?.controller.abort();
    if (current?.url) URL.revokeObjectURL(current.url);
    attempt.current = null;
  }, [source]);

  useEffect(() => {
    if (!source || (!paused && !buffering) || fullyBuffered || attempt.current?.source === source) return;
    const controller = new AbortController();
    const current: NonNullable<typeof attempt.current> = { source, controller };
    async function preload() {
      attempt.current = current;
      const response = await fetch(current.source, { signal: controller.signal, cache: "no-store" });
      const size = Number(response.headers.get("Content-Length"));
      if (!response.ok || size > maxBytes || !response.body) {
        await response.body?.cancel();
        return;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await reader.cancel(); return; }
        chunks.push(new Uint8Array(value));
      }
      if (controller.signal.aborted || (size > 0 && total !== size)) return;
      const url = URL.createObjectURL(new Blob(chunks, { type: response.headers.get("Content-Type") || "audio/mp4" }));
      current.url = url;
      setDownload({ source: current.source, url });
    }
    const timer = setTimeout(() => { void preload().catch(() => { if(attempt.current===current)attempt.current=null; }); }, paused ? 0 : 3500);
    return () => clearTimeout(timer);
  }, [source, paused, buffering, fullyBuffered]);

  return download?.source === source ? download?.url : undefined;
}
