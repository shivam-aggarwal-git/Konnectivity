"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ImagePlus, Images, Lock, Video, MapPin, X, Loader2, MessageSquare, Send, Smile, Maximize2, Minimize2 } from "lucide-react";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { cn } from "@/lib/cn";
import type { ChatMsg, Participant, PresenceStatus, RoomPhoto } from "@/lib/types";
import { Avatar, nickColor } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import RoomPhotos, { ROOM_IMAGE_TYPES } from "./RoomPhotos";
import MediaRecipients from "./MediaRecipients";
import { SectionHeader } from "@/components/ui/panel";

/**
 * The conversation, and only the conversation. Anything that merely *happened*
 * belongs to the activity feed — including track changes, which the hero panel
 * and the player are both already announcing at all times.
 *
 * Consecutive messages from the same person within a few minutes are grouped —
 * the avatar and name appear once, not on every line.
 */

const QUICK_EMOJI = ["😂", "🔥", "❤️", "🎉", "😮", "🙌", "😅", "🎧"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChatPanel({
  chat, photos, members, canUploadPhotos, canUploadVideos, canSharePrivately,
  you,
  aiDj,
  djTyping,
  onUploadImage, onUploadVideo, mediaQuery, onExpandedChange, receipts, onRead,
  onSend, mobileOpen, onMobileClose,
  onTyping,
  statuses,
  muted,
  className,
}: {
  chat: ChatMsg[];
  photos: RoomPhoto[];
  members: Participant[];
  canUploadPhotos: boolean;
  canUploadVideos: boolean;
  canSharePrivately: boolean;
  mobileOpen?:boolean; onMobileClose?:()=>void;
  onExpandedChange?: (expanded:boolean)=>void;
  /** nick → presence, so a name in the thread says whether they're still here. */
  statuses?: Record<string, PresenceStatus>;
  /** Your own nickname, so your messages can sit on the other side. */
  you: string;
  aiDj: string | null;
  /** The DJ is composing. It has no seat, so the server reports this for it. */
  djTyping?: boolean;
  onUploadImage: (file: File, recipients?: string[]) => Promise<NonNullable<ChatMsg["image"]>>;
  onUploadVideo: (file: File, recipients?: string[], voice?: boolean) => Promise<NonNullable<ChatMsg["video"]>>;
  receipts: Record<string,string[]>;
  onRead: (ids:string[])=>void;
  mediaQuery: string;
  onSend: (text: string, imageId?: string,videoId?:string,location?:ChatMsg["location"]) => Promise<void>;
  /** Fires as you write, so the room can show you're mid-sentence. */
  onTyping?: () => void;
  /** The host has muted your chat — the room still shows, you just can't post. */
  muted?: boolean;
  className?: string;
}) {
  const [video,setVideo]=useState<ChatMsg["video"]>();
  const [location,setLocation]=useState<ChatMsg["location"]>();
  const [locationOpen,setLocationOpen]=useState(false),[lat,setLat]=useState(""),[lng,setLng]=useState(""),[locationLabel,setLocationLabel]=useState("");
  const videoInput=useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ChatMsg["image"]>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const [recipients, setRecipients] = useState<string[]>();
  const [sending, setSending] = useState(false);
  const [album, setAlbum] = useState<string | null>(null);
  const albumTrigger = useRef<HTMLElement | null>(null);
  const [albumError, setAlbumError] = useState("");
  const attachmentBlocked = uploading || sending || (recipients !== undefined && (!canSharePrivately || !recipients.length));
  function openPhotos(id: string, trigger: HTMLElement) {
    albumTrigger.current = trigger;
    setAlbumError("");
    setAlbum(id);
  }

  const [text, setText] = useState("");
  const emojiPanel=useRef<HTMLDivElement>(null),emojiButton=useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hidden,setHidden]=useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(()=>{onExpandedChange?.(expanded);},[expanded,onExpandedChange]);
  useEffect(()=>{const open=()=>setExpanded(true);window.addEventListener('konnectivity:open-chat',open);return()=>window.removeEventListener('konnectivity:open-chat',open);},[]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const list = scrollRef.current;
    if (list && followRef.current) list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  }, [chat, expanded]);

  useEffect(()=>{if(!pickerOpen)return;const outside=(e:PointerEvent)=>{if(!emojiPanel.current?.contains(e.target as Node)&&!emojiButton.current?.contains(e.target as Node))setPickerOpen(false);};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[pickerOpen]);
  const send = async () => {
    const clean = text.trim();
    if ((!clean && !image && !video && !location) || uploading || sending) return;
    followRef.current = true;
    setSending(true);
    setUploadError("");
    try {
      await onSend(clean, image?.id, video?.id, location);
      setVideo(undefined);
      setLocation(undefined);
      setImage(undefined);
      setText("");
      setPickerOpen(false);
      setRecipients(undefined);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  const attachImage = async (file?: File) => {
    if (!file || attachmentBlocked || !canUploadPhotos || (recipients && (video || location))) return;
    setUploading(true);
    setUploadError("");
    try { setImage(await onUploadImage(file, recipients)); }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Image upload failed"); }
    finally { setUploading(false); }
  };

  const attachVideo = async (file?: File, voice = false) => {
    if (!file || attachmentBlocked || !canUploadVideos) return;
    setUploading(true);
    setUploadError("");
    try { setVideo(await onUploadVideo(file, recipients, voice)); }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Video upload failed"); }
    finally { setUploading(false); }
  };

  async function shareAlbumPhoto(file: File, audience?: string[]) {
    if (uploading || muted || !canUploadPhotos) return;
    setUploading(true);
    setAlbumError("");
    try {
      const photo = await onUploadImage(file, audience);
      await onSend("", photo.id);
    } catch (error) {
      setAlbumError(error instanceof Error ? error.message : "Could not share this image.");
    } finally {
      setUploading(false);
    }
  }
  const pin=()=>{const a=Number(lat),b=Number(lng);if(!lat.trim()||!lng.trim()||!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180){setUploadError('Enter a valid latitude (−90 to 90) and longitude (−180 to 180).');return;}setLocation({lat:a,lng:b,label:locationLabel.trim()||'Meeting point'});setLocationOpen(false);setUploadError('');};
  const locate=()=>{if(!navigator.geolocation){setUploadError('Location is unavailable. Enter a meeting point manually.');return;}navigator.geolocation.getCurrentPosition(p=>{setLat(String(Number(p.coords.latitude.toFixed(5))));setLng(String(Number(p.coords.longitude.toFixed(5))));setUploadError('');},()=>setUploadError('Location permission was denied or unavailable. Enter coordinates instead.'),{enableHighAccuracy:false,timeout:10000,maximumAge:60000});};
  // Everything the room did — joins, queues, skips, track changes — belongs to
  // the activity feed. What's left is people talking.
  const thread = chat.filter((m) => !m.system);
  const hasConversation = thread.length > 0;

  // Who is mid-sentence. Yourself excluded: you know.
  const typists = Object.entries(statuses ?? {})
    .filter(([nick, status]) => status === "typing" && nick !== you)
    .map(([nick]) => nick);

  useEffect(() => {
    const list = scrollRef.current;
    if (!list || (hidden && !expanded)) return;
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== "visible") return;
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog && !dialog.contains(list)) return;
      const ids = entries.filter(entry => entry.isIntersecting)
        .map(entry => (entry.target as HTMLElement).dataset.readMessage).filter((id): id is string => Boolean(id));
      for (let i=0; i<ids.length; i+=30) onRead(ids.slice(i,i+30));
    }, {threshold: 0.5});
    const refresh = () => {
      observer.disconnect();
      list.querySelectorAll("[data-read-message]").forEach(node => observer.observe(node));
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", refresh); };
  }, [chat, hidden, expanded, mobileOpen, onRead]);
  useEffect(()=>{if(mobileOpen)setHidden(false);},[mobileOpen]);
  if(hidden&&!expanded)return <button className="kn-background-upload" onClick={()=>setHidden(false)}><MessageSquare size={15}/>Open chat</button>;
  const content = (
    <div data-room-chat data-mobile-open={mobileOpen} className={cn("flex min-h-0 flex-col overflow-hidden", expanded ? "h-full w-full" : className)}>
      <SectionHeader
        icon={<MessageSquare className="size-3.5" />}
        title="Chat"
        trailing={<><button type="button" className="flex items-center gap-1 rounded-full border border-current/15 px-2 py-1 text-xs" onClick={event => openPhotos("", event.currentTarget)}><Images size={15} /> Photos</button><button className="kn-chat-close" aria-label="Close chat" title="Close chat" onClick={()=>expanded?setExpanded(false):mobileOpen&&matchMedia("(max-width:767px)").matches?onMobileClose?.():setHidden(true)}><X size={16}/></button>{aiDj && <span className="text-[11px] text-muted">🎧 {aiDj} is in here</span>}<button type="button" onClick={() => { followRef.current = true; setExpanded(v => !v); }} aria-label={expanded ? "Collapse chat" : "Expand chat"} title={expanded ? "Collapse chat" : "Expand chat"} className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-ink hover:bg-white/10">{expanded ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}<span>{expanded ? "Collapse" : "Expand"}</span></button></>}
      />

      <div ref={node => { scrollRef.current = node; if (node && followRef.current) node.scrollTop = node.scrollHeight; }} role="log" aria-label="Chat messages" aria-live="polite" tabIndex={0} onScroll={() => { const list = scrollRef.current; if (list) followRef.current = list.scrollHeight - list.clientHeight - list.scrollTop < 64; }} className="sw-scroll -mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-2">
        {!hasConversation && (
          <EmptyState
            compact={!expanded}
            icon={<MessageSquare className="size-5" />}
            title="Say something"
            hint={
              aiDj
                ? `Everyone here hears the same second of the song. ${aiDj} is listening too — start a line with /dj to ask for something.`
                : "Everyone here hears the same second of the song — worth a comment."
            }
          />
        )}

        {thread.map((m, i) => {
          const prev = thread[i - 1];
          const grouped =
            prev != null &&
            prev.nick === m.nick &&
            prev.dj === m.dj &&
            m.ts - prev.ts < GROUP_WINDOW_MS;

          return (
            <Bubble
              key={m.id}
              msg={m}
              mediaQuery={mediaQuery}
              onOpenPhoto={openPhotos}
              onMediaLoad={() => { const list = scrollRef.current; if (list && followRef.current) list.scrollTop = list.scrollHeight; }}
              own={!m.dj && m.nick === you}
              grouped={grouped}
              readers={receipts[m.id]}
              status={m.nick ? statuses?.[m.nick] : undefined}
            />
          );
        })}

        {djTyping && aiDj && <TypingRow names={[aiDj]} dj />}
        {typists.length > 0 && <TypingRow names={typists} />}


      </div>

      {/* Composer */}
      <div className="mt-4 shrink-0">
        {!muted && canSharePrivately && (canUploadPhotos || canUploadVideos) &&
          <details className="mb-2"><summary className="cursor-pointer text-xs text-muted">Media recipients{recipients && " · Private"}</summary>
            <MediaRecipients members={members} value={recipients} onChange={setRecipients}
              disabled={uploading || sending || Boolean(image || video)} />
          </details>}
        {video&&<div className="kn-attachment-preview"><Video size={16}/><span>{video.name}</span><button onClick={()=>setVideo(undefined)} aria-label="Remove attachment"><X size={15}/></button></div>}
        {location&&<div className="kn-attachment-preview"><MapPin size={16}/><span>{location.label} · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span><button onClick={()=>setLocation(undefined)} aria-label="Remove location"><X size={15}/></button></div>}
        {locationOpen&&!muted&&<div className="kn-location-composer"><b>Share a one-time location</b><p>Only send a place you want everyone in this room to see. There is no live tracking.</p><input aria-label="Location label" placeholder="Meeting point / landmark" maxLength={120} value={locationLabel} onChange={e=>setLocationLabel(e.target.value)}/><div><input aria-label="Latitude" type="number" min="-90" max="90" step="any" placeholder="Latitude" value={lat} onChange={e=>setLat(e.target.value)}/><input aria-label="Longitude" type="number" min="-180" max="180" step="any" placeholder="Longitude" value={lng} onChange={e=>setLng(e.target.value)}/></div><div><button onClick={locate}>Use my location</button><button onClick={pin}>Attach pin</button><button onClick={()=>setLocationOpen(false)}>Cancel</button></div></div>}
        <input ref={videoInput} type="file" accept="video/mp4,video/webm" className="sr-only" aria-label="Choose chat video" onChange={e=>{void attachVideo(e.target.files?.[0]);e.target.value='';}}/>
        {image && <div className="sw-chat-photo-preview"><img src={image.url + mediaQuery} alt="Photo ready to send"/><span>Add a caption below, or send your photo ♡</span><button onClick={() => setImage(undefined)} aria-label="Remove attached photo"><X size={16}/></button></div>}
        {uploadError && <p role="alert" className="mb-2 text-xs text-pink-200">{uploadError}</p>}
        <input ref={photoInput} type="file" accept={ROOM_IMAGE_TYPES} className="sr-only" aria-label="Choose chat image" onChange={e => { void attachImage(e.target.files?.[0]); e.target.value=""; }} />
        {/* The DJ takes requests, and a command nobody can see is a command
            nobody uses. Only shown when there is actually a DJ listening —
            advertising `/dj` on an instance with the DJ switched off just
            teaches people that it does nothing. Tapping it writes the prefix
            so the syntax never has to be remembered, only recognised. */}
        {aiDj && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-muted">
            <button
              type="button"
              onClick={() => {
                setText((t) => (t.startsWith("/dj ") ? t : `/dj ${t}`));
                inputRef.current?.focus();
              }}
              className="rounded-full border border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-2)] transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--accent)_26%,transparent)]"
            >
              /dj
            </button>
            <span>
              ask {aiDj} for a track — <span className="text-ink-soft">/dj add 5 romantic songs</span>
            </span>
          </div>
        )}

        {pickerOpen && (
          <div ref={emojiPanel} className="sw-fade-in mb-2 flex flex-wrap gap-1 rounded-md border border-white/8 bg-white/[0.03] p-2">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setText((t) => t + e);
                  inputRef.current?.focus();
                }}
                className="grid size-8 place-items-center rounded-full text-base transition-transform duration-200 ease-[var(--ease)] hover:scale-125 hover:bg-white/10 active:scale-90"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {muted ? (
          <div className="flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-4 py-2.5 text-center text-[13px] text-muted">
            The host has muted your chat.
          </div>
        ) : (
          <div className="kn-chat-composer flex items-center gap-2 rounded-full border border-input bg-field pl-4 pr-1.5 py-1.5 transition-[border-color,box-shadow] duration-200 ease-[var(--ease)] focus-within:border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]">
            <input
              ref={inputRef}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
              placeholder={aiDj ? "Say something · /dj <request>" : "Say something…"}
              value={text}
              maxLength={500}
              onChange={(e) => {
                setText(e.target.value);
                // The hook deduplicates and decays this, so a whole sentence
                // costs one packet rather than one per keystroke.
                if (e.target.value) onTyping?.();
              }}
              onKeyDown={(e) => e.key === "Enter" && send()}
              onPaste={e => { const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith("image/")); if (file) { e.preventDefault(); void attachImage(file); } }}
              aria-label="Chat message"
            />
            <button type="button" disabled={attachmentBlocked || !canUploadPhotos || Boolean(recipients && (video || location))} onClick={() => photoInput.current?.click()} aria-label="Attach image" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink disabled:opacity-40">{uploading ? <Loader2 className="size-4 animate-spin"/> : <ImagePlus className="size-4"/>}</button>
            <button type="button" disabled={attachmentBlocked || !canUploadVideos || Boolean(recipients && (image || location))} onClick={()=>videoInput.current?.click()} aria-label="Attach video (up to 50 MB)" title="Video · up to 50 MB" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink disabled:opacity-40"><Video className="size-4"/></button>
            <VoiceNoteRecorder disabled={attachmentBlocked || !canUploadVideos || Boolean(recipients && (image || location))} onRecorded={file=>void attachVideo(file,true)} onError={setUploadError}/>
            <button type="button" disabled={Boolean(recipients && (image || video))} onClick={()=>setLocationOpen(v=>!v)} aria-label="Share location" title="Share a location pin" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-ink"><MapPin className="size-4"/></button>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              ref={emojiButton}
              aria-label="Emoji"
              aria-expanded={pickerOpen}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-200 ease-[var(--ease)] hover:bg-white/8 hover:text-ink"
            >
              <Smile className="size-4" />
            </button>
            <button
              type="button"
              onClick={send}
              disabled={(!text.trim() && !image && !video && !location) || uploading || sending}
              aria-label="Send"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-[image:var(--accent-gradient)] text-white transition-[transform,box-shadow,opacity] duration-200 ease-[var(--ease)] hover:scale-105 hover:shadow-[var(--glow-accent)] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return <>{expanded ? <Dialog open onOpenChange={setExpanded}><DialogContent className="!flex !h-[85dvh] !max-h-[min(900px,calc(var(--kn-app-height,100dvh)-24px))] !w-[calc(100vw-24px)] !max-w-3xl !flex-col !gap-0 !overflow-hidden [&>button]:hidden"><DialogTitle className="sr-only">Room chat</DialogTitle>{content}</DialogContent></Dialog> : content}
    {album !== null && <RoomPhotos photos={photos} selectedId={album} onSelect={setAlbum} onClose={() => setAlbum(null)}
      returnFocus={albumTrigger.current} mediaQuery={mediaQuery} members={members} canSharePrivately={canSharePrivately}
      onUpload={!muted && canUploadPhotos ? shareAlbumPhoto : undefined} uploading={uploading} error={albumError} />}
  </>;
}

/**
 * "Rahin is typing…", as a bubble rather than a status line.
 *
 * It sits in the thread where the message will land, so the eye is already in
 * the right place when it arrives, and it takes the same avatar and bubble
 * shapes as everything else — a typing indicator that looks nothing like a
 * message is a worse promise about what's coming.
 */
function TypingRow({ names, dj = false }: { names: string[]; dj?: boolean }) {
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="sw-fade-in mt-3 flex items-end gap-2" aria-live="polite" aria-atomic="true">
      {dj ? (
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--accent-gradient)] text-[11px]"
          aria-hidden
        >
          🎧
        </span>
      ) : (
        <Avatar name={names[0]} size="sm" status="typing" />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="mb-1 px-1 text-[11px] font-semibold" style={{ color: dj ? "var(--accent-2)" : nickColor(names[0]) }}>
          {label}
        </span>
        {/* The dots are decoration; the label above already carries the whole
            meaning, and a screen reader that gets both announces it twice. */}
        <div className={cn("sw-bubble w-fit py-2.5", dj && "sw-bubble-dj")} aria-hidden>
          <span className="sw-typing text-ink-soft">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

function Bubble({ mediaQuery, onMediaLoad, onOpenPhoto,
  msg,
  own,
  grouped,
  readers,
  status,
}: {
  mediaQuery: string;
  onMediaLoad: () => void;
  onOpenPhoto: (id: string, trigger: HTMLElement) => void;
  msg: ChatMsg;
  own: boolean;
  grouped: boolean;
  readers?: string[];
  status?: PresenceStatus;
}) {
  const name = msg.nick ?? "guest";
  return (
    <div data-read-message={!own&&!msg.dj?msg.id:undefined}
      className={cn(
        "sw-pop-in flex items-end gap-2",
        own && "flex-row-reverse",
        grouped ? "mt-0.5" : "mt-3 first:mt-0"
      )}
    >
      {grouped ? (
        <span className="size-6 shrink-0" aria-hidden />
      ) : msg.dj ? (
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--accent-gradient)] text-[11px]"
          title={name}
        >
          🎧
        </span>
      ) : (
        <Avatar name={name} size="sm" status={status} />
      )}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col", own && "items-end")}>
        {!grouped && (
          <div className={cn("mb-1 flex items-baseline gap-2 px-1", own && "flex-row-reverse")}>
            <span
              className="text-[11px] font-semibold"
              style={{ color: msg.dj ? "var(--accent-2)" : own ? "var(--ink)" : nickColor(name) }}
            >
              {own ? "You" : name}
            </span>
            <time className="text-[10px] text-muted" dateTime={new Date(msg.ts).toISOString()}>
              {clock(msg.ts)}
            </time>
          </div>
        )}
        <div className={cn("sw-bubble", own && "sw-bubble-own", msg.dj && "sw-bubble-dj")}>
          {msg.privateMedia && <p className="mb-1 flex items-center gap-1 text-xs text-muted"><Lock size={12} /> Private media</p>}
          {msg.image && <button type="button" onClick={event => onOpenPhoto(msg.id, event.currentTarget)} className="sw-focus mb-1 block rounded-md"><img src={msg.image.url + mediaQuery} alt={msg.image.name || "Shared photo"} className="sw-chat-image" loading="lazy" onLoad={onMediaLoad} /></button>}
          {msg.video?.voice?<audio className="block max-w-full" aria-label="Voice note" src={msg.video.url+mediaQuery} controls preload="metadata"/>:msg.video&&<div className="kn-chat-video"><video src={msg.video.url+mediaQuery} controls playsInline preload="metadata" onLoadedMetadata={onMediaLoad}/><span>{msg.video.name} · playback is local to you</span></div>}
          {msg.location&&<a className="kn-location-card" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(msg.location.lat+','+msg.location.lng)}`} target="_blank" rel="noreferrer"><MapPin size={23}/><span><b>{msg.location.label}</b><small>{msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)} · Open map ↗</small></span></a>}
          {msg.text}
        </div>
        {own&&Boolean(readers?.length)&&<span className="mt-1 text-right text-[11px] text-muted" title={readers?.join(", ")}>
          {readers?.length===1?`Read by ${readers[0]}`:`Read by ${readers?.length}`}
        </span>}
      </div>
    </div>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(ChatPanel);
