"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./ui/dialog";
import RoomPeople from "./RoomPeople";
import {useAppViewport} from "@/hooks/useAppViewport";
import ChatNotice from "./ChatNotice";
import RoomClock from "./RoomClock";
import {usePlayerSwipe} from "@/hooks/usePlayerSwipe";
import RoomBackground from "./RoomBackground";
import AmbientVisualizer from "./AmbientVisualizer";
import RoomLights from "./RoomLights";
import AppearanceSettings from "./AppearanceSettings";
import {useAppearance,receiveRoomAppearance} from "@/hooks/useAppearance";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft, ArrowRight, Menu, Volume2, VolumeX, PanelsTopLeft, PanelTopClose, Settings, LogOut, Phone,
  Activity as ActivityIcon,
  BarChart3,
  History as HistoryIcon,
  Home,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Keyboard,
  ListMusic,
  Heart,
  Upload,
  Video,
  Smile,
  Music2,
  MessageSquare,
  Play,
  Radio,
  Search as SearchIcon,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { createSyncClock, playbackPosition, playbackRunning, correction } from "@/lib/client-sync.mjs";
import { EVENTS } from "@/lib/protocol.mjs";
import { cn } from "@/lib/cn";
import type {
  ChatMsg,
  HistoryEntry,
  Mood,
  Participant,
  PendingRequest,
  PresenceStatus,
  ReactionEvent,
  Repeat,
  RoomStats,
  Track,
} from "@/lib/types";
import { useArtworkTheme } from "@/hooks/useArtworkTheme";
import { useRoomGain } from "@/hooks/useRoomGain";
import { useCasting } from "@/hooks/useCasting";
import { useCrossfade } from "@/hooks/useCrossfade";
import { useMediaSession } from "@/hooks/useMediaSession";
import { usePresence } from "@/hooks/usePresence";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useSwipe } from "@/hooks/useSwipe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Panel } from "@/components/ui/panel";
import { Popover } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import BottomPlayer, { ReactionBar } from "@/components/BottomPlayer";
import type { LibrarySection } from "@/components/LibraryPanel";
import LibraryPanel from "@/components/LibraryPanel";
import type { Playlist } from "@/lib/types";
import SearchPanel from "@/components/SearchPanel";
import {CalendarDays} from "lucide-react";
import RoomNotifications from "./RoomNotifications";
import SongComments from "./SongComments";
import {stopMediaSlots} from "@/lib/browser-playback";
import {RotateCcw} from "lucide-react";
import VideoStage from "./VideoStage";
import UploadedVideo from "@/components/UploadedVideo";
import YouTubePlayer from "@/components/YouTubePlayer";
import NowPlaying from "@/components/NowPlaying";
import QueuePanel from "@/components/QueuePanel";
import Recommendations from "@/components/Recommendations";
import ActivityFeed from "@/components/ActivityFeed";
import ChatPanel from "@/components/ChatPanel";
import {useRoomExit} from '@/hooks/useRoomExit';
import {useUploadedBuffer} from '@/hooks/useUploadedBuffer';
import {PlayerMessageComposer,PlayerMessageOverlay,type PlayerMessage} from './PlayerMessage';
import {unlockSounds,messageSound,setSoundEnabled,soundEnabled} from '@/lib/notification-sounds';
import RoomTogether from "@/components/RoomTogether";
import Reactions, { type IncomingReaction } from "@/components/Reactions";
import Logo from "@/components/Logo";

/**
 * Three surfaces nobody sees on arrival: two are behind a tab, one behind a
 * keypress. Splitting them out keeps the room's first load to what the room
 * actually opens with — and the dialog drags a whole modal library with it.
 */
const HistoryPanel = dynamic(() => import("@/components/HistoryPanel"), {
  loading: () => <PanelLoading label="Loading history…" />,
});
const StatsPanel = dynamic(() => import("@/components/StatsPanel"), {
  loading: () => <PanelLoading label="Counting up…" />,
});
const ShortcutsDialog = dynamic(() => import("@/components/ShortcutsDialog"));
const SoundSettings = dynamic(() => import("@/components/SoundSettings"));

/** Upper bound for the per-device audio delay (matches the settings slider). */
import InstallButton, { InstallBanner } from "@/components/InstallButton";
import ShareButton from "@/components/ShareButton";

type Tab = "now" | "queue" | "search" | "chat" | "settings";
const TAB_ORDER: Tab[] = ["now", "queue", "search", "chat"];
/** The centre column carries three lists; they share one segmented control. */
type CenterView = "queue" | "history" | "stats";
/** The right column carries two surfaces; on a phone they take turns. */
type SidePane = "chat" | "activity";

export default function Room({ code, asHost }: { code: string; asHost: boolean }) {
  const [nick, setNick] = useState("");
  const [flushOnHostLeave,setFlushOnHostLeave]=useState(false),[roomEnded,setRoomEnded]=useState(""),[playerMessage,setPlayerMessage]=useState<PlayerMessage|null>(null),[soundsOn,setSoundsOn]=useState(true);
  const [joined, setJoined] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [denied, setDenied] = useState(false);
  // Host-only: who's waiting to be let into an invite-only room.
  useAppViewport();
  const [persistentSpace,setPersistentSpace]=useState(false);
  const [sceneOnly,setSceneOnly]=useState(false);
  const [inviteOnly,setInviteOnly]=useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState(`Room ${code}`);
  const [aiDj, setAiDj] = useState<string | null>(null);

  const [you, setYou] = useState<string | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  // The DJ has no socket of its own, so the server reports this on its behalf.
  const [djTyping, setDjTyping] = useState(false);
  const [reactionLog, setReactionLog] = useState<ReactionEvent[]>([]);
  const [lastReaction, setLastReaction] = useState<IncomingReaction | null>(null);
  const [skipVotes, setSkipVotes] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [dl, setDl] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>("now");
  const [playerExpanded,setPlayerExpanded]=useState(false);
  const goHome = useCallback(() => {
    setPlayerExpanded(true);
    setTab("now");
    setCenter("queue");
    window.dispatchEvent(new Event("konnectivity:home"));
  }, []);
  const playerSwipe=usePlayerSwipe({onUp:()=>{},onDown:()=>setPlayerExpanded(false),zone:".kn-expanded-heading,.sw-art-glow"});
  const [center, setCenter] = useState<CenterView>("queue");
  const appearance = useAppearance();
  const [pane, setPane] = useState<SidePane>("chat");
  const [unread, setUnread] = useState(0);
  const [latestChat,setLatestChat]=useState<{nick:string;text:string}|null>(null);
  const [dismissedUnread,setDismissedUnread]=useState(0);
  const [chatExpanded,setChatExpanded]=useState(false);
  const chatView=useRef({tab,pane,playerExpanded,chatExpanded});
  chatView.current={tab,pane,playerExpanded,chatExpanded};
  const chatIsVisible=useCallback(()=>{
    const view=chatView.current;
    return document.visibilityState==='visible'&&!view.playerExpanded&&(view.chatExpanded||(!document.querySelector('[role="dialog"]')&&(matchMedia('(min-width: 768px)').matches?Boolean(document.activeElement?.closest('[data-room-chat]')):(view.tab==='chat'&&view.pane==='chat'))));
  },[]);
  const openChatNotice=useCallback(()=>{setPlayerExpanded(false);setTab('chat');setPane('chat');setUnread(0);setDismissedUnread(0);window.dispatchEvent(new Event('konnectivity:open-chat'));},[]);

  const [toolsOpen,setToolsOpen]=useState(false),[playbackError,setPlaybackError]=useState<string|null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);
  const [library, setLibrary] = useState<Track[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LibrarySection>("songs");
  const [playlistSeed, setPlaylistSeed] = useState<Track | undefined>();
  const [notice, setNotice] = useState("");
  const openLibrary = useCallback((section: LibrarySection, seed?: Track) => { setLibrarySection(section); setPlaylistSeed(seed); setLibraryOpen(true); }, []);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [uploadToken, setUploadToken] = useState("");
  const uploadedBuffer=useUploadedBuffer(current?.videoId,code,uploadToken,joined);
  const uploadReady=useRef(true);uploadReady.current=!current?.videoId.startsWith('local_')||Boolean(uploadedBuffer.url);
  const canControl = joined;
  // The server owns the room volume, including reconnect snapshots.
  const [volume, setVolume] = useState(1);
  const [videoLink, setVideoLink] = useState("");
  const [activityRequest,setActivityRequest]=useState<{view:'plans'|'polls'|'call';id:number}>({view:'plans',id:0});
  const openActivities=(view:'plans'|'polls'|'call')=>setActivityRequest(previous=>({view,id:previous.id+1}));
  const [watchVideo, setWatchVideo] = useState(false);
  const [reactionDockOpen, setReactionDockOpen] = useState(false);
  const reactionDockRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!reactionDockOpen) return;
    const outside = (event: PointerEvent) => {
      if (!reactionDockRef.current?.contains(event.target as Node)) setReactionDockOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setReactionDockOpen(false); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape); };
  }, [reactionDockOpen]);
  const [videoControlsHidden,setVideoControlsHidden]=useState(false),[lastVideo,setLastVideo]=useState<Track|null>(null);
  const localVideo=current?.mediaType==="video";
  const videoActive = Boolean(current && watchVideo && (localVideo || !current.videoId.startsWith("local_")));
  const localVideoRef=useRef<HTMLVideoElement|null>(null);
  const setLocalVideo=useCallback((element:HTMLVideoElement|null)=>{localVideoRef.current=element;},[]);
  useEffect(()=>{setVideoControlsHidden(false);if(videoActive&&current)setLastVideo(current);},[current?.videoId,videoActive]);
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!videoActive) return;
    const frame = requestAnimationFrame(() => {
      const main = mainRef.current;
      if (main) main.scrollTo({ top: tab === "now" ? 0 : main.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, videoActive]);

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clockRef = useRef(createSyncClock());
  const [networkRtt, setNetworkRtt] = useState<number | null>(null);
  const [syncHolding, setSyncHolding] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string[]>([]);
  const [syncKey, setSyncKey] = useState("");
  const [resumeAt, setResumeAt] = useState(0);
  const lastReadyRef = useRef<{key:string;ready:boolean;background:boolean;at:number}|null>(null);
  const playbackRef = useRef({ startedAt: 0, pausedPosition: 0, isPlaying: false, syncHolding: false, resumeAt: 0 });

  // Crossfade: a second element to fade into ahead of a natural track end.
  // `activeSlot` says which element the sync loop, volume and onEnded treat
  // as authoritative — it only ever flips once the server's own track change
  // confirms the fade guessed right, never on the fade's own timer (see the
  // audio-sync effect below for why that distinction matters).
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const crossfadeStartedRef = useRef(false);
  const crossfadingRef = useRef(false);
  const { start: startCrossfade, cancel: cancelCrossfade } = useCrossfade();
  const queueRef = useRef<Track[]>([]);
  const roomGain = useRoomGain(joined, audioRef, nextAudioRef, volume);
  const volumeRef = useRef(1);
  const CROSSFADE_SECONDS = 5;
  const CROSSFADE_MIN_DURATION = 10;

  // Fine sync. Below the tolerance, drift is left alone (the clock estimate
  // itself is only good to a few tens of ms); above it, playback speed is
  // nudged by at most MAX_NUDGE until it closes.
  const resyncRef = useRef(false);
  const [soundOpen, setSoundOpen] = useState(false);

  const casting = useCasting(
    useCallback(
      () => videoActive ? localVideoRef.current : (activeSlot === "A" ? audioRef.current : nextAudioRef.current),
      [activeSlot,videoActive]
    ),current?`/audio/${current.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`:undefined
  );

  const isHost = you != null && participants.find((p) => p.id === you)?.isHost === true;
  const serverNow = () => clockRef.current.now();

  // The whole room takes its colour from the current cover.
  useArtworkTheme(current?.art || current?.thumbnail);

  const emit = useCallback(
    (ev: string, payload?: unknown, ack?: (result: any) => void) => {
      if (ack) return socketRef.current?.emit(ev, payload ?? {}, ack);
      return socketRef.current?.emit(ev, payload ?? {});
    },
    []
  );

  const exit=useRoomExit(joined&&!kicked&&!roomEnded,()=>new Promise<void>((resolve,reject)=>{
    const s=socketRef.current;if(!s?.connected){resolve();return;}s.timeout(5000).emit(EVENTS.ROOM_LEAVE,{},(err:Error|null,result:any)=>{if(err||result?.error)reject(Error(result?.error||'Could not leave the room. Please try again.'));else{audioRef.current?.pause();nextAudioRef.current?.pause();resolve();}});
  }));
  useEffect(() => {
    if(!joined)return;
    let pending:Record<string,unknown>={},timer:ReturnType<typeof setTimeout>|undefined;
    const change=(event:Event)=>{Object.assign(pending,(event as CustomEvent).detail);if(!timer)timer=setTimeout(()=>{emit(EVENTS.APPEARANCE_SET,pending);pending={};timer=undefined;},200);};
    window.addEventListener("konnectivity:appearance-request",change);
    return()=>{window.removeEventListener("konnectivity:appearance-request",change);if(timer)clearTimeout(timer);};
  },[joined,emit]);

  const readinessRef = useRef({ key: "", badSince: 0, foregroundAt: 0 });
  const reportReady = useCallback((ready: boolean, key: string) => {
    if (!key) return;
    if(!uploadReady.current)ready=false;
    const now = performance.now(), background = uploadReady.current&&document.visibilityState !== "visible";
    const state = readinessRef.current;
    if (state.key !== key) { state.key = key; state.badSince = 0; state.foregroundAt = now; }
    ready = ready && clockRef.current.calibrated();
    if (ready || background) state.badSince = 0;
    else {
      if (!state.badSince) state.badSince = now;
      // Seeking and OS gestures are transient, not a reason to stop everyone.
      if (uploadReady.current&&(now - state.badSince < 1500 || now - state.foregroundAt < 2500)) return;
    }
    const previous = lastReadyRef.current;
    if (previous?.key === key && previous.ready === ready && previous.background === background && now-previous.at < 3000) return;
    lastReadyRef.current = { key, ready, background, at: now };
    emit(EVENTS.SYNC_MEDIA, { key, ready, background });
  }, [emit]);
  useEffect(() => {
    if (!joined || !syncKey) return;
    const changed = () => {
      readinessRef.current.foregroundAt = performance.now();
      readinessRef.current.badSince = 0;
      lastReadyRef.current = null;
      emit(EVENTS.SYNC_MEDIA, { key: syncKey, ready: uploadReady.current, background: uploadReady.current&&document.visibilityState !== "visible" });
    };
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("pagehide", changed);
    return () => { document.removeEventListener("visibilitychange", changed); window.removeEventListener("pagehide", changed); };
  }, [joined, syncKey, emit]);
  const getMediaRunning = useCallback(() => playbackRunning(playbackRef.current, clockRef.current.now()), []);
  const getMediaPosition = useCallback(() => playbackPosition(playbackRef.current, clockRef.current.now()), []);
  // Presence: what this listener is doing, reported and deduplicated.
  const signal = usePresence(
    useCallback((status: PresenceStatus) => emit(EVENTS.PRESENCE_SET, { status }), [emit]),
    joined
  );

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sw_nick") : "";
    if (saved) setNick(saved);
  }, []);

  // Apply volume to the *active* element whenever it, the track, or which
  // slot is active changes. A crossfade in progress owns both elements'
  // volume on its own terms — this effect steps back until it's done, or it
  // would fight the ramp with a jump to full volume mid-fade. The loudness
  // gain is a track-level correction, not a listener preference, so it
  // multiplies the listener's own volume rather than replacing it — volume
  // stays entirely local either way.
  useEffect(() => {
    if (crossfadingRef.current) return;
    const el = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    if (el) el.volume = Math.min(1, (roomGain.active ? 1 : volume) * (current?.gain ?? 1));
  }, [volume, roomGain.active, current?.videoId, current?.gain, activeSlot]);

  // Read via refs inside the tick loop below, so adjusting the volume slider
  // or the queue doesn't restart the audio-sync effect (and with it, the
  // src-reload check) on every keystroke-equivalent update.
  useEffect(() => {
    volumeRef.current = roomGain.active ? 1 : volume;
  }, [volume, roomGain.active]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // A crossfade is a one-shot per track — reset the guard the moment the
  // server's own idea of the current track changes, whether that came from
  // the crossfade itself completing or an explicit skip.
  useEffect(() => {
    crossfadeStartedRef.current = false;
  }, [current?.videoId]);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    emit(EVENTS.CONTROL_VOLUME, { volume: v });
  }, [emit]);

  function applyPlayback(s: any) {
    playbackRef.current = {
      startedAt: s.startedAt,
      pausedPosition: s.pausedPosition,
      isPlaying: s.isPlaying,
      syncHolding: Boolean(s.syncHolding), resumeAt: s.resumeAt || 0,
    };
    setSyncHolding(Boolean(s.syncHolding)); setWaitingFor(s.waitingFor || []); setSyncKey(s.syncKey || ""); setResumeAt(s.resumeAt || 0);
    setWatchVideo(Boolean(s.watchVideo));
    if (typeof s.volume === "number") setVolume(s.volume);
    setCurrent(s.current);
    setIsPlaying(s.isPlaying);
    setPreparing(Boolean(s.preparing));
    setPlaybackError(s.playbackError||null);
    setShuffle(Boolean(s.shuffle));
    if (s.repeat) setRepeat(s.repeat);
    setSkipVotes(s.skipVotes ?? 0);
    clockRef.current.seed(s.serverNow);
  }

  const doJoin = useCallback(() => {
    if (!nick.trim()) return;
    unlockSounds();setSoundsOn(soundEnabled());
    localStorage.setItem("sw_nick", nick.trim());
    const ownerToken =
      typeof window !== "undefined" ? localStorage.getItem(`sw_owner_${code}`) : null;

    const socket = io({ path: "/socket.io", auth: { code, ownerToken } });
    socket.on("connect_error", (e: Error) => setError(e.message));
    socketRef.current = socket;

    socket.on("connect", () => socket.emit(EVENTS.JOIN, { code, nick: nick.trim(), ownerToken }));
    socket.on(EVENTS.ERROR, (e: { message: string }) => setError(e.message));
    socket.on('room:policy',(s:{flushOnHostLeave:boolean})=>setFlushOnHostLeave(s.flushOnHostLeave));
    socket.on('room:ended',(s:{message:string})=>{setRoomEnded(s.message);audioRef.current?.pause();nextAudioRef.current?.pause();socket.disconnect();});
    socket.on('player:message',(m:PlayerMessage|null)=>setPlayerMessage(m));
    socket.on(EVENTS.KICKED, () => setKicked(true));
    socket.on(EVENTS.JOIN_PENDING, () => setAwaitingApproval(true));
    socket.on(EVENTS.JOIN_DENIED, () => {
      setAwaitingApproval(false);
      setDenied(true);
    });
    socket.on(EVENTS.PENDING_UPDATE, (s: { pending: PendingRequest[] }) =>
      setPendingRequests(s.pending || [])
    );
    socket.on(EVENTS.PERSONAL_SPACE_UPDATE,(s:{enabled:boolean})=>setPersistentSpace(s.enabled));
    socket.on(EVENTS.ROOM_ACCESS_UPDATE, (s: {inviteOnly:boolean})=>setInviteOnly(s.inviteOnly));
    socket.on(EVENTS.ROOM_STATE, async (s: any) => {
      if(s.appearance)receiveRoomAppearance(s.appearance);
      const access = await fetch("/api/room-access", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,token:s.uploadToken})});
      if(!access.ok){setError("Could not authorize this room. Reopen your invitation.");return;}
      setFlushOnHostLeave(Boolean(s.flushOnHostLeave));
      setPersistentSpace(Boolean(s.persistentSpace));
      setInviteOnly(Boolean(s.inviteOnly));
      setYou(s.you);
      setUploadToken(s.uploadToken || "");
      setPlaylists(s.playlists || []);
      setLibrary(s.library || []);
      setRoomName(s.name || `Room ${code}`);
      setAiDj(s.aiDj ?? null);
      setQueue(s.queue);
      setParticipants(s.participants);
      setChat(s.chat || []);
      setPlayerMessage(s.playerMessage||null);
      setHistory(s.history || []);
      setStats(s.stats ?? null);
      setMood(s.mood ?? null);
      setPendingRequests(s.pending || []);
      applyPlayback(s);
      // Only a real seat (not a pending request) reaches this handler at all —
      // an invite-only room's non-host joiners get JOIN_PENDING instead.
      setAwaitingApproval(false);
      setJoined(true);
    });
    socket.on(EVENTS.APPEARANCE_UPDATE, receiveRoomAppearance);
    socket.on(EVENTS.LIBRARY_UPDATE, (s: { playlists: Playlist[]; library: Track[] }) => { setPlaylists(s.playlists); setLibrary(s.library || []); });
    socket.on(EVENTS.QUEUE_UPDATE, (s: { queue: Track[] }) => setQueue(s.queue));
    socket.on(EVENTS.PARTICIPANTS_UPDATE, (s: { participants: Participant[] }) =>
      setParticipants(s.participants)
    );
    socket.on(EVENTS.HISTORY_UPDATE, (s: { history: HistoryEntry[] }) => setHistory(s.history));
    socket.on(EVENTS.STATS_UPDATE, (s: { stats: RoomStats }) => setStats(s.stats));
    socket.on(EVENTS.MOOD_UPDATE, (s: { mood: Mood }) => setMood(s.mood));
    socket.on(EVENTS.DJ_TYPING, (s: { typing: boolean }) => setDjTyping(s.typing));
    socket.on(EVENTS.PLAYBACK_UPDATE, (s: any) => applyPlayback(s));
    socket.on(EVENTS.CHAT_NEW, (m: ChatMsg) => {
      setChat((c) => [...c.slice(-199), m]);
      if(!m.system&&m.nick!==nick.trim())messageSound();
      if (!m.system && m.nick!==nick.trim() && !chatIsVisible()) {
        setUnread((count)=>Math.min(999,count+1));
        setLatestChat({nick:m.nick||'Someone',text:m.text||(m.video?'Shared a video':m.location?'Shared a location':m.image?'Sent an image':'New message')});
      }
    });
    socket.on(
      EVENTS.REACTION_NEW,
      ({ id, emoji, nick: from }: { id: string; emoji: string; nick?: string }) => {
        // The burst itself is drawn by <Reactions>, seeded from this id so
        // every client in the room renders the identical one.
        setLastReaction({ id, emoji });
        // The feed keeps a short tail of them. Bounded because reactions are
        // the one event that can arrive several times a second.
        setReactionLog((l) => [...l.slice(-39), { id, emoji, nick: from, ts: Date.now() }]);
      }
    );
    socket.on(EVENTS.DOWNLOAD_PROGRESS, ({ videoId, percent }: { videoId: string; percent: number }) =>
      setDl((d) => ({ ...d, [videoId]: percent }))
    );
    socket.on(EVENTS.SYNC_PONG, ({ t0, serverNow: sn }: { t0: number; serverNow: number }) => {
      const result = clockRef.current.sample(t0, performance.now(), sn);
      if (result) { setNetworkRtt(result.rtt); socket.emit(EVENTS.SYNC_REPORT, { rtt: result.rtt }); }
    });
    const ping = () => socket.emit(EVENTS.SYNC_PING, { t0: performance.now() });
    const burst = () => { ping(); for (const ms of [100,250,500,1000]) setTimeout(ping, ms); };
    socket.on("connect", burst);
    const onVisible = () => { if (document.visibilityState === "visible") burst(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", burst);
    burst();
    const pingId = setInterval(ping, 2000);
    return () => {
      clearInterval(pingId);
      document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", burst);
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nick, code, asHost]);

  // smooth position ticker for the progress bar
  useEffect(() => {
    const id = setInterval(() => {
      const pb = playbackRef.current;
      setPosition(playbackPosition(pb, serverNow()));
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  useEffect(()=>{
    const read=()=>{if(chatIsVisible()){setUnread(0);setDismissedUnread(0);}};
    read();document.addEventListener('visibilitychange',read);document.addEventListener('focusin',read);
    const desktop=matchMedia('(min-width: 768px)');desktop.addEventListener('change',read);
    return()=>{document.removeEventListener('visibilitychange',read);document.removeEventListener('focusin',read);desktop.removeEventListener('change',read);};
  },[tab,pane,chat,playerExpanded,chatExpanded,chatIsVisible]);

  /**
   * Audio sync loop — only runs once the server says the track is ready.
   *
   * Runs on whichever element `activeSlot` currently names. A crossfade's own
   * fade timer never decides the flip: it only fades volume on the side.
   * The flip happens right here, in the same place that already detects "the
   * server's track changed" — if the *inactive* element already has that
   * exact audio loaded and playing (because a fade already guessed right),
   * this adopts it instead of reloading. Driving the flip off the real
   * `current.videoId` change, rather than off the fade's own 5-second timer,
   * is what keeps this from racing the server: the fade is only ever a local
   * preview until the server actually confirms the track changed.
   */
  const retryRef = useRef(0);
  useEffect(()=>()=>{cancelCrossfade();stopMediaSlots(audioRef.current,nextAudioRef.current);},[cancelCrossfade]);
  useEffect(() => {
    const active = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    const inactive = activeSlot === "A" ? nextAudioRef.current : audioRef.current;
    if (videoActive) {
      cancelCrossfade(); crossfadingRef.current = false;
      audioRef.current?.pause(); nextAudioRef.current?.pause(); setBuffering(false); return;
    }
    if(!joined||roomEnded||!current||preparing){
      cancelCrossfade();crossfadingRef.current=false;crossfadeStartedRef.current=false;
      stopMediaSlots(audioRef.current,nextAudioRef.current);setBuffering(false);return;
    }
    if(!active)return;
    const localUpload=current.videoId.startsWith('local_');
    if(localUpload&&!uploadedBuffer.url){active.pause();inactive?.pause();setBuffering(true);reportReady(false,syncKey);return;}
    const wantSrc = localUpload?uploadedBuffer.url:`/audio/${current.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`;

    if (!active.src.endsWith(wantSrc)) {
      if (inactive && inactive.src.endsWith(wantSrc) && !inactive.paused) {
        // Already faded into this exact track — adopt it rather than
        // reloading, and let this effect re-run on the newly active element.
        // The element being retired keeps playing at its faded-out volume
        // otherwise — nothing else ever stops it once it's no longer active.
        cancelCrossfade();
        crossfadingRef.current = false;
        active.pause();
        setActiveSlot((s) => (s === "A" ? "B" : "A"));
        return;
      }
      // The server went somewhere the fade didn't predict — a vote-skip
      // landed, the host skipped, or the queue was reordered mid-fade. The
      // inactive element is part-way into the wrong song and audible, and
      // adopting it is exactly what we must not do, so stop it here: this is
      // the only place that learns the prediction was wrong.
      if (crossfadingRef.current || (inactive && !inactive.paused)) {
        cancelCrossfade();
        crossfadingRef.current = false;
        if (inactive) {
          inactive.pause();
          inactive.removeAttribute("src");
          inactive.load();
        }
        active.volume = Math.min(1, volumeRef.current * (current.gain ?? 1));
      }
      retryRef.current = 0;
      active.src = wantSrc;
      active.load();
      // A seek before metadata arrives is ignored, which left a fresh join to
      // close its offset by nudging over several seconds. Land it exactly
      // once the element can actually seek.
      active.addEventListener("loadedmetadata", () => (resyncRef.current = true), { once: true });
    }

    let lastCorrectionSeek = -Infinity;
    const tick = () => {
      const pb = playbackRef.current;
      const expected = playbackPosition(pb, serverNow());
      const running = playbackRunning(pb, serverNow());
      const dur = current.duration || 0;

      // A seek backward (or anything else that undoes "near the end") after a
      // crossfade already started leaves it previewing a track that's no
      // longer imminent — abandon it rather than leave it playing ahead.
      if (crossfadeStartedRef.current && dur - expected > CROSSFADE_SECONDS + 2) {
        crossfadeStartedRef.current = false;
        if (crossfadingRef.current) {
          cancelCrossfade();
          crossfadingRef.current = false;
          // The ramp had already pulled this element part-way down, and
          // cancelling mid-ramp leaves it there — silent-ish playback with no
          // way back up, since the volume effect stands aside during a fade.
          active.volume = Math.min(1, volumeRef.current * (current.gain ?? 1));
        }
        if (inactive) {
          inactive.pause();
          inactive.removeAttribute("src");
          inactive.load();
        }
      }

      // Start fading into the next track a few seconds before this one ends.
      // Shuffle makes queue[0] an unreliable prediction of what plays next,
      // so it's excluded rather than risk fading into the wrong song.
      // repeat:"one" replays the same track — that's a loop, not a "next
      // song" moment, so it stays a hard cut. Only ever attempted once per
      // track (crossfadeStartedRef), and only into audio that's already
      // fully cached — anything still downloading falls back to the existing
      // hard-cut-and-wait behaviour rather than fading into a stall.
      if (
        !crossfadeStartedRef.current &&
        !crossfadingRef.current &&
        running &&
        !shuffle &&
        repeat !== "one" &&
        dur >= CROSSFADE_MIN_DURATION &&
        dur - expected > 0 &&
        dur - expected <= CROSSFADE_SECONDS
      ) {
        const next = queueRef.current[0];
        if (next && !next.videoId.startsWith("local_") && inactive && next.status?.state === "cached") {
          crossfadeStartedRef.current = true;
          crossfadingRef.current = true;
          inactive.src = `/audio/${next.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`;
          inactive.currentTime = 0;
          inactive.playbackRate = 1;
          inactive.volume = 0;
          inactive.play().catch(() => {});
          // The next track's own loudness gain isn't known client-side until
          // the server confirms the switch, so the fade targets plain
          // listener volume — the gain correction applies a moment later,
          // once `current.gain` arrives, same as any other track.
          startCrossfade(active, inactive, CROSSFADE_SECONDS, volumeRef.current, () => {
            crossfadingRef.current = false;
          });
        }
      }

      if (running && active.paused && !needsGesture) {
        active
          .play()
          .then(() => setNeedsGesture(false))
          .catch((err) => {
            if (err?.name === "NotAllowedError") { setNeedsGesture(true); reportReady(false, syncKey); }
          });
      }
      if (!running && !active.paused) active.pause();
      if (!running && crossfadingRef.current) {
        cancelCrossfade(); crossfadingRef.current = false; crossfadeStartedRef.current = false;
        inactive?.pause(); active.volume = Math.min(1, volumeRef.current * (current.gain ?? 1));
      }
      // A crossfade in progress owns the active element's fade-out on its own
      // terms — forcing its position to `expected` mid-ramp would just fight
      // the fade with a stutter right as it's supposed to be smooth.
      //
      // `target` runs ahead of the room by this device's audio delay, so the
      // sound that comes out of slow (Bluetooth) speakers lands in step.
      // Large drift jumps; small drift is steered by playing a few percent
      // fast or slow until it closes. A jump is audible, a 3% speed change
      // isn't, and this is what takes sync from "within a second" to
      // "within a few tens of milliseconds".
      const target = expected + (pb.isPlaying ? roomGain.outputLatency || 0 : 0);
      if (document.visibilityState === "visible" && !crossfadingRef.current && !active.seeking && Number.isFinite(target) && active.readyState >= 3) {
        const move = correction(active.currentTime, target, running && !active.paused, resyncRef.current);
        if (move.seek !== null && (resyncRef.current || performance.now() - lastCorrectionSeek > 2000)) {
          active.currentTime = Math.min(move.seek, Number.isFinite(active.duration) ? active.duration : move.seek);
          lastCorrectionSeek = performance.now();
        }
        resyncRef.current = false;
        active.playbackRate = move.rate;
      }
      const remaining = Math.max(0, (current.duration || 0) - active.currentTime);
      const ready = active.readyState >= 3 && !active.seeking && !roomGain.suspended && !needsGesture;
      reportReady(ready || (current.duration > 0 && remaining < .15), syncKey);
      setBuffering(pb.isPlaying && !ready);
    };
    tick();
    const events = ["canplay", "playing", "waiting", "stalled", "seeked"];
    for (const name of events) active.addEventListener(name, tick);
    const id = setInterval(tick, 100);
    return () => { clearInterval(id); for (const name of events) active.removeEventListener(name, tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined,roomEnded,current?.videoId, isPlaying, preparing, activeSlot, shuffle, repeat, videoActive, syncKey, syncHolding, resumeAt, roomGain.outputLatency, roomGain.suspended, needsGesture, code, uploadToken, uploadedBuffer.url]);

  const resumeAudio = () => {
    roomGain.resume();
    const audio = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    if (!audio) return;
    audio.play().then(() => setNeedsGesture(false)).catch(() => {});
  };

  const onEnded = () => {
    if (canControl && current) emit(EVENTS.TRACK_ENDED, { videoId: current.videoId });
  };
  const onAudioError = () => {
    // Wired to whichever <audio> tag is currently active (see the JSX below),
    // so this is only ever called for the one the sync loop is governing.
    const audio = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    if (!audio || !current || retryRef.current >= 6) return;
    retryRef.current += 1;
    setTimeout(() => {
      audio.load();
      if (playbackRef.current.isPlaying) audio.play().catch(() => {});
    }, 2500);
  };

  const curDl = current ? (dl[current.videoId] ?? null) : null;
  const needVotes = Math.max(1, Math.ceil(participants.length / 2));

  /* ------------------------------------------------------------- actions */

  const addTrack = useCallback(
    (track: Track) => {
      emit(EVENTS.QUEUE_ADD, { track });
      signal("queueing");
    },
    [emit, signal]
  );
  const addTracks = useCallback(
    (tracks: Track[], from?: string) => {
      emit(EVENTS.QUEUE_ADD_MANY, { tracks, from });
      signal("queueing");
    },
    [emit, signal]
  );
  const likeTrack = useCallback((id: string) => emit(EVENTS.QUEUE_LIKE, { id }), [emit]);
  const voteTrack = useCallback(
    (id: string) => {
      emit(EVENTS.QUEUE_VOTE, { id });
      signal("voting");
    },
    [emit, signal]
  );
  const reorderTrack = useCallback(
    (id: string, toIndex: number) => emit(EVENTS.QUEUE_REORDER, { id, toIndex }),
    [emit]
  );
  const removeTrack = useCallback((id: string) => emit(EVENTS.QUEUE_REMOVE, { id }), [emit]);
  const muteParticipant = useCallback(
    (id: string, muted: boolean) => emit(EVENTS.HOST_MUTE, { id, muted }),
    [emit]
  );
  const kickParticipant = useCallback((id: string) => emit(EVENTS.HOST_KICK, { id }), [emit]);
  const approveJoin = useCallback((id: string) => emit(EVENTS.HOST_APPROVE, { id }), [emit]);
  const denyJoin = useCallback((id: string) => emit(EVENTS.HOST_DENY, { id }), [emit]);
  const addToPlaylist = useCallback((id: string, track: Track) => emit(EVENTS.PLAYLIST_ADD_TRACK, { id, track }, (result: any) => {
    setNotice(result.error || `♡ Saved “${track.title}” to your playlist`);
  }), [emit]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }, [notice]);
  const createPlaylistFor = useCallback((track?: Track) => openLibrary("playlists", track), [openLibrary]);
  const playFromSearch = useCallback((track: Track) => {
    emit(EVENTS.CONTROL_PLAY_NOW, { track, preferVideo: false }); setTab("now");
  }, [emit]);
  const queueFromSearch = useCallback((track: Track) => emit(EVENTS.QUEUE_ADD, { track, preferVideo: false }), [emit]);
  const playNow = useCallback((track: Track) => emit(EVENTS.CONTROL_PLAY_NOW, { track }), [emit]);
  const playQueueNow = useCallback((id: string) => emit(EVENTS.CONTROL_PLAY_NOW, { id }), [emit]);
  const seekTo = useCallback((pos: number) => emit(EVENTS.CONTROL_SEEK, { position: pos }), [emit]);
  const playPause = useCallback(() => emit(EVENTS.CONTROL_PLAYPAUSE), [emit]);
  const skip = useCallback(() => emit(EVENTS.CONTROL_SKIP), [emit]);

  useMediaSession({
    current,
    isPlaying,
    position,
    duration: current?.duration ?? 0,
    isHost: canControl,
    onPlayPause: playPause,
    onSkip: skip,
    onSeek: seekTo,
  });

  const voteSkip = useCallback(() => {
    emit(EVENTS.VOTE_SKIP);
    signal("voting");
  }, [emit, signal]);
  const sendChat = useCallback((text: string, imageId?: string, videoId?:string, location?:ChatMsg["location"]) => emit(EVENTS.CHAT_SEND, { text, imageId, videoId, location }, (result: any) => {
    if (result.error) setNotice(result.error);
  }), [emit]);
  const uploadChatImage = useCallback(async (file: File) => {
    if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB");
    const response = await fetch("/chat-media", { method: "POST", body: file, headers: {
      "x-room-code": code, "x-upload-token": uploadToken, "x-file-name": encodeURIComponent(file.name),
    } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Image upload failed");
    return data.image as { id: string; url: string; name: string };
  }, [code, uploadToken]);
  const uploadChatVideo = useCallback(async (file:File)=>{
    if(file.size>50*1024*1024)throw Error("Choose a video up to 50 MB.");
    const response=await fetch('/chat-video',{method:'POST',body:file,headers:{'x-room-code':code,'x-upload-token':uploadToken,'x-file-name':encodeURIComponent(file.name)}});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Video upload failed.');return data.video as NonNullable<ChatMsg['video']>;
  },[code,uploadToken]);
  const mediaQuery = `?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`;
  const setVideoMode = useCallback((enabled: boolean) => {
    if(enabled && current?.videoId.startsWith("local_")&&current.mediaType!=="video"){setNotice("Local files are audio-only. Choose a YouTube song for video.");return;}
    emit(EVENTS.CONTROL_VIDEO, { enabled }, (result: any) => { if (result.error) setNotice(result.error); });
    if (enabled) { setTab("now"); setNotice("Video is playing the same song. Switch back to Audio anytime."); }
  }, [emit, current?.videoId,current?.mediaType]);
  const react = useCallback((emoji: string) => emit(EVENTS.REACTION, { emoji }), [emit]);
  const onTyping = useCallback(() => signal("typing"), [signal]);
  const likeCurrent = useCallback(() => {
    if (current?.id) likeTrack(current.id);
  }, [current?.id, likeTrack]);

  const openSearch = useCallback(() => {
    // The persistent search field opens over the current view.
    setSearchSignal((n) => n + 1);
    signal("queueing");
  }, [signal]);

  /* ----------------------------------------------------------- shortcuts */

  useShortcuts({
    playpause: () => canControl && playPause(),
    next: () => canControl && skip(),
    prev: () => canControl && seekTo(Math.max(0, position - 10)),
    search: openSearch,
    queue: () => {
      setTab("queue");
      setCenter("queue");
    },
    history: () => {
      setTab("queue");
      setCenter("history");
    },
    chat: () => {
      setTab("chat");
      setPane("chat");
    },
    like: () => current?.id && likeTrack(current.id),
    mute: () => changeVolume(volume === 0 ? 1 : 0),
    help: () => setHelpOpen((v) => !v),
    close: () => setHelpOpen(false),
  });

  const viewHistory=useRef<Tab[]>(['now']),viewIndex=useRef(0),restoringView=useRef(false);
  const [navigationVersion,setNavigationVersion]=useState(0);
  useEffect(()=>{if(restoringView.current){restoringView.current=false;return;}if(viewHistory.current[viewIndex.current]===tab)return;viewHistory.current=viewHistory.current.slice(0,viewIndex.current+1);viewHistory.current.push(tab);if(viewHistory.current.length>30)viewHistory.current.shift();viewIndex.current=viewHistory.current.length-1;setNavigationVersion(v=>v+1);},[tab]);
  const navigateView=(direction:number)=>{if(playerExpanded){setPlayerExpanded(false);return;}if(libraryOpen){setLibraryOpen(false);return;}const next=viewIndex.current+direction;if(next<0||next>=viewHistory.current.length){if(direction<0)exit.request();return;}restoringView.current=true;viewIndex.current=next;setSceneOnly(false);setTab(viewHistory.current[next]);setNavigationVersion(v=>v+1);};
  const homeView=()=>{setToolsOpen(false);setSceneOnly(false);setPlayerExpanded(false);setLibraryOpen(false);setTab('now');setCenter('queue');};
  const swipe = useSwipe(
    useCallback((dir: 1 | -1) => {
      setTab((t) => {
        const order:Tab[]=['now','queue','chat'];const i=Math.max(0,order.indexOf(t));
        return order[Math.min(order.length-1,Math.max(0,i+dir))];
      });
    }, [])
  );

  /* -------------------------------------------------------------- derived */

  // Anything already in the room should never be offered back as a suggestion
  // or as an un-added search result.
  const roomIds = useMemo(() => {
    const ids = new Set(queue.map((t) => t.videoId));
    if (current) ids.add(current.videoId);
    return ids;
  }, [queue, current]);

  const statuses = useMemo(
    () => Object.fromEntries(participants.map((p) => [p.nick, p.status])),
    [participants]
  );

  const currentLikes = current?.likes ?? [];
  const youLikeCurrent = currentLikes.includes(nick.trim());

  if(roomEnded)return <main className="sw-couple mx-auto flex min-h-[100dvh] flex-col items-center justify-center px-6"><Panel className="max-w-md text-center"><h1 className="font-display text-2xl">Room ended</h1><p className="my-4 text-sm text-muted">{roomEnded}</p><a href="/">Return home</a></Panel></main>;
  if (kicked) {
    return (
      <main className="sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <Panel className="w-full max-w-md text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--destructive)] uppercase">
            Removed
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">
            You were removed from this room
          </h1>
          <p className="text-sm text-muted">
            The host removed you. You can try again later, or find another room.
          </p>
        </Panel>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <Panel className="w-full max-w-md text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--destructive)] uppercase">
            Not this time
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">
            The host didn&rsquo;t let you in
          </h1>
          <p className="text-sm text-muted">This room is invite only.</p>
        </Panel>
      </main>
    );
  }

  if (awaitingApproval) {
    return (
      <main className="sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <Panel className="w-full max-w-md text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--accent-2)] uppercase">
            Invite only
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">
            Waiting for the host
          </h1>
          <p className="text-sm text-muted">
            This room needs the host to let you in. Hang tight.
          </p>
        </Panel>
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <Panel className="w-full max-w-md text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--accent-2)] uppercase">
            SOMEWHERE ONLY WE KNOW
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Konnectivity</h1>
          <p className="mb-6 text-sm text-muted">One Beat. Two Hearts</p>

          {/* A first look at the avatar this name gets — the same one that will
              sit beside every track you queue and every line you type. */}
          <div className="mb-6 grid h-14 place-items-center">
            {nick.trim() ? (
              <Avatar name={nick.trim()} size="lg" className="sw-pop-in size-14 text-lg" />
            ) : (
              <span className="grid size-14 place-items-center rounded-full border border-dashed border-white/15 text-muted">
                <Users className="size-5" />
              </span>
            )}
          </div>

          <Input
            className="mb-3 text-center"
            placeholder="Choose a display name…"
            value={nick}
            maxLength={24}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
          />
          <Button variant="primary" className="w-full" onClick={doJoin} disabled={!nick.trim()}>
            {asHost ? "Start the room" : "Join"}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--destructive)]">
              {error}
            </p>
          )}
        </Panel>
      </main>
    );
  }

  const renderChatNotice=()=>unread>dismissedUnread&&latestChat?<ChatNotice count={unread} sender={latestChat.nick} preview={latestChat.text} onOpen={openChatNotice} onDismiss={()=>setDismissedUnread(unread)}/>:null;

  const renderPlayer = (expanded=false) => (
    <div className={videoActive&&videoControlsHidden?"kn-transport-hidden":"contents"}><BottomPlayer
        expanded={expanded}
        onToggleExpanded={()=>expanded?setPlayerExpanded(false):goHome()}
        current={current}
        isPlaying={isPlaying}
        position={position}
        duration={current?.duration ?? 0}
        isHost={canControl}
        downloadPct={curDl}
        buffering={buffering}
        preparing={preparing}
        shuffle={shuffle}
        repeat={repeat}
        skipVotes={skipVotes}
        needVotes={needVotes}
        volume={volume}
        likes={currentLikes.length}
        liked={youLikeCurrent}
        onLike={() => current?.id && likeTrack(current.id)}
        onVolume={changeVolume}
        onPlayPause={playPause}
        onSkip={skip}
        onSeek={seekTo}
        onVoteSkip={voteSkip}
        onShuffle={() => emit(EVENTS.CONTROL_SHUFFLE)}
        onRepeat={() => emit(EVENTS.CONTROL_REPEAT)}
        onReact={react}
        castSupported={casting.supported && (!videoActive || localVideo)}
        castConnected={casting.connected}
        onCast={casting.prompt}
      /></div>
  );

  return (
    <div className="sw-couple flex h-[var(--kn-app-height,100dvh)] flex-col overflow-hidden" data-room-background={appearance.background}>
      <Dialog open={playerExpanded} onOpenChange={setPlayerExpanded}>
        <DialogContent fullscreen {...playerSwipe} className="kn-expanded-player sw-couple" data-room-background={appearance.background} aria-describedby="expanded-player-description">
          <div className="kn-expanded-heading"><button type="button" onClick={()=>setPlayerExpanded(false)} aria-label="Collapse player to bottom bar"><ChevronDown size={24}/></button><div><DialogTitle>Now playing <RoomClock/></DialogTitle><DialogDescription id="expanded-player-description">Your shared soundtrack. Collapse to keep listening below.</DialogDescription></div></div>
          <button type="button" className="kn-artwork-toggle" aria-label={appearance.showArtwork?"Hide artwork":"Show artwork"} title={appearance.showArtwork?"Hide artwork":"Show artwork"} onClick={()=>appearance.update({showArtwork:!appearance.showArtwork})}>{appearance.showArtwork?<EyeOff size={15}/>:<Eye size={15}/>}</button>
          <button type="button" className="kn-artwork-toggle" title={sceneOnly?"Show song details":"Hide song details"} aria-label={sceneOnly?"Show song details":"Hide song details"} aria-pressed={sceneOnly} onClick={()=>setSceneOnly(v=>!v)}>{sceneOnly?<PanelsTopLeft size={17}/>:<PanelTopClose size={17}/>}</button>
          {renderChatNotice()}
          <div className="kn-expanded-scene">
            {!current&&lastVideo&&watchVideo&&<section className="kn-video-finished"><p>Video finished</p><h2>{lastVideo.title}</h2><button title="Replay video" aria-label="Replay video" onClick={()=>emit(EVENTS.CONTROL_PLAY_NOW,{track:lastVideo,preferVideo:true})}><RotateCcw size={24}/></button></section>}
        <RoomBackground videoId={current?.videoId} mediaQuery={mediaQuery} artwork={current?.art||current?.thumbnail}/>
            <RoomLights position={position} playing={isPlaying&&!syncHolding&&!preparing}/>{sceneOnly&&<AmbientVisualizer room playing={isPlaying&&!syncHolding&&!preparing}/>}
          <NowPlaying current={current} isPlaying={isPlaying} preparing={preparing} cachePct={curDl??0} buffering={buffering} participants={participants} position={position} likes={currentLikes} liked={youLikeCurrent} onLike={likeCurrent} canSeek={canControl&&!preparing&&(current?.duration??0)>0} onSeek={seekTo} className={cn("kn-expanded-artwork flex-1",sceneOnly&&"!hidden")}/>
          </div>
          {renderPlayer(true)}
        </DialogContent>
      </Dialog>
      {!playerExpanded&&renderChatNotice()}
      {/* ambient backdrop that glows with the current album art */}
      <div
        className={`sw-ambient ${current?.thumbnail ? "on" : ""}`}
        style={current?.thumbnail ? { backgroundImage: `url(${current.thumbnail})` } : undefined}
        aria-hidden
      />
      {/* Two elements so the one about to end can fade out while the next
          fades in — `activeSlot` says which one the sync loop, and its
          onEnded/onError, currently treats as authoritative. */}
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={activeSlot === "A" ? onEnded : undefined}
        onError={activeSlot === "A" ? onAudioError : undefined}
      />
      <audio
        ref={nextAudioRef}
        preload="auto"
        onEnded={activeSlot === "B" ? onEnded : undefined}
        onError={activeSlot === "B" ? onAudioError : undefined}
      />

      <Reactions incoming={lastReaction} />
      <PlayerMessageOverlay message={playerMessage} expanded={playerExpanded}/>
      <LibraryPanel open={libraryOpen} section={librarySection} onSection={setLibrarySection} onClose={() => setLibraryOpen(false)}
        code={code} uploadToken={uploadToken} playlists={playlists} library={library} seed={playlistSeed}
        tracks={[...(current ? [current] : []), ...queue]} onAdd={addTrack} onAddMany={addTracks} onPlayNow={playNow} onPlaylistAdd={addToPlaylist} emit={emit} />
      {notice && <div role="status" className="sw-save-notice">{notice}</div>}
      {helpOpen && <ShortcutsDialog open onOpenChange={setHelpOpen} isHost={canControl} />}
      {soundOpen && (
        <SoundSettings open onOpenChange={setSoundOpen} rtt={networkRtt} outputLatency={roomGain.outputLatency} waitingFor={waitingFor} />
      )}

      {/* The one thing a screen reader must not have to go looking for: what
          the room is playing. Polite, so it waits for a gap rather than
          interrupting, and keyed on the track so it fires once per change. */}
      <p aria-live="polite" className="sr-only">
        {current
          ? `Now playing: ${current.title} by ${current.artist}${
              current.addedBy ? `, added by ${current.addedBy}` : ""
            }`
          : "Nothing playing"}
      </p>

      {/* autoplay blocked (mobile) — a tap satisfies the gesture requirement */}
      {!videoActive && (needsGesture || roomGain.suspended) && current && !preparing && (
        <button
          onClick={resumeAudio}
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-max items-center gap-2 rounded-full bg-[image:var(--accent-gradient)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--glow-accent)] animate-pulse"
        >
          <Play className="size-4" /> Tap to start audio
        </button>
      )}

      {/* ── top bar: identity, mood, search, presence ── */}
      {/* z-50 so the search dropdown clears the bottom player (z-40) rather
          than sliding behind it on a short window. */}
      <Dialog open={exit.open} onOpenChange={open=>{if(!open)exit.cancel();}}><DialogContent><DialogTitle>Leave this party?</DialogTitle><DialogDescription>{isHost?'Leaving will end this room for everyone and clear its chat, playback, plans, and polls. This room’s invite URL will stop working. Uploaded media will remain in your library.':'Your call will end and you will disconnect from this room.'}</DialogDescription>{exit.error&&<p role="alert">{exit.error}</p>}<div className="flex justify-end gap-3"><Button disabled={exit.leaving} onClick={exit.cancel}>Stay</Button><Button variant="danger" disabled={exit.leaving} onClick={()=>void exit.confirm()}>{exit.leaving?'Leaving…':'Leave party'}</Button></div></DialogContent></Dialog>
      <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="kn-settings-dialog !max-w-xl"><DialogTitle>Settings</DialogTitle><DialogDescription>Shared appearance, device sound and keyboard shortcuts.</DialogDescription>        <div id="kn-room-tools" data-open={toolsOpen} className="kn-room-controls ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {/* Room code, spelled out for reading aloud across a room. */}
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 lg:flex">
            <span className="text-[10px] font-semibold tracking-eyebrow text-muted uppercase">
              Code
            </span>
            <span className="font-mono text-xs font-bold tracking-[0.18em] text-ink">{code}</span>
          </span>



          <RoomClock/>
          <AppearanceSettings onSaved={()=>{setToolsOpen(false);setNotice("Appearance saved for everyone.");}} onSave={patch=>new Promise((resolve,reject)=>{socketRef.current?.timeout(5000).emit(EVENTS.APPEARANCE_SET,patch,(err:any,result:any)=>err||result?.error?reject(Error(result?.error||"Could not save. Try again.")):resolve());})} playerMessageControls={done=><PlayerMessageComposer disabled={Boolean(participants.find(p=>p.id===you)?.muted)} onClear={()=>new Promise<void>((resolve,reject)=>socketRef.current?.timeout(5000).emit(EVENTS.PLAYER_MESSAGE,{clear:true},(err:any,r:any)=>err||r?.error?reject(Error(r?.error||"Message could not be saved.")):resolve()))} onSent={()=>{done();setToolsOpen(false);}} onSend={(text,emoji,duration,animation)=>new Promise<void>((resolve,reject)=>socketRef.current?.timeout(5000).emit(EVENTS.PLAYER_MESSAGE,{text,emoji,duration,animation},(err:any,r:any)=>err||r?.error?reject(Error(r?.error||"Message could not be saved.")):resolve()))}/>} persistentSpace={persistentSpace} canManagePersistentSpace={Boolean(isHost)} onPersistentSpaceChange={enabled=>emit(EVENTS.PERSONAL_SPACE_SET,{enabled},(result:any)=>setNotice(result?.error|| (enabled?"Appearance and settings will be reused in new rooms.":"Appearance and settings stay room-local.")))} onUploadImage={uploadChatImage} mediaQuery={mediaQuery} artwork={current?.videoId&&!current.videoId.startsWith("local_")?`/api/artwork?videoId=${encodeURIComponent(current.videoId)}`:current?.art||current?.thumbnail} />
          <Button
            className="hidden sm:inline-flex"
            variant="ghost"
            size="icon"
            onClick={() => setSoundOpen(true)}
            aria-label="Sound settings"
            title="Automatic synchronization"
          >
            <SlidersHorizontal className="size-4" /><span>Sound</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="hidden lg:inline-flex"
          >
            <Keyboard className="size-4" /><span>Keyboard shortcuts</span>
          </Button>

          {/* The banner below says the same thing with room to explain why, so
              only one of the two is ever on screen: banner on phones, where
              installing actually matters, this button on desktop. */}
          <span className="hidden md:inline-flex">
            <InstallButton />
          </span>
          <button className="kn-small-control kn-icon-action" aria-label={soundsOn?"Mute notifications":"Unmute notifications"} title={soundsOn?"Mute notifications":"Unmute notifications"} aria-pressed={soundsOn} onClick={()=>{unlockSounds();setSoundEnabled(!soundsOn);setSoundsOn(!soundsOn);}}>{soundsOn?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{soundsOn?"Notification sounds on":"Notification sounds off"}</span></button>

        </div><button className="kn-settings-call" onClick={()=>{setToolsOpen(false);openActivities("call");}}><Phone size={17}/>Plans, polls &amp; encrypted calls</button></DialogContent></Dialog>
      <header className="kn-room-header sw-safe-t sw-safe-x z-50 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/8 px-4 py-3 backdrop-blur-xl">
        <nav className="kn-page-navigation" aria-label="Page navigation"><button aria-label="Back" title="Back" onClick={()=>navigateView(-1)}><ArrowLeft size={18}/></button><button aria-label="Home" title="Home" onClick={homeView}><Home size={18}/></button><button className="kn-forward-control" aria-label="Forward" title="Forward" disabled={viewIndex.current>=viewHistory.current.length-1} onClick={()=>navigateView(1)}><ArrowRight size={18}/></button></nav>
        <button type="button" onClick={()=>{setSceneOnly(false);goHome();}} aria-label="Konnectivity — open player" aria-haspopup="dialog" aria-expanded={playerExpanded} className="kn-brand-button flex min-w-0 flex-1 items-center gap-3 text-left md:flex-initial">
          {/* Same mark as the landing page and the favicon, tinted by the
              artwork like everything else in the room. */}
          <Logo size="md" tint="art" animated={isPlaying} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-display text-base font-bold leading-tight text-ink sm:text-lg">
                Konnectivity
              </h1>

            </div>
            <div className="kn-brand-tagline truncate text-[10px] font-semibold tracking-eyebrow text-[var(--accent-2)]">
              One Beat. Two Hearts
            </div>
          </div>
          <ChevronUp size={16} className="shrink-0 text-muted" aria-hidden="true"/>
        </button>

        {/* Search floats over the layout rather than taking a column from it —
            it is used in bursts, and the queue deserves the space the rest of
            the time. */}
        <button className="kn-tools-toggle" aria-label="Settings" title="Settings — appearance, notifications and room controls" aria-haspopup="dialog" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(true)}><Settings size={19}/><span>Settings</span>{pendingRequests.length>0&&<b>{pendingRequests.length}</b>}</button>



        <div className="kn-header-social"><RoomNotifications socket={socketRef.current} onOpen={openActivities}/><div className="kn-people-controls"><RoomPeople list={participants} you={you} isHost={Boolean(isHost)} pending={pendingRequests} inviteOnly={inviteOnly}
            onApprovalChange={enabled=>socketRef.current?.emit(EVENTS.HOST_APPROVAL_SET,{enabled})}
            onApprove={approveJoin} onDeny={denyJoin} onKick={kickParticipant} onMute={muteParticipant}/></div><ShareButton code={code}/></div><div className="kn-header-call"><RoomTogether openRequest={activityRequest} socket={socketRef.current} muted={Boolean(participants.find(p=>p.id===you)?.muted)}/></div><button className="kn-exit-icon" aria-label="Leave party" title="Leave party" onClick={exit.request}><LogOut size={18}/></button>
      </header>

      <nav className="sw-love-toolbar" aria-label="Room music">
                <SearchPanel
          library={library} playlists={playlists} onPlaylistAdd={addToPlaylist} onCreatePlaylist={createPlaylistFor}
                onPlayNow={playFromSearch}
          onAdd={queueFromSearch}
          onAddMany={addTracks}
          queuedIds={roomIds}
          variant="overlay"
          shortcut
          openSignal={searchSignal}
          className="kn-toolbar-search"
        />
        <button onClick={() => openLibrary("songs")}><Music2 size={15} />Library <span className="sw-library-count">{library.length}</span></button>
        <button onClick={() => openLibrary("playlists")}><ListMusic size={15} />Playlists</button>
        <button className="kn-plan-shortcut" aria-label="Room plans" title="Room plans" onClick={()=>openActivities("plans")}><CalendarDays size={16}/><span>Plans</span></button><button className="kn-poll-shortcut" aria-label="Room polls" title="Room polls" onClick={()=>openActivities("polls")}><BarChart3 size={16}/><span>Polls</span></button><button onClick={() => openLibrary("upload")}><Upload size={15} />Upload</button>

        <button title={watchVideo?"Switch to Audio":"Switch to Video"} aria-label={watchVideo?"Switch to Audio":"Switch to Video"} aria-pressed={watchVideo} onClick={() => setVideoMode(!watchVideo)}><Video size={17}/><span className="sr-only">{watchVideo?"Switch to Audio":"Switch to Video"}</span></button>
      </nav>
      {playbackError&&<div className="kn-playback-error" role="alert"><div><strong>Playback paused</strong><span>{playbackError}</span></div><Button onClick={()=>emit(EVENTS.CONTROL_RETRY)}>Retry track</Button><Button variant="ghost" onClick={()=>emit(EVENTS.CONTROL_SKIP)}>Skip track</Button></div>}
      {uploadedBuffer.loading&&current?.videoId.startsWith('local_')&&<div className="kn-upload-buffer" role="status"><span>Buffering uploaded audio on this device · {uploadedBuffer.percent}%</span><progress max="100" value={uploadedBuffer.percent}/>{uploadedBuffer.error&&<><span>{uploadedBuffer.error}</span><button onClick={uploadedBuffer.retry}>Retry download</button></>}</div>}
      {casting.error&&<p className="kn-cast-notice" role="status">{casting.error}</p>}
      {syncHolding && <div className="sw-sync-message" role="status">♡ Keeping you together{waitingFor.length ? ` — waiting for ${waitingFor.join(" & ")}` : ""}. Playback resumes automatically.</div>}
      {/* ── body ── */}
      <main ref={mainRef} className={cn("relative flex min-h-0 flex-1 flex-col", videoActive && "sw-watching", reactionDockOpen && "sw-reactions-open")} data-view={tab} {...swipe}>
        {videoActive && current && <div className="sw-video-stage">
          <VideoStage transport={renderPlayer()} hidden={videoControlsHidden} onToggle={()=>setVideoControlsHidden(v=>!v)} onReplay={()=>{emit(EVENTS.CONTROL_SEEK,{position:0});emit(EVENTS.CONTROL_PLAY_STATE,{playing:true});}}><>{localVideo?<UploadedVideo src={uploadedBuffer.url||`/audio/${current.videoId}${mediaQuery}`} title={current.title} volume={volume} syncKey={syncKey} getPosition={getMediaPosition} getRunning={getMediaRunning} onReadyChange={reportReady} onEnded={onEnded} onElement={setLocalVideo}/>:<YouTubePlayer videoId={current.videoId} position={position} playing={isPlaying && !preparing && !syncHolding && serverNow() >= resumeAt} desiredPlaying={isPlaying} holding={syncHolding} volume={volume} title={current.title}
            onPlaying={(playing) => emit(EVENTS.CONTROL_PLAY_STATE, { playing })} onEnded={onEnded}
            onMetadata={(duration, title) => emit(EVENTS.CONTROL_VIDEO_METADATA, { videoId: current.videoId, duration, title })}
            getPosition={getMediaPosition} getRunning={getMediaRunning} syncKey={syncKey} onReadyChange={reportReady} />}</></VideoStage>
        </div>}
        {!current&&lastVideo&&watchVideo&&<section className="kn-video-finished"><p>Video finished</p><h2>{lastVideo.title}</h2><button title="Replay video" aria-label="Replay video" onClick={()=>emit(EVENTS.CONTROL_PLAY_NOW,{track:lastVideo,preferVideo:true})}><RotateCcw size={24}/></button></section>}
        <RoomBackground videoId={current?.videoId} mediaQuery={mediaQuery} artwork={current?.art || current?.thumbnail} />
        <RoomLights position={position} playing={isPlaying&&!syncHolding&&!preparing}/>{sceneOnly&&<AmbientVisualizer room playing={isPlaying&&!syncHolding&&!preparing}/>}
        <div className="sw-love-stars" aria-hidden><i>♡</i><i>✦</i><i>♡</i><i>✧</i><i>♡</i></div>
        {/* The bottom padding on phones is the reaction pill's safe area: it
            floats over this region, and without the gap it sits on top of
            whatever the panel ends with. */}
        <div className={cn(sceneOnly&&"!hidden","mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 pb-8 pt-4 md:grid md:h-full md:grid-cols-[minmax(0,1fr)_360px] md:pb-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]")}>
          {/* ── column 1: the hero ── */}
          <NowPlaying
            comments={<SongComments socket={socketRef.current} track={current}/>}
            current={current}
            isPlaying={isPlaying}
            preparing={preparing}
            cachePct={curDl ?? 0}
            buffering={buffering}
            participants={participants}
            position={position}
            likes={currentLikes}
            liked={youLikeCurrent}
            onLike={likeCurrent}
            canSeek={canControl && !preparing && (current?.duration ?? 0) > 0}
            onSeek={seekTo}
            className={cn(
              tab === "now" ? "flex flex-1" : "hidden",
              "md:hidden xl:flex xl:h-full xl:flex-initial",
              videoActive && "!hidden"
            )}
          />

          {/* ── column 2: what the room is about to hear, and what it has ── */}
          <div
            className={cn(
              "min-h-0 flex-1 flex-col gap-4",
              tab === "queue" || tab === "search" ? "flex" : "hidden",
              "md:flex md:h-full md:flex-initial"
            )}
          >

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "md:flex",
                // An empty queue has nothing to scroll, so it gives its height
                // to the suggestions underneath rather than sitting on it.
                center !== "queue" || queue.length > 0 ? "min-h-0 flex-1" : "shrink-0"
              )}
            >
              <CenterTabs
                view={center}
                setView={setCenter}
                queueCount={queue.length}
                historyCount={history.length}
              />

              {center === "queue" && (
                <QueuePanel
                  queue={queue}
                  dl={dl}
                  isHost={canControl}
                  playlists={playlists} onPlaylistAdd={addToPlaylist} onCreatePlaylist={createPlaylistFor}
                  onPlayNow={playQueueNow}
                  you={nick.trim()}
                  onRemove={removeTrack}
                  onLike={likeTrack}
                  onVote={voteTrack}
                  onReorder={reorderTrack}
                  onOpenSearch={openSearch}
                  className="min-h-0 flex-1"
                />
              )}
              {center === "history" && (
                <HistoryPanel history={history} onReAdd={addTrack} className="min-h-0 flex-1" />
              )}
              {center === "stats" && <StatsPanel stats={stats} className="min-h-0 flex-1" />}
            </Panel>

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "md:flex",
                center !== "queue" || queue.length > 0
                  ? "max-h-[42%] shrink-0"
                  : "min-h-0 flex-1"
              )}
            >
              <Recommendations
                seed={current}
                mood={mood}
                excludeIds={roomIds}
                onAdd={addTrack}
                className="min-h-0 flex-1"
              />
            </Panel>
          </div>

          {/* ── column 3: the people ── */}
          <Panel
            className={cn(tab === "chat" ? "flex flex-1" : "hidden", "min-h-0 overflow-hidden md:flex md:h-full md:gap-4")}
          >
            {/* Two surfaces, one column. Desktop stacks them; a phone hasn't the
                height for that, so they take turns. */}
            <div className="mb-4 shrink-0 md:hidden">
              <div className="sw-seg">
                <button
                  className="sw-seg-item"
                  data-active={pane === "chat"}
                  onClick={() => setPane("chat")}
                >
                  <MessageSquare className="size-4" /> Chat
                  {unread > 0 && pane !== "chat" && (
                    <span className="grid min-w-4 place-items-center rounded-full bg-[image:var(--accent-gradient)] px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </button>
                <button
                  className="sw-seg-item"
                  data-active={pane === "activity"}
                  onClick={() => setPane("activity")}
                >
                  <ActivityIcon className="size-4" /> Activity
                </button>
              </div>
            </div>

            {/* The pane switch is scoped to `max-md` on purpose. Unscoped, the
                `flex-1` that makes the chosen pane fill a phone also applies at
                md, where both panes are on screen at once — and the two of them
                then share the column equally instead of 38/62. */}
            <ActivityFeed
              events={chat}
              reactions={reactionLog}
              className={cn(
                pane === "activity" ? "max-md:flex max-md:flex-1" : "max-md:hidden",
                "md:flex md:min-h-0 md:max-h-[35%] md:flex-none md:border-b md:border-white/8 md:pb-4"
              )}
            />
            <ChatPanel
              chat={chat}
              you={nick.trim()}
              aiDj={aiDj}
              djTyping={djTyping}
              onSend={sendChat}
              onUploadImage={uploadChatImage}
              onUploadVideo={uploadChatVideo}
              mediaQuery={mediaQuery}
              onExpandedChange={setChatExpanded}
              onTyping={onTyping}
              statuses={statuses}
              muted={participants.find((p) => p.id === you)?.muted}
              className={cn(
                pane === "chat" ? "max-md:flex max-md:flex-1" : "max-md:hidden",
                "md:flex md:min-h-0 md:flex-1"
              )}
            />
          </Panel>
        </div>

        <div className={cn("px-4 pb-2 md:hidden",sceneOnly&&"hidden")}>
          <InstallBanner code={code} />
        </div>
      </main>

      <div className="kn-scene-controls"><button type="button" aria-label={sceneOnly?"Show panels":"Hide panels · show background"} title={sceneOnly?"Show panels":"Hide panels · show background"} aria-pressed={sceneOnly} onClick={()=>setSceneOnly(value=>!value)}>{sceneOnly?<PanelsTopLeft size={17}/>:<PanelTopClose size={17}/>}</button>{sceneOnly&&<span>{current?.title||"Your shared soundtrack"}</span>}</div>

      {/* ── phone chrome: reactions and tabs, both within thumb reach ──
          The tab bar used to sit at the top of the content, which on a 6"
          phone is the one part of the screen a thumb cannot get to without
          the hand moving. Everything you press often now lives in the same
          band above the player. */}
      {/* Floating reactions. Deliberately not inside the tab-bar container it
          used to live in: that container is phone-only, so between md and lg
          — tablets, and any window narrower than a laptop — the room had no
          way to react at all, the player's own bar not starting until lg.
          Zero-height and absolutely positioned so it overlays whatever is
          above it rather than taking a row of the height a phone hasn't got. */}
      <aside ref={reactionDockRef} className="sw-reaction-dock lg:hidden" aria-label="Room reactions">
        {reactionDockOpen && <ReactionBar onReact={(emoji) => { react(emoji); setReactionDockOpen(false); }} className="sw-side-reactions" />}
        <button className="sw-reaction-dock-toggle" aria-label="Reactions" aria-expanded={reactionDockOpen} onClick={() => setReactionDockOpen(v => !v)}><Smile size={18}/></button>
      </aside>

      <div className="sw-safe-x relative z-40 shrink-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-2 backdrop-blur-xl md:hidden">
        <TabBar tab={toolsOpen?"settings":tab} setTab={(value) => value === "settings" ? setToolsOpen(true) : value === "search" ? openSearch() : (setSceneOnly(false),setTab(value))} queueCount={queue.length} unread={unread} />
      </div>

      {/* ── fixed bottom player ── */}
      {renderPlayer()}
    </div>
  );
}

/** Placeholder for a split-out panel, in the shape of the panel it replaces. */
function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" aria-busy>
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2" aria-hidden>
          <Skeleton className="size-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-[55%] rounded-full" />
            <Skeleton className="h-2.5 w-[35%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Segmented control for the centre column: what's next, what happened, totals. */
function CenterTabs({
  view,
  setView,
  queueCount,
  historyCount,
}: {
  view: CenterView;
  setView: (v: CenterView) => void;
  queueCount: number;
  historyCount: number;
}) {
  const item = (id: CenterView, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      key={id}
      role="tab"
      aria-selected={view === id}
      data-active={view === id}
      className="sw-seg-item"
      onClick={() => setView(id)}
    >
      {icon}
      <span className="max-sm:sr-only">{label}</span>
      {badge ? <span className="tabular-nums text-muted">{badge}</span> : null}
    </button>
  );
  return (
    <div className="sw-seg mb-4 shrink-0" role="tablist" aria-label="Queue, history or session">
      {item("queue", <ListMusic className="size-4" />, "Up next", queueCount)}
      {item("history", <HistoryIcon className="size-4" />, "History", historyCount)}
      {item("stats", <BarChart3 className="size-4" />, "Session")}
    </div>
  );
}

// Segmented tab control (mobile).
function TabBar({
  tab,
  setTab,
  queueCount,
  unread,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  queueCount: number;
  unread: number;
}) {
  const item = (id: Tab, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      role="tab"
      aria-selected={tab === id}
      aria-current={tab === id}
      data-active={tab === id}
      className="sw-seg-item"
    >
      {icon}
      {label}
      {badge ? (
        <span
          className="grid min-w-4 place-items-center rounded-full bg-[image:var(--accent-gradient)] px-1 text-[10px] font-bold text-white"
          aria-label={`${badge} ${id === "chat" ? "unread" : "queued"}`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="sw-seg" role="tablist" aria-label="Room sections">
      {item("now", <Radio className="size-4" />, "Now")}
      {item("queue", <ListMusic className="size-4" />, "Queue", queueCount)}
      {item("search", <SearchIcon className="size-4" />, "Add")}
      {item("chat", <MessageSquare className="size-4" />, "Chat", unread)}
      {item("settings", <Settings className="size-4" />, "Settings")}
    </div>
  );
}

/**
 * Who's waiting to get in. Host-only, and only rendered at all when someone
 * actually is — an invite-only room with nobody waiting shouldn't carry a
 * permanent empty button in the header.
 */
