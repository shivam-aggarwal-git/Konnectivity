"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
// A software gain stage lets the shared volume work on iPhones too, where
// HTMLAudioElement.volume is fixed by the browser. Element volume remains
// available for track normalization and crossfade envelopes.
export function useRoomGain(enabled: boolean, first: RefObject<HTMLAudioElement | null>, second: RefObject<HTMLAudioElement | null>, volume: number) {
  const context = useRef<AudioContext | null>(null), gain = useRef<GainNode | null>(null);
  const [outputLatency, setOutputLatency] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const latestVolume = useRef(volume); latestVolume.current = volume;
  useEffect(() => {
    if (!enabled || !first.current || !second.current || context.current || !window.AudioContext) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const output = ctx.createGain(); output.gain.value = latestVolume.current; output.connect(ctx.destination);
      ctx.createMediaElementSource(first.current).connect(output);
      ctx.createMediaElementSource(second.current).connect(output);
      context.current = ctx; gain.current = output; setActive(true);
      setSuspended(ctx.state === "suspended");
      ctx.onstatechange = () => setSuspended(ctx?.state === "suspended");
      void ctx.resume().catch(() => {});
    } catch { void ctx?.close(); }
    // Keep the graph for this pair of elements for the component lifetime.
  }, [enabled, first, second]);
  useEffect(() => { if (gain.current && context.current) gain.current.gain.setTargetAtTime(volume, context.current.currentTime, 0.015); }, [volume, active]);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const ctx = context.current;
      if (!ctx || ctx.state !== "running") return;
      const device = ctx.outputLatency;
      setOutputLatency(Number.isFinite(device) && device >= 0 ? Math.min(5, device + (ctx.baseLatency || 0)) : null);
    };
    measure(); const timer = setInterval(measure, 2000); return () => clearInterval(timer);
  }, [active]);
  const resume = useCallback(() => { if (context.current?.state === "suspended") void context.current.resume().catch(() => {}); }, []);
  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("pointerdown", resume); document.addEventListener("keydown", resume);
    return () => { document.removeEventListener("pointerdown", resume); document.removeEventListener("keydown", resume); };
  }, [enabled, resume]);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  return { active, suspended, resume, outputLatency };
}
