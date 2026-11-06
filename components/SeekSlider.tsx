"use client";
import type { CSSProperties } from "react";
import { useState, useEffect, useRef } from "react";
export default function SeekSlider({ position, duration, disabled, onSeek, trackId }: {
  position: number; duration: number; disabled: boolean; onSeek: (seconds: number) => void; trackId?: string;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const previousTrack = useRef(trackId);
  useEffect(() => { if (previousTrack.current !== trackId) { previousTrack.current = trackId; pending.current = null; setDraft(null); } }, [trackId]);
  useEffect(() => { if (pending.current !== null && Math.abs(position - pending.current) < 1) { pending.current = null; setDraft(null); } }, [position]);
  function commit(value: number) { pending.current = value; onSeek(value); }
  return <input type="range" min={0} max={duration || 1} step={0.1}
    value={Math.max(0, Math.min(duration, draft ?? position))} disabled={disabled}
    aria-label="Song timeline" aria-valuetext={`${Math.floor(draft ?? position)} of ${Math.floor(duration)} seconds`}
    style={{ "--seek-percent": `${duration ? Math.max(0, Math.min(100, ((draft ?? position) / duration) * 100)) : 0}%` } as CSSProperties}
    className="sw-range sw-timeline w-full min-w-0 flex-1 touch-none"
    onPointerDown={e => { pending.current = null; setDraft(Number(e.currentTarget.value)); e.currentTarget.setPointerCapture(e.pointerId); }}
    onChange={e => { setDraft(Number(e.currentTarget.value)); }}
    onPointerUp={e => commit(Number(e.currentTarget.value))}
    onPointerCancel={() => { pending.current = null; setDraft(null); }}
    onKeyUp={e => { if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) commit(Number(e.currentTarget.value)); }}
    onBlur={e => { if (draft !== null && pending.current === null) commit(Number(e.currentTarget.value)); }} />;
}
