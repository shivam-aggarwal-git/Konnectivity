"use client";
import type { BufferedRange } from "@/lib/media-buffer";

import {usePlayerSwipe} from "@/hooks/usePlayerSwipe";
import SeekSlider from "./SeekSlider";
import { useState, useEffect, useRef } from "react";
import {
  Cast,
  ChevronUp,
  ChevronDown,
  Heart,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle, RotateCcw, MicVocal,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { REACTIONS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";
import type { Repeat as RepeatMode, Track } from "@/lib/types";
import { CountButton, Cover } from "@/components/ui/track-row";

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function BottomPlayer({
  current,
  isPlaying,
  position,
  duration,
  isHost,
  downloadPct,
  bufferedRanges,
  buffering,
  preparing,
  shuffle,
  repeat,
  skipVotes,
  needVotes,
  volume,
  likes,
  liked,
  onLike,
  onVolume,
  onPlayPause,
  onSkip,
  onSeek,
  onVoteSkip,
  onShuffle,
  onReplay,
  onLyrics,
  onRepeat,
  onReact,
  castSupported,
  castConnected,
  onCast,
  expanded = false,
  compact = false,
  onToggleExpanded,
}: {
  expanded?: boolean;
  compact?: boolean;
  onToggleExpanded: () => void;
  current: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isHost: boolean;
  downloadPct: number | null;
  bufferedRanges: BufferedRange[];
  buffering: boolean;
  preparing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  skipVotes: number;
  needVotes: number;
  volume: number;
  likes: number;
  liked: boolean;
  onLike: () => void;
  onVolume: (v: number) => void;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (pos: number) => void;
  onVoteSkip: () => void;
  onShuffle: () => void;
  onReplay?: () => void;
  onLyrics?: () => void;
  onRepeat: () => void;
  onReact: (emoji: string) => void;
  /** Chromecast/AirPlay via the browser's own Remote Playback API. Experimental. */
  castSupported?: boolean;
  castConnected?: boolean;
  onCast?: () => void;
}) {
  const swipe=usePlayerSwipe({onUp:()=>{if(!expanded)onToggleExpanded();},onDown:()=>{if(expanded)onToggleExpanded();}});
  const dur = duration || current?.duration || 0;
  const cachePct = downloadPct ?? 0;
  const bufferedSeconds = bufferedRanges.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(dur, end) - start), 0);
  const bufferedPercent = dur > 0 ? Math.min(100, (dur-bufferedSeconds<.5?100:Math.floor(bufferedSeconds / dur * 100))) : 0;
  const ahead = Math.max(0, (bufferedRanges.find(([start,end])=>start<=position+.25&&end>position)?.[1] ?? position)-position);
  const bufferLabel = buffering ? "Waiting for playback…" : ahead > 1 ? `${fmt(ahead)} ready ahead` : "Loading media…";
  const loading = preparing || buffering;
  const canSeek = isHost && dur > 0 && !preparing;

  const status = preparing
    ? cachePct >= 100
      ? "Processing audio…"
      : cachePct>0?`Caching audio — ${cachePct}%`:"Preparing audio source…"
    : buffering
      ? `Buffering… ${bufferedPercent}%`
      : current?.artist;

  return (
    <footer {...swipe} data-compact={compact} className="kn-player-bar sw-safe-b sw-safe-x relative z-40 shrink-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-2xl">
      <button type="button" className="kn-player-handle" aria-label={expanded?"Collapse player to bottom bar":"Expand media player"} onClick={onToggleExpanded}>{expanded?<ChevronDown size={20}/>:<ChevronUp size={20}/>}</button>
      {/* A hairline of the current track's colour across the whole bar — the
          quietest possible way to tie the player to what is playing. */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: "linear-gradient(90deg, transparent, var(--art-1), var(--art-2), transparent)" }}
        aria-hidden
      />

      {/* Tighter on a phone: the bar is two rows there, and every pixel it
          takes comes out of the panel above it. */}
      <div className="kn-player-grid mx-auto grid max-w-[1600px] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6 md:px-6 md:py-3">
        {/* ── left: track identity ── */}
        <div className="kn-player-identity flex min-w-0 items-center gap-3">
          <Cover src={current?.thumbnail} fallbackSrc={current&&/^[\w-]{11}$/.test(current.videoId)?`/api/artwork?videoId=${encodeURIComponent(current.videoId)}`:undefined} size="md" className="sm:size-14">
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            )}
            {isPlaying && !loading && (
              <div className="absolute inset-x-0 bottom-0 grid h-5 place-items-center bg-gradient-to-t from-black/75 to-transparent">
                <span className="sw-eq h-2.5" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </Cover>
          <button type="button" className="studio-player-title min-w-0 flex-1 text-left" onClick={onToggleExpanded} aria-label={expanded ? "Collapse player" : "Open full player"}>
            <div className="truncate text-sm font-semibold text-ink">
              {current ? current.title : "Nothing playing"}
            </div>
            <div
              className={cn(
                "truncate text-xs",
                preparing || buffering ? "text-[var(--accent-2)]" : "text-muted"
              )}
            >
              {status ?? "Add a song to start"}
            </div>
          </button>

        </div>

        {/* ── centre: transport + scrubber ── */}
        <div className="kn-player-transport order-3 col-span-2 flex flex-col items-center gap-1 md:order-none md:col-span-1 md:w-[min(46vw,560px)] md:gap-2">
          <div className="studio-transport-controls flex items-center gap-2 sm:gap-3">
            <button type="button" aria-label="Replay current media" title="Replay from the beginning" disabled={!current||!isHost} onClick={onReplay||(()=>onSeek(0))} className="kn-player-replay grid size-10 place-items-center rounded-full disabled:opacity-30"><RotateCcw size={18}/></button>
            <IconToggle active={shuffle} disabled={!isHost} onClick={onShuffle} label="Shuffle and autoplay similar songs">
              <Shuffle className="size-4" />
            </IconToggle>

            <button aria-label="Back 10 seconds" title="Back 10 seconds for everyone" disabled={!canSeek}
              className="rounded-full p-2 text-xs disabled:opacity-30 hover:bg-white/10" onClick={() => onSeek(Math.max(0, position - 10))}>−10s</button>
            {isHost ? (
              <button
                onClick={onPlayPause}
                disabled={preparing || !current}
                className={cn(
                  "grid size-11 place-items-center rounded-full text-white md:size-12",
                  "bg-[image:linear-gradient(135deg,var(--art-1),var(--art-2))]",
                  "shadow-[0_8px_28px_-8px_var(--art-1)]",
                  "transition-[transform,box-shadow,opacity] duration-200 ease-[var(--ease)]",
                  "hover:scale-105 hover:shadow-[0_10px_36px_-8px_var(--art-1)] active:scale-95",
                  "disabled:opacity-30 disabled:hover:scale-100"
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-5" fill="currentColor" />
                ) : (
                  <Play className="size-5 translate-x-px" fill="currentColor" />
                )}
              </button>
            ) : (
              <button
                onClick={onVoteSkip}
                disabled={!current}
                className="flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 md:h-12 text-sm font-semibold text-ink/85 transition-[background-color,border-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-white/10 active:translate-y-0 disabled:opacity-30"
                aria-label="Vote to skip"
                title="Vote to skip this track"
              >
                <SkipForward className="size-4" />
                <span className="font-mono text-xs tabular-nums">
                  {skipVotes}/{needVotes}
                </span>
              </button>
            )}

            <button aria-label="Forward 10 seconds" title="Forward 10 seconds for everyone" disabled={!canSeek}
              className="rounded-full p-2 text-xs disabled:opacity-30 hover:bg-white/10" onClick={() => onSeek(Math.min(dur, position + 10))}>+10s</button>
            {isHost && (
              <button
                onClick={onSkip}
                disabled={!current}
                className="grid size-9 place-items-center rounded-full text-ink/70 transition-[background-color,color,transform] duration-200 ease-[var(--ease)] hover:bg-white/10 hover:text-ink active:scale-95 disabled:opacity-30"
                aria-label="Next track"
                title="Next track"
              >
                <SkipForward className="size-4" />
              </button>
            )}

            <IconToggle
              active={repeat !== "off"}
              disabled={!isHost}
              onClick={onRepeat}
              label={
                repeat === "one"
                  ? "Repeat: this track"
                  : repeat === "all"
                    ? "Repeat: queue"
                    : "Repeat: off"
              }
            >
              {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </IconToggle>
          </div>

          {/* The grey ranges belong to this device. Server preparation is shown separately. */}
          <div className="studio-transport-timeline flex w-full items-center gap-3">
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
              {fmt(position)}
            </span>
            <SeekSlider position={position} duration={dur} disabled={!canSeek} onSeek={onSeek} trackId={current?.videoId} bufferedRanges={bufferedRanges} />
            <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {fmt(dur)}
            </span>
          </div>
          {current && !preparing && <span className="kn-buffer-label" title="Media currently buffered ahead on this device; playback can also wait for decoding or room synchronization." aria-label={bufferLabel}>{bufferLabel}</span>}
        </div>

        {/* ── right: reactions, cast and volume ── */}
        <div className="kn-player-options flex items-center justify-end gap-2"><button type="button" className="persistent-player-lyrics" aria-label="Show lyrics" title="Lyrics" disabled={!current} onClick={onLyrics}><MicVocal size={18}/><span>Lyrics</span></button><button type="button" className="persistent-player-like" aria-label={liked?"Unlike this track":"Like this track"} title={liked?"Unlike this track":"Like this track"} aria-pressed={liked} disabled={!current} onClick={onLike}><Heart size={18} className={liked?"fill-current":""}/>{likes>0&&<span>{likes}</span>}</button>
          <ReactionBar onReact={onReact} className="kn-player-reactions hidden lg:flex" />
          <span className="hidden h-6 w-px bg-white/8 lg:block" aria-hidden />
          {castSupported && (
            <button
              onClick={onCast}
              className={cn(
                "hidden size-9 place-items-center rounded-full transition-colors duration-200 ease-[var(--ease)] hover:bg-white/10 sm:grid",
                castConnected ? "text-[var(--accent-2)]" : "text-ink/65 hover:text-ink"
              )}
              aria-label={castConnected ? "Casting" : "Cast to a speaker or TV"}
              aria-pressed={castConnected}
              title={castConnected ? "Casting" : "Cast to a speaker or TV"}
            >
              <Cast className="size-4" />
            </button>
          )}
          <Volume volume={volume} onVolume={onVolume} />
        </div>
      </div>

    </footer>
  );
}

/**
 * Reactions, always visible. They used to live behind a smiley: tap to open,
 * tap to react, popover closes — so cheering three times cost six taps and the
 * moment had passed. One tap is the whole interaction now.
 *
 * Exported because on a phone it is rendered outside the player, floating just
 * above the tab bar: both belong in the same band of screen the thumb can
 * actually reach without the hand moving.
 */
export function ReactionBar({
  onReact,
  className,
}: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {REACTIONS.map(({ emoji, label }: { emoji: string; label: string }) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-base transition-[transform,background-color] duration-200 ease-[var(--ease)] hover:scale-125 hover:bg-white/10 active:scale-90"
          aria-label={label}
          title={label}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/**
 * Shared room volume: playback position and volume are shared
 * so everyone hears the same moment at the room’s selected level.
 * Muting remembers the previous level so unmuting restores it.
 */
function Volume({volume,onVolume}:{volume:number;onVolume:(v:number)=>void}){
 const[open,setOpen]=useState(false),[last,setLast]=useState(volume||1);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const muted=volume===0,Icon=muted?VolumeX:volume<.5?Volume1:Volume2;
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};},[open]);
 return <div className="player-volume-control" ref={root}><button type="button" ref={trigger} aria-label="Volume" title={`Volume ${Math.round(volume*100)}%`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Icon size={18}/></button>{open&&<div className="player-volume-popup" role="dialog" aria-label="Volume control" onPointerDown={event=>event.stopPropagation()}><span className="player-volume-value">{Math.round(volume*100)}%</span><input type="range" min={0} max={1} step={.01} value={volume} aria-label="Shared room volume" aria-orientation="vertical" aria-valuetext={`${Math.round(volume*100)} percent`} onChange={event=>onVolume(Number(event.target.value))}/><button type="button" aria-label={muted?"Unmute":"Mute"} onClick={()=>{if(muted)onVolume(last||1);else{setLast(volume);onVolume(0);}}}><Icon size={17}/></button></div>}</div>;
}

// Toggleable icon button (shuffle / repeat) — accent-tinted when active.
function IconToggle({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative grid size-9 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-[var(--ease)] active:scale-95 disabled:opacity-25",
        active
          ? "text-[var(--accent-2)] hover:bg-white/10"
          : "text-ink/60 hover:bg-white/10 hover:text-ink"
      )}
    >
      {children}
      {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-[var(--accent-2)]" />}
    </button>
  );
}
