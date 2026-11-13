"use client";

import { useEffect, useRef, useState } from "react";
import {preparedVideo} from "@/lib/video-preload";
import { hasStartupBuffer, readBuffered, type BufferedRange } from "@/lib/media-buffer";

type Props = {
  src: string;
  title: string;
  volume: number;
  syncKey: string;
  getPosition: () => number;
  getRunning: () => boolean;
  onReadyChange: (ready: boolean, key: string, blocked?: boolean) => void;
  onEnded: () => void;
  onElement: (element: HTMLVideoElement | null) => void;
  onBuffer: (ranges: BufferedRange[]) => void;
};

export default function UploadedVideo(props: Props) {
  const { src, title, syncKey, onEnded, onElement } = props;
  const [preparedSource,setPreparedSource]=useState(()=>preparedVideo(src)||src);
  useEffect(()=>{setPreparedSource(preparedVideo(src)||src);const ready=()=>{if(ref.current?.paused)setPreparedSource(preparedVideo(src)||src);};window.addEventListener('konnectivity:video-preloaded',ready);return()=>window.removeEventListener('konnectivity:video-preloaded',ready);},[src]);
  const ref = useRef<HTMLVideoElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const permissionBlocked = useRef(false);
  const primed = useRef(false);

  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    onElement(media);
    setError("");
    setBlocked(false);
    permissionBlocked.current = false;
    pending.current = false;
    primed.current = false;
    let anchor: number | undefined;
    let previousTarget: number | undefined;
    let previousTick = performance.now();
    let disposed = false;

    function tick() {
      if (!media || disposed) return;
      const settings = latest.current;
      const ranges = readBuffered(media);
      settings.onBuffer(ranges);
      const target = settings.getPosition();
      const now = performance.now();
      const running = settings.getRunning();
      if ((previousTarget !== undefined && Math.abs(target - previousTarget) > (now - previousTick) / 1000 + 1) ||
          (running && !media.paused && !media.seeking && media.readyState < 3)) {
        primed.current = false;
        anchor = undefined;
        media.pause();
      }
      previousTarget = target;
      previousTick = now;
      const targetReady = hasStartupBuffer(ranges, target, media.duration);
      if (!primed.current && media.readyState >= 1 && !media.seeking) {
        if (anchor === undefined) {
          anchor = target;
          if (Math.abs(media.currentTime - target) > .25) media.currentTime = target;
        }
        primed.current = !media.seeking &&
          (targetReady || (Math.abs(target - anchor) > 10 && hasStartupBuffer(ranges, anchor, media.duration)));
      }
      if (primed.current && !media.seeking && targetReady && Math.abs(media.currentTime - target) > .6) {
        media.currentTime = target;
      }
      const ready = primed.current && media.readyState >= 2 && !media.seeking;
      settings.onReadyChange(ready && !permissionBlocked.current, settings.syncKey, permissionBlocked.current);
      media.volume = settings.volume;
      if (!running || !primed.current) {
        if (!pending.current && !media.paused) media.pause();
        return;
      }
      if (!ready || !media.paused || pending.current || permissionBlocked.current) return;
      pending.current = true;
      void media.play().catch(err => {
        if (disposed) return;
        if (err?.name === "NotAllowedError") {
          permissionBlocked.current = true;
          setBlocked(true);
          settings.onReadyChange(false, settings.syncKey, true);
        } else if (err?.name !== "AbortError") {
          setError("Video playback could not start. Tap Enable video to retry.");
          setBlocked(true);
        }
      }).finally(() => { if (!disposed) pending.current = false; });
    }
    tick();
    const timer = setInterval(tick, 250);
    media.addEventListener("progress", tick);
    return () => {
      disposed = true;
      clearInterval(timer);
      media.removeEventListener("progress", tick);
      media.pause();
      onElement(null);
    };
  }, [preparedSource, src, syncKey, onElement]);

  async function enable() {
    const media = ref.current;
    if (!media || pending.current) return;
    permissionBlocked.current = false;
    pending.current = true;
    const muted = media.muted;
    if (!primed.current) media.muted = true;
    try {
      await media.play();
      setBlocked(false);
      if (!latest.current.getRunning() || !primed.current) media.pause();
    } catch {
      permissionBlocked.current = true;
      setBlocked(true);
      props.onReadyChange(false, syncKey, true);
      setError("Playback was blocked. Tap Enable video again, or open this invitation directly in Safari.");
    } finally {
      pending.current = false;
      media.muted = muted;
    }
  }

  return <section className="sw-watch-card">
    <h2 className="mb-3 truncate font-semibold">{title}</h2>
    <video ref={ref} src={preparedSource} className="kn-uploaded-video" playsInline preload="auto" onEnded={onEnded}
      onError={() => {
        setError("This device could not decode or load this video. Try an MP4 encoded with H.264 video and AAC audio.");
        props.onReadyChange(false, syncKey, true);
      }} />
    {blocked && <button className="kn-device-enable" onClick={() => void enable()}>Enable video on this device</button>}
    {error && <p role="alert">{error}</p>}
    <p className="mt-3 text-xs text-muted">Use the room controls below for shared playback.</p>
  </section>;
}
