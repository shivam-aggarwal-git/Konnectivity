"use client";

import { useEffect, useMemo, useState } from "react";
import { Disc3, Heart, Loader2, MicVocal, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Participant, Track } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/panel";
import { CountButton } from "@/components/ui/track-row";
import { PresenceAvatar } from "@/components/PresenceCard";
import {useAppearance} from "@/hooks/useAppearance";
import TrackArtwork from "./TrackArtwork";
import Lyrics from "@/components/Lyrics";

/**
 * The artwork-forward hero, and the room's centre of gravity. Everything here
 * is tinted by the cover itself through --art-1/--art-2, so the column reads as
 * belonging to whatever is playing rather than to the app chrome.
 */

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Deterministic PRNG so a track's waveform is the same shape every render. */
function seeded(seed: string, count: number) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const r = ((h ^= h >>> 16) >>> 0) / 4294967296;
    // Bias towards the middle of the range and give the ends a taper, so it
    // reads as a waveform rather than as a bar chart of noise.
    const taper = Math.sin((i / (count - 1)) * Math.PI) * 0.35 + 0.65;
    bars.push((0.22 + r * 0.78) * taper);
  }
  return bars;
}

const BARS = 64;

/**
 * The waveform doubles as the scrubber. It is decorative — Konnectivity never has
 * the decoded audio on the client, so there is nothing real to draw — but it is
 * stable per track, which is what stops it reading as an animation loop.
 */
function Waveform({
  seed,
  progress,
  playing,
  canSeek,
  onSeek,
}: {
  seed: string;
  /** 0–1 */
  progress: number;
  playing: boolean;
  canSeek: boolean;
  onSeek: (ratio: number) => void;
}) {
  const bars = useMemo(() => seeded(seed, BARS), [seed]);
  const [draft, setDraft] = useState<number | null>(null);
  const played = Math.round((draft ?? progress) * BARS);

  return (
    <div
      className={cn("sw-wave sw-focus", playing && "sw-wave-playing", canSeek && "cursor-pointer")}
      style={{ position: "relative" }}
    >
      {canSeek && <input className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 touch-none" aria-label="Artwork timeline" type="range" min={0} max={1} step={0.001} value={draft ?? progress}
        onChange={e => setDraft(Number(e.target.value))}
        onPointerUp={e => { onSeek(Number(e.currentTarget.value)); setDraft(null); }}
        onPointerCancel={() => setDraft(null)}
        onKeyUp={e => { if (["ArrowLeft","ArrowRight","Home","End","ArrowUp","ArrowDown"].includes(e.key)) { onSeek(Number(e.currentTarget.value)); setDraft(null); } }} />}
      {bars.map((h, i) => (
        <span
          key={i}
          className={i < played ? "text-[var(--art-1)]" : "text-white/25"}
          style={{
            height: `${Math.round(h * 100)}%`,
            // A late bar shouldn't animate in lockstep with an early one.
            animationDelay: `${(i % 8) * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function NowPlaying({
  current,
  isPlaying,
  preparing,
  cachePct,
  buffering,
  participants,
  position,
  likes,
  liked,
  onLike,
  canSeek,
  onSeek,
  className,
}: {
  current: Track | null;
  isPlaying: boolean;
  preparing: boolean;
  cachePct: number;
  buffering: boolean;
  participants: Participant[];
  position: number;
  /** Nicknames who've liked the current track. */
  likes: string[];
  liked: boolean;
  onLike: () => void;
  canSeek: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const appearance=useAppearance();
  const loading = preparing || buffering;
  const dur = current?.duration ?? 0;
  // A per-listener preference, remembered across rooms.
  const [showLyrics, setShowLyrics] = useState(false);
  useEffect(() => {
    const home = () => { setShowLyrics(false); try { localStorage.setItem("sw_lyrics", "0"); } catch {} };
    window.addEventListener("konnectivity:home", home);
    return () => window.removeEventListener("konnectivity:home", home);
  }, []);
  useEffect(() => {
    try {
      setShowLyrics(localStorage.getItem("sw_lyrics") === "1");
    } catch {}
  }, []);
  const toggleLyrics = () =>
    setShowLyrics((v) => {
      try {
        localStorage.setItem("sw_lyrics", v ? "0" : "1");
      } catch {}
      return !v;
    });
  const lyricsOpen = showLyrics && Boolean(current);
  const progress = dur > 0 ? Math.min(1, position / dur) : 0;

  return (
    // min-h-0 is load-bearing: a flex child defaults to min-height:auto, so
    // `flex-1` alone won't let this shrink below its content and it renders
    // straight through the player instead. With it, the panel is bounded and
    // scrolls internally on a short screen rather than escaping.
    // `safe center` rather than plain centring: once the content is taller than
    // the panel, ordinary centring overflows in both directions and hides the
    // top with no way to scroll back to it. `safe` falls back to top-aligned
    // exactly then, so a crowded room degrades instead of losing the artwork.
    <section
      className={cn(
        "kn-now-card sw-panel sw-scroll flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 [justify-content:safe_center]",
        className
      )}
    >
      {/* No listener count here. The top bar carries the avatar stack at every
          width, and this panel lists everyone in full further down — a third
          copy of the same fact was what made the old panel feel crowded. */}
      <SectionHeader icon={<Radio className="size-3.5" />} title="Your shared soundtrack" />

      {/* Lyrics take the artwork's place rather than adding a panel: the room
          is tinted by the cover anyway, so the art is never really gone. */}
      {lyricsOpen && current && (
        <Lyrics
          track={current}
          position={position}
          playing={isPlaying && !loading}
          className="mx-auto h-[min(360px,42vh)] w-full max-w-md shrink-0"
        />
      )}

      {/* Artwork. The glow lives on the wrapper because .sw-art clips overflow. */}
      <div
        className={cn(
          // Capped by viewport height as well as width, so on a short phone the
          // cover gives way rather than shoving everything below it off-screen.
          "sw-art-glow mx-auto aspect-square w-full max-w-[min(300px,30vh)] shrink-0",
          "[@media(max-height:720px)]:max-w-[170px]",
          isPlaying && !loading && "sw-art-playing",
          (lyricsOpen || !appearance.showArtwork) && "hidden"
        )}
      >
        <div className="sw-art size-full">
          <TrackArtwork track={current} playing={isPlaying && !loading}/>

          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-7 animate-spin text-white" />
                <span className="font-mono text-xs text-white/80">
                  {preparing ? (cachePct >= 100 ? "Processing" : `${cachePct}%`) : "Buffering"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title block */}
      <div className="mt-6 min-w-0 text-center">
        {current ? (
          <>
            <h2
              className="truncate font-display text-xl font-bold leading-snug text-ink"
              title={current.title}
            >
              {current.title}
            </h2>
            <p className="mt-1 truncate text-sm text-ink-soft" title={current.artist}>
              {current.artist}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {current.addedBy && (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                  <Avatar name={current.addedBy} size="xs" />
                  <span className="truncate">added by {current.addedBy}</span>
                </span>
              )}
              <button
                type="button"
                onClick={toggleLyrics}
                aria-pressed={showLyrics}
                aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"}
                title={showLyrics ? "Hide lyrics" : "Show lyrics"}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold",
                  "transition-[background-color,border-color,color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px active:scale-95",
                  showLyrics
                    ? "border-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_22%,transparent)] text-white"
                    : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-ink"
                )}
              >
                <MicVocal className="size-3.5" /> Lyrics
              </button>
              <CountButton
                icon={<Heart className={cn("size-3.5", liked && "fill-current")} />}
                count={likes.length}
                active={liked}
                tone="pink"
                label={
                  likes.length
                    ? `${liked ? "Unlike" : "Like"} — liked by ${likes.join(", ")}`
                    : "Like this track"
                }
                onClick={onLike}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold text-ink">A moment, just for you.</h2>
            <p className="mt-1 text-sm text-muted">Find a song you love. Share it with someone you love.</p>
          </>
        )}
      </div>

      {current && <div className={`kn-visualizer ${isPlaying && !loading ? 'is-playing' : ''}`} aria-hidden="true">{Array.from({length:28},(_,i)=><span key={i} style={{'--bar-height':`${8+Math.round(Math.sin(i*.65)**2*18)}px`,'--bar-delay':`${-(i%9)*.17}s`} as React.CSSProperties}/>)}</div>}

      {current && <div className="kn-track-time"><span>{fmt(position)}</span><span>ONE SONG. TWO WORLDS CLOSER.</span><span>{fmt(dur)}</span></div>}

      {/* Who's here. The point of the app is that these people hear the same
          thing at the same moment, so it's worth showing rather than counting.
          Desktop only: on a phone the header already lists everyone, and
          repeating it here costs the room's scarcest resource, vertical space.
          Deliberately not mt-auto — pinning to the bottom works on a tall
          screen, but once the panel scrolls it pins to the bottom of the
          *scrollable* content and the listeners leave the viewport. */}
      <div className="hidden pt-8 xl:block">
        <div className="sw-label mb-3">Listening together</div>
        {/* Each one opens its own profile — who they are, when they arrived,
            what they've put on. */}
        <ul className="sw-scroll flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto">
          {participants.map((p) => (
            <li key={p.id} className="min-w-0 max-w-full">
              <PresenceAvatar p={p} size="sm" withName className="border border-white/8 bg-white/[0.04]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
