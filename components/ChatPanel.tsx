"use client";

import { memo, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Download, Film, ImagePlus, Images, Lock, Plus, Reply, Pencil, Search, Video, MapPin, X, MessageSquare, Send, Smile, Maximize2, Minimize2, Zap, Phone, Users } from "lucide-react";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import VoiceMessage from "./VoiceMessage";
import {normalizeEmojiText} from "@/lib/emoji-text";
import dynamic from "next/dynamic";
import { gifPreviewUrl } from "@/lib/gif-image";
import AnimatedChatText from "./AnimatedChatText";
import { cn } from "@/lib/cn";
import type { ChatMsg, Participant, PresenceStatus, RoomPhoto, RoomGif } from "@/lib/types";
import { Avatar, nickColor } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import RoomPhotos, { ROOM_IMAGE_TYPES } from "./RoomPhotos";
import MediaRecipients from "./MediaRecipients";
import { SectionHeader } from "@/components/ui/panel";

const GifPicker = dynamic(() => import("./GifPicker"), { ssr: false });

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
  you, youId, ownProfile, onBuzz, onCall,
  aiDj,
  djTyping,
  onUploadImage, onUploadVideo, mediaQuery, onExpandedChange, receipts, onRead,
  onSend, onEdit, onReact, onRecordingChange, onLiveLocation, canShareLocation, mobileOpen, onMobileClose,
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
  youId: string | null;
  ownProfile?: Participant["profile"];
  onBuzz?:()=>void; onCall?:()=>void;
  aiDj: string | null;
  /** The DJ is composing. It has no seat, so the server reports this for it. */
  djTyping?: boolean;
  onUploadImage: (file: File, recipients?: string[]) => Promise<NonNullable<ChatMsg["image"]>>;
  onUploadVideo: (file: File, recipients?: string[], voice?: boolean) => Promise<NonNullable<ChatMsg["video"]>>;
  receipts: Record<string,string[]>;
  onRead: (ids:string[])=>void;
  mediaQuery: string;
  onSend: (text: string, imageId?: string,videoId?:string,location?:ChatMsg["location"], replyTo?:string, gif?:RoomGif) => Promise<{id?:string;liveUntil?:number}>;
  onLiveLocation:(id:string,position?:{lat:number;lng:number})=>Promise<void>;
  canShareLocation:boolean;
  onEdit:(id:string,text:string)=>Promise<void>;
  onReact:(id:string,emoji:string)=>Promise<void>;
  onRecordingChange:(recording:boolean)=>void;
  /** Fires as you write, so the room can show you're mid-sentence. */
  onTyping?: () => void;
  /** The host has muted your chat — the room still shows, you just can't post. */
  muted?: boolean;
  className?: string;
}) {
  const [video,setVideo]=useState<ChatMsg["video"]>();
  const [location,setLocation]=useState<ChatMsg["location"]>();
  const [locationOpen,setLocationOpen]=useState(false),[locating,setLocating]=useState(false);
  const [liveLocation,setLiveLocation]=useState<{id:string;until:number}|null>(null);
  const locationRequest=useRef(0);
  const [optionsOpen,setOptionsOpen]=useState(false);
  const optionsPanel=useRef<HTMLDivElement>(null),optionsButton=useRef<HTMLButtonElement>(null);

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
  const [gifPicker,setGifPicker]=useState(false),[gif,setGif]=useState<RoomGif>();
  const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState("");
  const [reply,setReply]=useState<ChatMsg>(),[editing,setEditing]=useState<ChatMsg>();
  const [recording,setRecording]=useState(false);
  useEffect(()=>{
    if(!optionsOpen&&!recording)return;
    const measure=()=>{
      const button=optionsButton.current,panel=optionsPanel.current;if(!button||!panel)return;
      const header=button.closest('.studio-room')?.querySelector('.studio-header')?.getBoundingClientRect();
      panel.style.maxHeight=`${Math.max(96,button.getBoundingClientRect().top-Math.max(window.visualViewport?.offsetTop||0,header?.bottom||0,button.closest('.studio-room')?.querySelector('.room-media-toolbar')?.getBoundingClientRect().bottom||0)-16)}px`;
    };
    measure();window.visualViewport?.addEventListener('resize',measure);window.addEventListener('resize',measure);
    return()=>{window.visualViewport?.removeEventListener('resize',measure);window.removeEventListener('resize',measure);};
  },[optionsOpen,recording]);
  const recordingChanged = (value:boolean) => { setRecording(value); onRecordingChange(value); };
  const beginReply = (message:ChatMsg) => {
    if(muted || message.privateMedia)return;
    setEditing(undefined);setReply(message);inputRef.current?.focus();
  };
  const emojiPanel=useRef<HTMLDivElement>(null),emojiButton=useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hidden,setHidden]=useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(()=>{onExpandedChange?.(expanded);},[expanded,onExpandedChange]);
  useEffect(()=>{const open=()=>setExpanded(true);window.addEventListener('konnectivity:open-chat',open);return()=>window.removeEventListener('konnectivity:open-chat',open);},[]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const clearDraft = () => {
    setText(""); setImage(undefined); setVideo(undefined); setGif(undefined); setLocation(undefined);
    setReply(undefined); setEditing(undefined); setRecipients(undefined); setUploadError("");
  };
  const exportConversation = () => {
    const lines = chat.filter(message => !message.system).map(message => {
      const stamp = new Date(message.ts).toLocaleString();
      const media = [message.image?.name, message.video?.name, message.gif?.title].filter(Boolean).join(" · ");
      return `[${stamp}] ${message.nick}: ${message.text || media || "Shared media"}`;
    });
    const blob = new Blob([lines.join("\n") || "No messages in this room yet."], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `konnectivity-chat-${new Date().toISOString().slice(0,10)}.txt`; link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const list = scrollRef.current;
    if (list && followRef.current) list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
  }, [chat, expanded]);

  useEffect(()=>{if(!pickerOpen)return;const outside=(e:PointerEvent)=>{if(!emojiPanel.current?.contains(e.target as Node)&&!emojiButton.current?.contains(e.target as Node))setPickerOpen(false);};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[pickerOpen]);
  useEffect(()=>{
    if(!optionsOpen||recording)return;
    const outside=(event:PointerEvent)=>{
      if(!optionsPanel.current?.contains(event.target as Node)&&!optionsButton.current?.contains(event.target as Node))setOptionsOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOptionsOpen(false);};
    document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",escape);};
  },[optionsOpen,recording]);
  useEffect(()=>{
    if(!liveLocation)return;
    const {id,until}=liveLocation;
    const stop=()=>{setLiveLocation(null);void onLiveLocation(id).catch(()=>{});};
    if(muted||!canShareLocation){stop();return;}
    const watch=navigator.geolocation.watchPosition(
      point=>{void onLiveLocation(id,{lat:point.coords.latitude,lng:point.coords.longitude}).catch(error=>{
        if(/unavailable|has ended/.test(error.message)){setLiveLocation(null);setUploadError("Live location sharing ended.");}
      });},
      error=>{if(error.code===1){setUploadError("Location permission was withdrawn.");stop();}},
      {enableHighAccuracy:true,timeout:15000,maximumAge:3000},
    );
    const timer=setTimeout(stop,Math.max(0,until-Date.now()));
    return()=>{navigator.geolocation.clearWatch(watch);clearTimeout(timer);};
  },[liveLocation,onLiveLocation,muted,canShareLocation]);
  const send = async () => {
    const clean = text.trim();
    if ((!clean && !image && !video && !location && !gif) || uploading || sending || recording) return;
    followRef.current = true;
    setSending(true);
    setUploadError("");
    try {
      if (editing) await onEdit(editing.id,clean);
      else {
        const sent=await onSend(normalizeEmojiText(clean), image?.id, video?.id, location, reply?.id, gif);
        if(sent.id&&sent.liveUntil)setLiveLocation({id:sent.id,until:sent.liveUntil});
      }
      setEditing(undefined);setReply(undefined);setGif(undefined);
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
  const changeLocationOpen=(open:boolean)=>{
    if(!open){locationRequest.current++;setLocating(false);}
    setLocationOpen(open);
  };
  const locate=(live:boolean)=>{
    if(!navigator.geolocation){setUploadError("Location is unavailable on this device.");changeLocationOpen(false);return;}
    const request=++locationRequest.current;
    setLocating(true);setUploadError("");
    navigator.geolocation.getCurrentPosition(point=>{
      if(request!==locationRequest.current)return;
      setLocation({lat:point.coords.latitude,lng:point.coords.longitude,label:live?"Live location":"Current location",live});
      changeLocationOpen(false);
    },error=>{
      if(request!==locationRequest.current)return;
      setUploadError(error.code===1?"Location permission was denied. Allow location access in your browser settings.":"Could not get your location. Try again.");
      changeLocationOpen(false);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };
  // Everything the room did — joins, queues, skips, track changes — belongs to
  // the activity feed. What's left is people talking.
  const query=search.trim().toLowerCase();
  const thread = chat.filter(m=>!m.system&&(!query||[m.text,m.nick,m.image?.name,m.video?.name,m.gif?.title].some(value=>value?.toLowerCase().includes(query))));
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
    <div data-room-chat data-mobile-open={mobileOpen&&!expanded} className={cn("flex min-h-0 flex-col overflow-hidden", expanded ? "w-full flex-1"  : className)}>
      <div className="studio-chat-heading shrink-0"><SectionHeader
        icon={<MessageSquare className="size-3.5" />}
        title="Chat"
        trailing={<div className="chat-heading-actions">
        {!muted && canSharePrivately && (canUploadPhotos || canUploadVideos) &&
          <details className="chat-more-menu kn-media-recipients"><summary aria-label="Media recipients" title="Media recipients"><Users size={17}/></summary>
            <div className="kn-recipient-menu"><MediaRecipients members={members} value={recipients} onChange={setRecipients}
              disabled={uploading || sending || Boolean(image || video)} /></div>
          </details>}
          {onBuzz&&<button type="button" aria-label="Buzz room now" onClick={onBuzz}><Zap size={17}/></button>}
          {onCall&&<button type="button" aria-label="Open room call" onClick={()=>{setExpanded(false);onCall();}}><Phone size={17}/></button>}
          <details className="chat-more-menu"><summary aria-label="More chat actions"><MoreHorizontal size={19}/></summary><div>
            <button type="button" onClick={()=>{setSearchOpen(!searchOpen);setSearch("");}}><Search size={17}/>Search messages</button>
            <button type="button" onClick={exportConversation}><Download size={17}/>Export conversation</button>
            <button type="button" onClick={event=>openPhotos("",event.currentTarget)}><Images size={17}/>Shared photos</button>
          </div></details>
          <button type="button" onClick={()=>{followRef.current=true;setExpanded(v=>!v);}} aria-label={expanded?"Collapse chat":"Expand chat"} className="kn-chat-expand">{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
          <button type="button" className="kn-chat-close" aria-label="Close chat" onClick={()=>expanded?setExpanded(false):mobileOpen&&matchMedia("(max-width:767px)").matches?onMobileClose?.():setHidden(true)}><X size={18}/></button>
        </div>}

      />{searchOpen&&<div className="mb-2 flex items-center gap-2">
        <input autoFocus className="min-w-0 flex-1 rounded-lg border border-input bg-field p-2" aria-label="Search chat messages" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this session"/>
        <button type="button" className="kn-chat-close" aria-label="Close search" onClick={()=>{setSearchOpen(false);setSearch("");}}><X size={16}/></button>
      </div>}</div>

      <div ref={node => { scrollRef.current = node; if (node && followRef.current) node.scrollTop = node.scrollHeight; }} role="log" aria-label="Chat messages" aria-live="polite" tabIndex={0} onScroll={() => { const list = scrollRef.current; if (list) followRef.current = list.scrollHeight - list.clientHeight - list.scrollTop < 64; }} className="studio-chat-log sw-scroll -mr-2 min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto overscroll-contain pr-2">
        {!hasConversation && (
          <EmptyState
            compact={!expanded}
            icon={<MessageSquare className="size-5" />}
            title={query?"No matching messages":"Say something"}
            hint={
              aiDj
                ? `Everyone here hears the same second of the song. ${aiDj} is listening too — start a line with /dj to ask for something.`
                : "Everyone here hears the same second of the song — worth a comment."
            }
          />
        )}

        {thread.map((m, i) => {
          const own = !m.dj && (m.senderId === youId || m.nick === you);
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
              own={own}
              grouped={grouped}
              readers={receipts[m.id]}
              profile={(m.senderId===youId||m.nick===you)?ownProfile:members.find(member=>member.id===m.senderId||member.nick===m.nick)?.profile}
              onReply={!m.privateMedia&&!muted?()=>beginReply(m):undefined}
              onEdit={!muted&&own&&m.text?()=>{setReply(undefined);setEditing(m);setText(m.text);inputRef.current?.focus();}:undefined}
              onReact={!muted&&!m.dj?emoji=>void onReact(m.id,emoji).catch(error=>setUploadError(error.message)):undefined}
              status={m.nick ? statuses?.[m.nick] : undefined}
            />
          );
        })}

        {djTyping && aiDj && <TypingRow names={[aiDj]} dj />}
        {typists.length > 0 && <TypingRow names={typists} />}


      </div>

      {/* Composer */}
      <div className="kn-chat-footer mt-2 shrink-0">
        <div className="kn-chat-drafts overflow-y-auto">
        {(editing||reply)&&<div className="kn-attachment-preview"><span>{editing?"Editing message":`Replying to ${reply?.nick || "a message"}`}</span><button type="button" aria-label="Cancel edit or reply" onClick={()=>{if(editing)setText("");setEditing(undefined);setReply(undefined);}}><X size={16}/></button></div>}
        {gif&&<div className="kn-attachment-preview"><img className="size-9 rounded object-contain" src={gifPreviewUrl(gif.url, gif.id)} alt=""/><span>GIF ready to send</span><button type="button" aria-label="Remove GIF" onClick={()=>setGif(undefined)}><X size={16}/></button></div>}
        {gifPicker && <GifPicker open onOpenChange={setGifPicker} onSelect={setGif}/>}

        {video&&<div className="kn-attachment-preview"><Video size={16}/><span>{video.name}</span><button onClick={()=>setVideo(undefined)} aria-label="Remove attachment"><X size={15}/></button></div>}
        {location&&<div className="kn-attachment-preview"><MapPin size={16}/><span>{location.label}{location.live?" · shares for 15 minutes after sending":""}</span><button onClick={()=>setLocation(undefined)} aria-label="Remove location"><X size={15}/></button></div>}
        {liveLocation&&<div className="kn-attachment-preview"><MapPin size={16}/><span>Sharing live location</span>
          <button type="button" onClick={()=>{const {id}=liveLocation;setLiveLocation(null);void onLiveLocation(id).catch(error=>setUploadError(error.message));}}>Stop</button>
        </div>}
        <Dialog open={locationOpen&&!muted} onOpenChange={changeLocationOpen}><DialogContent className="max-w-md">
          <DialogTitle className="pr-12">Share your location</DialogTitle>
          <DialogDescription>Everyone in this room can see the location you send. Live sharing updates for up to 15 minutes, and you can stop it at any time.</DialogDescription>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="kn-background-upload" disabled={locating} onClick={()=>locate(false)}>Use current location</button>
            <button type="button" className="kn-background-upload" disabled={locating||Boolean(liveLocation)} onClick={()=>locate(true)}>Share live for 15 minutes</button>
          </div>
          {locating&&<p className="text-sm text-muted" role="status">Waiting for your device location…</p>}
        </DialogContent></Dialog>
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

        </div>
        {!muted&&(optionsOpen||recording)&&<div ref={optionsPanel} className="kn-chat-options" aria-label="Message options">
          <button type="button" disabled={attachmentBlocked||!canUploadPhotos||Boolean(editing)||Boolean(recipients&&(video||location))} onClick={()=>{setOptionsOpen(false);photoInput.current?.click();}}><ImagePlus size={16}/>Photo</button>
          <button type="button" disabled={attachmentBlocked||!canUploadVideos||Boolean(editing)||Boolean(recipients&&(image||location))} onClick={()=>{setOptionsOpen(false);videoInput.current?.click();}}><Video size={16}/>Video</button>
          <button type="button" disabled={attachmentBlocked||!canUploadPhotos||Boolean(recipients)||Boolean(editing)} onClick={()=>{setOptionsOpen(false);setGifPicker(true);}}><Film size={17}/>GIF</button>
          <VoiceNoteRecorder labeled onRecordingChange={recordingChanged} disabled={attachmentBlocked||!canUploadVideos||Boolean(editing)||Boolean(recipients&&(image||location))} onRecorded={file=>{setOptionsOpen(false);void attachVideo(file,true);}} onError={setUploadError}/>
          <button type="button" disabled={!canShareLocation||Boolean(editing)||Boolean(recipients)} onClick={()=>{setOptionsOpen(false);changeLocationOpen(true);}}><MapPin size={16}/>Location</button>
          <button type="button" onClick={()=>{setOptionsOpen(false);setPickerOpen(value=>!value);}}><Smile size={16}/>Emoji</button>
        </div>}
        {muted ? (
          <div className="flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-4 py-2.5 text-center text-[13px] text-muted">
            The host has muted your chat.
          </div>
        ) : (
          <div className="studio-composer kn-chat-composer flex items-center gap-2 rounded-full border border-input bg-field pl-4 pr-1.5 py-1.5 transition-[border-color,box-shadow] duration-200 ease-[var(--ease)] focus-within:border-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]">
            <button type="button" ref={optionsButton} className="kn-chat-add" aria-label="Chat attachments and actions"
              aria-expanded={optionsOpen||recording} onClick={()=>{if(!recording){setPickerOpen(false);setOptionsOpen(!optionsOpen);}}}><Plus size={20}/></button>
            <textarea
              rows={1}
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
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}
              onPaste={e => { const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith("image/")); if (file) { e.preventDefault(); void attachImage(file); } }}
              aria-label="Chat message"
            />
            <button type="button" ref={emojiButton} className="kn-chat-emoji" aria-label="Choose emoji" aria-expanded={pickerOpen} onClick={()=>{setOptionsOpen(false);setPickerOpen(value=>!value);}}><Smile size={19}/></button>
            {(text || image || video || location || gif || reply || editing) && <button type="button" className="kn-chat-clear" onClick={clearDraft} aria-label="Clear message draft" title="Clear draft"><X size={17}/></button>}
            <button
              type="button"
              onClick={send}
              disabled={(!text.trim() && !image && !video && !location && !gif) || uploading || sending || recording}
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
  return <>{expanded ? <Dialog open onOpenChange={setExpanded}><DialogContent className="studio-chat-sheet !flex !h-[85dvh] !max-h-[min(900px,calc(var(--kn-app-height,100dvh)-24px))] !w-full sm:!w-[calc(100vw-24px)] !max-w-3xl !flex-col !gap-0 !overflow-hidden [&>button]:hidden"><DialogTitle className="sr-only">Room chat</DialogTitle>{content}</DialogContent></Dialog> : content}
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
  readers, profile, onReply, onEdit, onReact,
  status,
}: {
  mediaQuery: string;
  onMediaLoad: () => void;
  onOpenPhoto: (id: string, trigger: HTMLElement) => void;
  msg: ChatMsg;
  own: boolean;
  grouped: boolean;
  readers?: string[];
  profile?: Participant["profile"];
  onReply?:()=>void;onEdit?:()=>void;onReact?:(emoji:string)=>void;
  status?: PresenceStatus;
}) {
  const name = msg.nick ?? "guest";
  const touch=useRef<{x:number;y:number}|null>(null);
  const [reactionsOpen,setReactionsOpen]=useState(false);
  return (
    <div data-read-message={!own&&!msg.dj?msg.id:undefined}
      onTouchStart={event=>{const point=event.touches[0];touch.current=point?{x:point.clientX,y:point.clientY}:null;}}
      onTouchCancel={()=>{touch.current=null;}}
      onTouchEnd={event=>{const point=event.changedTouches[0],start=touch.current;touch.current=null;if(start&&point&&point.clientX-start.x>65&&Math.abs(point.clientY-start.y)<35)onReply?.();}}
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
        profile?.imageId ? <img className="size-6 shrink-0 rounded-full object-cover" alt={name} src={`/chat-media/${profile.imageId}${mediaQuery}`}/> : <Avatar name={name} size="sm" status={status} />
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
          {msg.video?.voice?<VoiceMessage src={msg.video.url+mediaQuery} onLoaded={onMediaLoad}/>:msg.video&&<div className="kn-chat-video"><video src={msg.video.url+mediaQuery} controls playsInline preload="metadata" onLoadedMetadata={onMediaLoad}/><span>{msg.video.name} · playback is local to you</span></div>}
          {msg.location&&<a className="kn-location-card" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(msg.location.lat+','+msg.location.lng)}`} target="_blank" rel="noreferrer"><MapPin size={23}/><span><b>{msg.location.label}</b><small>{msg.location.liveUntil && msg.location.liveUntil>Date.now() ? "Updates live · Open map ↗" : msg.location.updatedAt ? "Sharing ended · Open last location ↗" : "Open map ↗"}</small></span></a>}
          {msg.reply&&<blockquote className="mb-1 border-l-2 border-current/30 pl-2 text-xs opacity-80">{msg.reply.nick||"Reply"}{msg.reply.text? ` · ${msg.reply.text}`:""}</blockquote>}
          {msg.gif&&<img loading="lazy" src={gifPreviewUrl(msg.gif.url,msg.gif.id)} alt={msg.gif.title||"Animated GIF"} className="sw-chat-image" referrerPolicy="no-referrer" onLoad={onMediaLoad}/>}
          <AnimatedChatText text={msg.text}/>
          {msg.editedAt&&<small className="ml-2 opacity-70">Edited</small>}
        </div>
        {!msg.dj&&<div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
          {onReply&&<button type="button" aria-label="Reply to message" onClick={onReply}><Reply size={14}/></button>}
          {onEdit&&<button type="button" aria-label="Edit message" onClick={onEdit}><Pencil size={14}/></button>}
          {onReact&&<button type="button" aria-label="React to message" aria-expanded={reactionsOpen} onClick={()=>setReactionsOpen(!reactionsOpen)}><Smile size={14}/></button>}
          {msg.reactions?.filter(item=>item.count>0).map(item=><button type="button" key={item.emoji} onClick={()=>onReact?.(item.emoji)} disabled={!onReact}>{item.emoji} {item.count}</button>)}
        </div>}
        {reactionsOpen&&<div className="flex flex-wrap gap-2 py-1">{["❤️","😂","🔥","🙌","🥰","😮","👏","🎧"].map(emoji=><button key={emoji} type="button" aria-label={`React ${emoji}`} onClick={()=>{onReact?.(emoji);setReactionsOpen(false);}}>{emoji}</button>)}</div>}
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
