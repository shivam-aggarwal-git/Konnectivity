"use client";

import FeedbackToast from "./FeedbackToast";
import RoomCookies from "./RoomCookies";
import Lyrics from "./Lyrics";
import RoomGuide from "./RoomGuide";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./ui/dialog";
import RoomPeople, {type PeopleShortcut} from "./RoomPeople";
import type { PlaybackSample } from "./YouTubePlayer";
import {useAppViewport} from "@/hooks/useAppViewport";
import ChatNotice from "./ChatNotice";
import RoomClock from "./RoomClock";
import {usePlayerSwipe} from "@/hooks/usePlayerSwipe";
import RoomBackground from "./RoomBackground";
import AmbientVisualizer from "./AmbientVisualizer";
import RoomLights from "./RoomLights";
import AppearanceSettings from "./AppearanceSettings";
import AdminRoomSettings from "./AdminRoomSettings";
import PermissionManager from "./PermissionManager";
import {useAppearance,receiveRoomAppearance} from "@/hooks/useAppearance";
import { io, type Socket } from "socket.io-client";
import {
  Check, ArrowLeft, ArrowRight, MoreHorizontal, Scan, Minimize2, Menu, Volume2, VolumeX, PanelsTopLeft, PanelTopClose, Settings, LogOut,
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
import { usePausedAudioDownload } from "@/hooks/usePausedAudioDownload";
import { hasStartupBuffer, readBuffered, type BufferedRange } from "@/lib/media-buffer";
import { useRoomAudioSession } from "@/hooks/useRoomGain";
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
import {CalendarDays, Pencil, Sparkles, UserRound, Zap} from "lucide-react";
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
import type { RoomPhoto } from "@/lib/types";
import { ROOM_PHOTO_LIMIT } from "@/lib/protocol.mjs";
import ChatPanel from "@/components/ChatPanel";
import {useRoomExit} from '@/hooks/useRoomExit';
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

type Tab = "now" | "queue" | "search" | "chat" | "activities" | "settings" | "playlists";
const TAB_ORDER: Tab[] = ["now", "queue", "search", "chat", "activities"];
/** The centre column carries three lists; they share one segmented control. */
type CenterView = "queue" | "history" | "stats";
/** The right column carries two surfaces; on a phone they take turns. */
type SidePane = "chat" | "activity" | "people";

export default function Room({ code, asHost, requestingJoin }: { code: string; asHost: boolean; requestingJoin: boolean }) {
  const [nick, setNick] = useState("");
  const [messageComposerOpen,setMessageComposerOpen]=useState(false);
  const [lyricsOpen,setLyricsOpen]=useState(false);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  useEffect(()=>{if(!profileMenuOpen)return;const outside=(e:PointerEvent)=>{if(!(e.target as Element)?.closest?.('.room-profile-anchor'))setProfileMenuOpen(false);};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setProfileMenuOpen(false);};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',esc);};},[profileMenuOpen]);
  const [adminSettingsMode,setAdminSettingsMode]=useState(false);
  const [settingsSection,setSettingsSection]=useState("overview");
  const [roomAvatar,setRoomAvatar]=useState<string|null>(null),[groupAvatarDraft,setGroupAvatarDraft]=useState<string|null>(null),[groupNameDraft,setGroupNameDraft]=useState("");
  const [activitiesTarget,setActivitiesTarget]=useState<HTMLDivElement|null>(null);
  const currentNick = useRef("");
  currentNick.current = nick;
  const [flushOnHostLeave,setFlushOnHostLeave]=useState(false),[roomEnded,setRoomEnded]=useState(""),[playerMessage,setPlayerMessage]=useState<PlayerMessage|null>(null),[soundsOn,setSoundsOn]=useState(true);
  const [permissions,setPermissions]=useState<Record<string,boolean>>({});
  const syncPolicy=useRef(true);
  const detachedHostDevice = useRef(false);
  const [hostDeviceDetached, setHostDeviceDetached] = useState(false);
  const syncPermission=useRef(true);
  const ownHostRole=useRef(false);
  const hostSocketRef=useRef<string|undefined>(undefined);
  const [joined, setJoined] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [denied, setDenied] = useState(false);
  // Host-only: who's waiting to be let into an invite-only room.
  useAppViewport();
  const [roomScoped, setRoomScoped] = useState(false);
  const [persistentSpace,setPersistentSpace]=useState(false);
  const [sceneOnly,setSceneOnly]=useState(false);
  const [inviteOnly,setInviteOnly]=useState(true);
  const [discoverable, setDiscoverable] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [peopleShortcut,setPeopleShortcut]=useState<{action:PeopleShortcut;id:number}>();
  const openPeople=(action:PeopleShortcut)=>setPeopleShortcut(previous=>({action,id:(previous?.id||0)+1}));
  const [roomName, setRoomName] = useState(`Room ${code}`);
  const [aiDj, setAiDj] = useState<string | null>(null);

  const [you, setYou] = useState<string | null>(null);
  const [isRoomOwner,setIsRoomOwner]=useState(false);
  const [nextHostId,setNextHostId]=useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  // The DJ has no socket of its own, so the server reports this on its behalf.
  const [djTyping, setDjTyping] = useState(false);
  const [reactionLog, setReactionLog] = useState<ReactionEvent[]>([]);
  const [lastReaction, setLastReaction] = useState<IncomingReaction | null>(null);
  const [skipVotes, setSkipVotes] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [deviceBuffer, setDeviceBuffer] = useState<BufferedRange[]>([]);
  const updateDeviceBuffer = useCallback((ranges: BufferedRange[]) => {
    setDeviceBuffer(previous => previous.length === ranges.length &&
      previous.every(([start, end], index) => start === ranges[index][0] && end === ranges[index][1]) ? previous : ranges);
  }, []);
  const audioPrimed = useRef(false);
  const bufferAnchor = useRef<number | null>(null);
  const bufferPlaybackStart = useRef<number | undefined>(undefined);
  const [preparing, setPreparing] = useState(false);
  const [playbackRequester, setPlaybackRequester] = useState<string | null>(null);
  const [showPlaybackWait, setShowPlaybackWait] = useState(false);
  const dismissedPlaybackWait = useRef<string | null>(null);
  const audioActivated = useRef(false);
  const [audioSetupDone, setAudioSetupDone] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [dl, setDl] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>("now");
  const [roomActionsOpen, setRoomActionsOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(true);
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
  const [receipts, setReceipts] = useState<Record<string, string[]>>({});
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
  function openSongComments(){
    if(!current){setNotice("Play a song to comment.");return;}
    setLyricsOpen(false);setSceneOnly(false);setTab("now");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{window.dispatchEvent(new Event('konnectivity:show-comments'));const fields=Array.from(document.querySelectorAll<HTMLTextAreaElement>('.kn-song-comments-inline textarea'));fields.find(field=>field.getBoundingClientRect().height>0)?.focus();}));
  }
  const openChatNotice=useCallback(()=>{setPlayerExpanded(false);setSceneOnly(false);setCompanionOpen(true);setTab('chat');setPane('chat');setUnread(0);setDismissedUnread(0);window.dispatchEvent(new Event('konnectivity:open-chat'));},[]);

  const [toolsOpen,setToolsOpen]=useState(false),[playbackError,setPlaybackError]=useState<string|null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);
  const [library, setLibrary] = useState<Track[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LibrarySection>("songs");
  const [playlistSeed, setPlaylistSeed] = useState<Track | undefined>();
  const [notice, setNotice] = useState("");
  const playbackWaiting = preparing || (buffering && !needsGesture);
  useEffect(() => {
    setShowPlaybackWait(false);
    if (!playbackWaiting) { dismissedPlaybackWait.current = null; return; }
    if (!current?.videoId || dismissedPlaybackWait.current === current.videoId) return;
    const timer = setTimeout(() => setShowPlaybackWait(true), 750);
    return () => clearTimeout(timer);
  }, [playbackWaiting, current?.videoId]);
  const openLibrary = useCallback((section: LibrarySection, seed?: Track) => { setLibrarySection(section); setPlaylistSeed(seed); setLibraryOpen(true); }, []);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [uploadToken, setUploadToken] = useState("");
  const canControl = joined;
  // The server owns the room volume, including reconnect snapshots.
  const [volume, setVolume] = useState(1);
  const [videoLink, setVideoLink] = useState("");
  const [activityRequest,setActivityRequest]=useState<{view:'plans'|'polls'|'call';id:number}>({view:'plans',id:0});
  const openActivities=(view:'plans'|'polls'|'call')=>{if(view!=='call'){setSceneOnly(false);setTab('activities');}setActivityRequest(previous=>({view,id:previous.id+1}));};
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
  const youtubePlaybackSampler = useRef<(() => PlaybackSample) | null>(null);
  const setYouTubePlaybackSampler = useCallback((sample: (() => PlaybackSample) | null) => { youtubePlaybackSampler.current = sample; }, []);
  const localVideoRef=useRef<HTMLVideoElement|null>(null);
  const setLocalVideo=useCallback((element:HTMLVideoElement|null)=>{localVideoRef.current=element;},[]);
  useEffect(()=>{setVideoControlsHidden(false);if(current&&(videoActive||current.mediaType==="video"))setLastVideo(current);},[current?.videoId,videoActive]);
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
  const [recordingVoice, setRecordingVoice] = useState(false);
  const deviceVolume = recordingVoice ? volume * 0.18 : volume;
  const nativeVolumeOnly = useRoomAudioSession(joined);
  const volumeRef = useRef(1);
  const CROSSFADE_SECONDS = 5;
  const CROSSFADE_MIN_DURATION = 10;

  // Fine sync. Below the tolerance, drift is left alone (the clock estimate
  // itself is only good to a few tens of ms); above it, playback speed is
  // nudged by at most MAX_NUDGE until it closes.
  const resyncRef = useRef(false);
  useEffect(()=>{resyncRef.current=true;},[syncKey]);
  const [soundOpen, setSoundOpen] = useState(false);

  const casting = useCasting(
    useCallback(
      () => videoActive ? localVideoRef.current : (activeSlot === "A" ? audioRef.current : nextAudioRef.current),
      [activeSlot,videoActive]
    ),current?`/audio/${current.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`:undefined
  );

  const ownParticipant = participants.find((participant) => participant.id === you);
  const isHost = ownParticipant?.isHost === true;
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

  const exit=useRoomExit(joined&&!kicked&&!roomEnded,(successor)=>new Promise<void>((resolve,reject)=>{
    const s=socketRef.current;if(!s?.connected){if(successor)reject(Error("Reconnect before handing off the party."));else resolve();return;}s.timeout(5000).emit(EVENTS.ROOM_LEAVE,successor?{nextHostId:successor}:{},(err:Error|null,result:any)=>{if(err||result?.error)reject(Error(result?.error||'Could not leave the room. Please try again.'));else{audioRef.current?.pause();nextAudioRef.current?.pause();resolve();}});
  }));
  useEffect(()=>{if(!exit.open)setNextHostId("");},[exit.open]);
  useEffect(() => {
    if(!joined)return;
    let pending:Record<string,unknown>={},timer:ReturnType<typeof setTimeout>|undefined;
    const change=(event:Event)=>{Object.assign(pending,(event as CustomEvent).detail);if(!timer)timer=setTimeout(()=>{emit(EVENTS.APPEARANCE_SET,pending);pending={};timer=undefined;},200);};
    window.addEventListener("konnectivity:appearance-request",change);
    return()=>{window.removeEventListener("konnectivity:appearance-request",change);if(timer)clearTimeout(timer);};
  },[joined,emit]);

  useEffect(() => {
    if (!joined || roomEnded) return;
    let previousPosition: number | undefined;
    let lastAdvance = performance.now();
    const report = () => {
      if (!socketRef.current?.connected || detachedHostDevice.current) return;
      const el = videoActive ? localVideoRef.current : activeSlot === "A" ? audioRef.current : nextAudioRef.current;
      const sample: PlaybackSample = casting.connected ? { state: "casting", position: 0 } :
        videoActive && !localVideo ? youtubePlaybackSampler.current?.() ?? { state: "checking", position: 0 } :
        { position: el?.currentTime ?? 0, state: el?.error ? "error" :
          !videoActive && needsGesture ?
            (audioActivated.current || document.visibilityState !== "visible" ? "interrupted" : "blocked") :
          !el || el.readyState < 3 || el.seeking || (!videoActive && buffering) ||
          (videoActive && el.paused && playbackRef.current.isPlaying && !el.ended) ? "buffering" :
          el.paused || el.ended ? "stopped" : "playing" };
      const now = performance.now();
      if (sample.state === "playing") {
        if (previousPosition !== undefined && sample.position > previousPosition) lastAdvance = now;
        if (previousPosition === undefined) sample.state = "checking";
        else if (now - lastAdvance > 2500) sample.state = "buffering";
      } else {
        lastAdvance = now;
      }
      previousPosition = sample.position;
      emit(EVENTS.PLAYBACK_DEVICE_REPORT, { key: syncKey, audioEnabled: audioSetupDone, ...sample });
    };
    const timer = setInterval(report, 1500);
    report();
    return () => clearInterval(timer);
  }, [joined, roomEnded, syncKey, audioSetupDone, videoActive, localVideo, activeSlot, casting.connected, needsGesture, buffering, emit]);

  const reportSearchActivity = useCallback(() => emit(EVENTS.SEARCH_ACTIVITY), [emit]);

  const readinessRef = useRef({ key: "", badSince: 0, foregroundAt: 0 });
  const reportReady = useCallback((ready: boolean, key: string, blocked=false) => {
    if (!key || !socketRef.current?.connected || detachedHostDevice.current) return;
    if(blocked){emit(EVENTS.SYNC_MEDIA,{key,ready:false,blocked:true});return;}
    const now = performance.now(), background = document.visibilityState !== "visible";
    const state = readinessRef.current;
    if (state.key !== key) { state.key = key; state.badSince = 0; state.foregroundAt = now; }
    ready = ready && clockRef.current.calibrated();
    if (ready || background) state.badSince = 0;
    else {
      if (!state.badSince) state.badSince = now;
      // Seeking and OS gestures are transient, not a reason to stop everyone.
      if (now - state.badSince < 1500 || now - state.foregroundAt < 2500) return;
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
      if(socketRef.current?.connected && !detachedHostDevice.current)emit(EVENTS.SYNC_MEDIA, { key: syncKey, ready: false, background: document.visibilityState !== "visible" });
    };
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("pagehide", changed);
    return () => { document.removeEventListener("visibilitychange", changed); window.removeEventListener("pagehide", changed); };
  }, [joined, syncKey, emit]);
  const getMediaRunning = useCallback(() => playbackRunning(playbackRef.current, clockRef.current.now()), []);
  const getMediaPosition = useCallback(() => syncPolicy.current?playbackPosition(playbackRef.current, clockRef.current.now()):(localVideoRef.current?.currentTime??audioRef.current?.currentTime??0), []);
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
    if (el) el.volume = Math.min(1, deviceVolume * (current?.gain ?? 1));
  }, [deviceVolume, current?.videoId, current?.gain, activeSlot]);

  // Read via refs inside the tick loop below, so adjusting the volume slider
  // or the queue doesn't restart the audio-sync effect (and with it, the
  // src-reload check) on every keystroke-equivalent update.
  useEffect(() => {
    volumeRef.current = deviceVolume;
  }, [deviceVolume]);
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
    if (!detachedHostDevice.current) emit(EVENTS.CONTROL_VOLUME, { volume: v });
  }, [emit]);

  const playbackTrack=useRef<string|null>(null);
  const latestRoomPlayback = useRef<any>(null);
  function applyPlayback(s: any, force = false) {
    latestRoomPlayback.current = s;
    if (detachedHostDevice.current) return;
    if(!force&&!syncPolicy.current&&s.current?.videoId===playbackTrack.current&&s.current)return;
    playbackTrack.current=s.current?.videoId||null;
    if(!syncPolicy.current)s={...s,syncHolding:false,resumeAt:0};
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
    setPlaybackRequester(s.playbackRequester || null);
    setPlaybackError(s.playbackError||null);
    setShuffle(Boolean(s.shuffle));
    if (s.repeat) setRepeat(s.repeat);
    setSkipVotes(s.skipVotes ?? 0);
    clockRef.current.seed(s.serverNow);
  }

  function followRoomPlayback() {
    detachedHostDevice.current = false;
    setHostDeviceDetached(false);
    resyncRef.current = true;
    bufferAnchor.current = null;
    audioPrimed.current = false;
    if (latestRoomPlayback.current) applyPlayback(latestRoomPlayback.current, true);
  }

  function setLocalPlayback(position: number, playing: boolean) {
    playbackRef.current = {
      startedAt: clockRef.current.now() - position * 1000,
      pausedPosition: position,
      isPlaying: playing,
      syncHolding: false,
      resumeAt: 0,
    };
    setPosition(position);
    setIsPlaying(playing);
  }

  function toggleHostDeviceSync(enabled: boolean) {
    if (!socketRef.current?.id || socketRef.current.id !== hostSocketRef.current) return;
    if (enabled) {
      followRoomPlayback();
      return;
    }
    const localPosition = playbackPosition(playbackRef.current, clockRef.current.now());
    detachedHostDevice.current = true;
    setHostDeviceDetached(true);
    setLocalPlayback(localPosition, false);
    setSyncHolding(false);
    setWaitingFor([]);
    setResumeAt(0);
    setPreparing(false);
    setPlaybackError(null);
    audioRef.current?.pause();
    nextAudioRef.current?.pause();
    localVideoRef.current?.pause();
  }

  const doJoin = useCallback(async () => {
    if (!nick.trim()) return;
    if (socketRef.current?.connected || socketRef.current?.active) return;
    unlockSounds();setSoundsOn(soundEnabled());
    localStorage.setItem("sw_nick", nick.trim());
    const key = `sw_owner_${code}`;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const claim = fragment.get("room-claim");
    let credential = fragment.get("room-admin");
    if (claim) {
      try {
        const response = await fetch(`/api/room-admin/${code}/claim`, {
          method: "POST", headers: { "x-room-admin-key": claim },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        credential = result.credential;
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not accept the room admin invitation.");
        return;
      }
    }
    if (credential) {
      localStorage.setItem(key, credential);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const ownerToken = localStorage.getItem(key);
    const mediaStorageKey = `kn_media_${code}`;
    let mediaKey = localStorage.getItem(mediaStorageKey);
    if (!mediaKey) {
      mediaKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(mediaStorageKey, mediaKey);
    }

    const socket = io({ path: "/socket.io", auth: { code, ownerToken } });
    socket.on("connect_error", (e: Error) => setError(e.message));
    socketRef.current = socket;

    socket.on("connect", () => socket.emit(EVENTS.JOIN, { code, nick: currentNick.current.trim(), ownerToken, mediaKey }));
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
    socket.on(EVENTS.ROOM_ACCESS_UPDATE, (s: {inviteOnly:boolean; discoverable?: boolean}) => {
      setInviteOnly(s.inviteOnly);
      if (typeof s.discoverable === "boolean") setDiscoverable(s.discoverable);
    });
    socket.on('permissions:update',(p:Record<string,boolean>)=>{setPermissions(p);syncPermission.current=p.sync!==false;syncPolicy.current=syncPermission.current||ownHostRole.current;});
    socket.on(EVENTS.ROOM_STATE, async (s: any) => {
      setPhotos(s.photos || []);setRoomAvatar(s.roomAvatarImageId||null);
      hostSocketRef.current=s.participants?.find((p:any)=>p.isHost)?.id;ownHostRole.current=Boolean(s.participants?.find((p:any)=>p.id===s.you)?.isHost);
      setPermissions(s.permissions||{});syncPermission.current=s.permissions?.sync!==false;syncPolicy.current=syncPermission.current||Boolean(s.participants?.find((p:any)=>p.id===s.you)?.isHost);
      if(s.appearance)receiveRoomAppearance(s.appearance);
      const access = await fetch("/api/room-access", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,token:s.uploadToken})});
      if(!access.ok){setError("Could not authorize this room. Reopen your invitation.");return;}
      setFlushOnHostLeave(Boolean(s.flushOnHostLeave));
      setRoomScoped(Boolean(s.roomScoped));
      setDiscoverable(Boolean(s.discoverable));
      setPersistentSpace(Boolean(s.persistentSpace));
      setInviteOnly(Boolean(s.inviteOnly));
      setYou(s.you);
      setIsRoomOwner(Boolean(s.isRoomOwner));
      setUploadToken(s.uploadToken || "");
      setPlaylists(s.playlists || []);
      setLibrary(s.library || []);
      setRoomName(s.name || `Room ${code}`);
      setAiDj(s.aiDj ?? null);
      setQueue(s.queue);
      setParticipants(s.participants);
      setChat(s.chat || []);
      setReceipts(s.receipts || {});
      try {
        const profile=JSON.parse(localStorage.getItem(`kn_profile_${code}`) || "null");
        if(profile)socket.emit(EVENTS.PARTICIPANT_PROFILE,profile);
      } catch {}
      setPlayerMessage(s.playerMessage||null);
      setHistory(s.history || []);
      setStats(s.stats ?? null);
      setMood(s.mood ?? null);
      setPendingRequests(s.pending || []);
      if (detachedHostDevice.current && s.you !== hostSocketRef.current) {
        latestRoomPlayback.current = s;
        followRoomPlayback();
      } else {
        applyPlayback(s);
      }
      // Only a real seat (not a pending request) reaches this handler at all —
      // an invite-only room's non-host joiners get JOIN_PENDING instead.
      setAwaitingApproval(false);
      setJoined(true);
    });
    socket.on(EVENTS.APPEARANCE_UPDATE, receiveRoomAppearance);
    socket.on(EVENTS.LIBRARY_UPDATE, (s: { playlists: Playlist[]; library: Track[] }) => { setPlaylists(s.playlists); setLibrary(s.library || []); });
    socket.on(EVENTS.QUEUE_UPDATE, (s: { queue: Track[] }) => setQueue(s.queue));
    socket.on(EVENTS.PARTICIPANTS_UPDATE, ({participants}: {participants:Participant[]}) => {
      hostSocketRef.current = participants.find(member=>member.isHost)?.id;
      ownHostRole.current=Boolean(participants.find(member=>member.id===socket.id)?.isHost);
      syncPolicy.current = syncPermission.current || ownHostRole.current;
      if (detachedHostDevice.current && socket.id !== hostSocketRef.current) followRoomPlayback();
      setParticipants(participants);
    });
    socket.on(EVENTS.HISTORY_UPDATE, (s: { history: HistoryEntry[] }) => setHistory(s.history));
    socket.on(EVENTS.STATS_UPDATE, (s: { stats: RoomStats }) => setStats(s.stats));
    socket.on(EVENTS.ROOM_NAME_UPDATED, ({name,imageId}: {name:string;imageId?:string|null}) => {setRoomName(name);if(imageId!==undefined)setRoomAvatar(imageId);});
    socket.on(EVENTS.MOOD_UPDATE, (s: { mood: Mood }) => setMood(s.mood));
    socket.on(EVENTS.DJ_TYPING, (s: { typing: boolean }) => setDjTyping(s.typing));
    socket.on(EVENTS.PLAYBACK_UPDATE, (s: any) => applyPlayback(s));
    socket.on(EVENTS.CHAT_RECEIPTS, (update: Record<string, string[]>) => {
      setReceipts(previous => Object.fromEntries(Object.entries({...previous, ...update}).slice(-200)));
    });
    socket.on("participant:renamed", ({nick:name}: {nick:string}) => {
      currentNick.current=name;setNick(name);
      try{localStorage.setItem("sw_nick",name);}catch{}
    });
    socket.on(EVENTS.CHAT_UPDATED, (patch: Partial<ChatMsg> & {id:string}) => {
      setChat(previous=>previous.map(message=>message.id===patch.id?{...message,...patch}:message));
    });
    socket.on(EVENTS.CHAT_NEW, (m: ChatMsg) => {
      setChat((c) => [...c.slice(-199), m]);
      if (m.image) {
        const photo = { id: m.id, image: m.image, nick: m.nick, text: m.text, ts: m.ts, privateMedia: m.privateMedia };
        setPhotos(previous => [...previous.slice(1 - ROOM_PHOTO_LIMIT), photo]);
      }
      if(!m.system&&m.nick!==currentNick.current.trim())messageSound();
      if (!m.system && m.nick!==currentNick.current.trim() && !chatIsVisible()) {
        setUnread((count)=>Math.min(999,count+1));
        setLatestChat({nick:m.nick||'Someone',text:m.text||(m.video?(m.video.voice?'Sent a voice note':'Shared a video'):m.location?'Shared a location':m.image?'Sent an image':'New message')});
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
    const ping = () => { if(socket.connected)socket.emit(EVENTS.SYNC_PING, { t0: performance.now() }); };
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
  const currentAudioUrl = joined && !roomEnded && !videoActive && !preparing && current &&
    current.mediaType !== "video" && uploadToken
    ? `/audio/${current.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`
    : undefined;
  const localAudioUrl = usePausedAudioDownload(currentAudioUrl, !isPlaying, buffering && !needsGesture,
    deviceBuffer.some(([start, end]) => start <= .05 && end >= (current?.duration || Infinity) - .1));
  useEffect(() => { updateDeviceBuffer([]); }, [current?.videoId, videoActive, updateDeviceBuffer]);
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
    if(current.mediaType==="video"&&current.hasAudio===false){stopMediaSlots(active,inactive);setBuffering(false);reportReady(true,syncKey);return;}
    const localUpload=current.videoId.startsWith('local_');
    const wantSrc = `/audio/${current.videoId}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(uploadToken)}`;

    const downloaded = localAudioUrl && active.src === localAudioUrl;
    const adoptDownload = localAudioUrl && (!isPlaying || !audioPrimed.current) && !downloaded;
    if (adoptDownload || (!downloaded && !active.src.endsWith(wantSrc))) {
      if (!adoptDownload && inactive && inactive.src.endsWith(wantSrc) && !inactive.paused) {
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
      audioPrimed.current = false;
      bufferAnchor.current = null;
      bufferPlaybackStart.current = undefined;
      active.src = adoptDownload ? localAudioUrl : wantSrc;
      active.load();
      // A seek before metadata arrives is ignored, which left a fresh join to
      // close its offset by nudging over several seconds. Land it exactly
      // once the element can actually seek.
      active.addEventListener("loadedmetadata", () => (resyncRef.current = true), { once: true });
    }

    let lastCorrectionSeek = -Infinity;
    const tick = () => {
      const pb = playbackRef.current;
      const expected = syncPolicy.current?playbackPosition(pb, serverNow()):active.currentTime;
      const running = playbackRunning(pb, serverNow());
      const dur = current.duration || 0;
      const mediaDuration = Number.isFinite(active.duration) && active.duration > 0 ? active.duration : dur;
      const ranges = readBuffered(active);
      const clampedTarget = Math.max(0, Math.min(mediaDuration || Infinity, expected));
      // On a stall, keep the request at one position until it fills. Repeated
      // seeks to the advancing room clock can otherwise discard every request.
      const playbackTargetChanged = bufferPlaybackStart.current !== undefined && bufferPlaybackStart.current !== pb.startedAt;
      bufferPlaybackStart.current = pb.startedAt;
      if (playbackTargetChanged && Math.abs(active.currentTime - clampedTarget) > 1.25) {
        audioPrimed.current = false;
        bufferAnchor.current = null;
      }
      if (running && !active.paused && active.readyState < 3 && !active.seeking) {
        audioPrimed.current = false;
        active.pause();
      }
      if (!audioPrimed.current && active.readyState >= 1 && !active.seeking) {
        const anchor = bufferAnchor.current ?? clampedTarget;
        if (bufferAnchor.current === null) {
          bufferAnchor.current = anchor;
          if (Math.abs(active.currentTime - anchor) > .25) active.currentTime = anchor;
        }
        if (!active.seeking && (hasStartupBuffer(ranges, clampedTarget, mediaDuration) ||
            (hasStartupBuffer(ranges, anchor, mediaDuration) && Math.abs(clampedTarget - anchor) > 10) ||
            (!mediaDuration && active.readyState >= 4))) {
          if (hasStartupBuffer(ranges, clampedTarget, mediaDuration) && Math.abs(active.currentTime - clampedTarget) > .25) {
            active.currentTime = clampedTarget;
          }
          audioPrimed.current = true;
          bufferAnchor.current = null;
          resyncRef.current = false;
        }
      }
      updateDeviceBuffer(ranges);

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
        !nativeVolumeOnly && document.visibilityState === "visible" &&
        !crossfadeStartedRef.current &&
        !crossfadingRef.current &&
        !detachedHostDevice.current && audioPrimed.current && !active.paused && running &&
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

      if (running && active.paused && audioPrimed.current && !needsGesture) {
        active
          .play()
          .then(() => { audioActivated.current = true; setAudioSetupDone(true); setNeedsGesture(false); })
          .catch((err) => {
            if (err?.name === "NotAllowedError" && document.visibilityState === "visible") {
              setNeedsGesture(true); reportReady(false, syncKey,true);
            }
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
      // Large drift jumps; small drift is steered by playing a few percent
      // fast or slow until it closes. A jump is audible, a 3% speed change
      // isn't, and this is what takes sync from "within a second" to
      // "within a few tens of milliseconds".
      const target = expected;
      if (audioPrimed.current && (document.visibilityState === "visible" || resyncRef.current) && !crossfadingRef.current && !active.seeking && Number.isFinite(target) && active.readyState >= 3) {
        const move = correction(active.currentTime, target, running && !active.paused, resyncRef.current);
        if (move.seek !== null && hasStartupBuffer(ranges, target, mediaDuration) && (resyncRef.current || performance.now() - lastCorrectionSeek > 2000)) {
          active.currentTime = Math.min(move.seek, Number.isFinite(active.duration) ? active.duration : move.seek);
          lastCorrectionSeek = performance.now();
        }
        resyncRef.current = false;
        active.playbackRate = move.rate;
      }
      const remaining = Math.max(0, (current.duration || 0) - active.currentTime);
      const ready = audioPrimed.current && active.readyState >= (localUpload?2:3) && !active.seeking && !needsGesture;
      reportReady(ready || (current.duration > 0 && remaining < .15), syncKey);
      setBuffering(pb.isPlaying && !ready);
    };
    tick();
    const events = ["loadedmetadata", "progress", "canplay", "playing", "waiting", "stalled", "seeked"];
    for (const name of events) active.addEventListener(name, tick);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        resyncRef.current = true;
        if (audioActivated.current) setNeedsGesture(false);
        tick();
      } else if (crossfadingRef.current) {
        cancelCrossfade();
        crossfadingRef.current = false;
        inactive?.pause();
        active.volume = Math.min(1, volumeRef.current * (current.gain ?? 1));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    const id = setInterval(tick, 100);
    return () => {
      clearInterval(id);
      for (const name of events) active.removeEventListener(name, tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined,roomEnded,current?.videoId, isPlaying, preparing, activeSlot, shuffle, repeat, videoActive, syncKey, syncHolding, resumeAt, nativeVolumeOnly, needsGesture, code, uploadToken, localAudioUrl, updateDeviceBuffer]);

  const renameMe = useCallback(async (name: string, targetId?:string) => {
    const socket = socketRef.current;
    if (!socket?.connected) throw Error("Reconnect to the room first.");
    const result = await socket.timeout(4000).emitWithAck(EVENTS.PARTICIPANT_RENAME, { nick: name, targetId });
    if (!result?.nick) throw Error(result?.error || "Could not change your name.");

  }, []);

  const resumeAudio = () => {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && document.documentElement.dataset.knCallActive !== "true") {
      try { session.type = "playback"; } catch {}
    }
    const active = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    const inactive = activeSlot === "A" ? nextAudioRef.current : audioRef.current;
    const activate = async (element: HTMLAudioElement | null) => {
      if (!element) return;
      if (element.hasAttribute("src")) {
        if (element === active && playbackRef.current.isPlaying) {
          // A user gesture unlocks this element even when it is still filling.
          const wasMuted = element.muted;
          if (!audioPrimed.current) element.muted = true;
          try {
            await element.play();
            if (!audioPrimed.current) element.pause();
          } finally { element.muted = wasMuted; }
        }
        return;
      }
      // Prime the same media elements the room uses, from this user gesture.
      const wav = new Uint8Array(844);
      const view = new DataView(wav.buffer);
      wav.set(new TextEncoder().encode("RIFF"), 0);
      wav.set(new TextEncoder().encode("WAVEfmt "), 8);
      wav.set(new TextEncoder().encode("data"), 36);
      view.setUint32(4, 836, true); view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true); view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true); view.setUint16(34, 8, true);
      view.setUint32(40, 800, true); wav.fill(128, 44);
      const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      element.src = url;
      try { await element.play(); }
      finally {
        if (element.getAttribute("src") === url) {
          element.pause(); element.removeAttribute("src"); element.load();
        }
        URL.revokeObjectURL(url);
      }
    };
    void Promise.all([activate(active), activate(inactive)]).then(() => {
      audioActivated.current = true;
      setAudioSetupDone(true);
      setNeedsGesture(false);
    }).catch(() => setNeedsGesture(true));
  };

  const onEnded = () => {
    if (detachedHostDevice.current) {
      setLocalPlayback(current?.duration ?? 0, false);
      return;
    }
    if (canControl && current) emit(EVENTS.TRACK_ENDED, { videoId: current.videoId,syncKey });
  };
  const onAudioError = () => {
    // Wired to whichever <audio> tag is currently active (see the JSX below),
    // so this is only ever called for the one the sync loop is governing.
    const audio = activeSlot === "A" ? audioRef.current : nextAudioRef.current;
    if (!audio || !current || retryRef.current >= 6) return;
    retryRef.current += 1;
    const source = audio.getAttribute("src");
    setTimeout(() => {
      if (audio.getAttribute("src") !== source || !audio.error) return;
      audioPrimed.current = false;
      bufferAnchor.current = null;
      audio.load();
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
    emit(EVENTS.CONTROL_PLAY_NOW, { track, preferVideo: track.mediaType==="video" }); setSceneOnly(false);setTab("now");
  }, [emit]);
  const queueFromSearch = useCallback((track: Track) => emit(EVENTS.QUEUE_ADD, { track, preferVideo: false }), [emit]);
  const playNow = useCallback((track: Track) => {
    emit(EVENTS.CONTROL_PLAY_NOW, { track,preferVideo:track.mediaType==="video" });
    setSceneOnly(false);
    setTab("now");
  }, [emit]);
  const playQueueNow = useCallback((id: string) => emit(EVENTS.CONTROL_PLAY_NOW, { id }), [emit]);
  const seekTo = useCallback((pos: number) => {
    if (detachedHostDevice.current) setLocalPlayback(pos, playbackRef.current.isPlaying);
    else emit(EVENTS.CONTROL_SEEK, { position: pos });
  }, [emit]);
  const playPause = useCallback(() => {
    if (!detachedHostDevice.current) { emit(EVENTS.CONTROL_PLAYPAUSE); return; }
    const playback = playbackRef.current;
    const at = playbackPosition(playback, clockRef.current.now());
    setLocalPlayback(!playback.isPlaying && current?.duration && at >= current.duration - .15 ? 0 : at, !playback.isPlaying);
  }, [emit, current?.duration]);
  const replayMedia = () => {
    setNotice("Replaying from the beginning.");
    if (detachedHostDevice.current) setLocalPlayback(0, true);
    else emit(EVENTS.CONTROL_REPLAY);
  };
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
  const markChatRead = useCallback((ids: string[]) => { if (socketRef.current?.connected) emit(EVENTS.CHAT_READ, { ids }); }, [emit]);
  const sendChat = useCallback((text: string, imageId?: string, videoId?: string, location?: ChatMsg["location"], replyTo?:string, gif?:ChatMsg["gif"]) =>
    new Promise<{id?:string;liveUntil?:number}>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error("Reconnect to the room to send this message."));
      socket.timeout(5000).emit(EVENTS.CHAT_SEND, { text, imageId, videoId, location, replyTo, gif }, (error: Error | null, result?: { error?: string;id?:string;liveUntil?:number }) => {
        if (error || result?.error) reject(new Error(result?.error || "The room did not confirm the message."));
        else resolve(result || {});
      });
    }), []);
  const uploadChatImage = useCallback(async (file: File, recipients?: string[], profile = false) => {
    const maxMB=profile?20:8;
    if (file.size > maxMB * 1024 * 1024) throw new Error(`Choose an image no larger than ${maxMB} MB`);
    const response = await fetch("/chat-media", { method: "POST", body: file, headers: {
      "x-room-code": code, "x-upload-token": uploadToken, "x-file-name": encodeURIComponent(file.name),
      ...(profile ? {"x-upload-purpose":"profile"} : {}),
      ...(recipients ? { "x-media-recipients": JSON.stringify(recipients) } : {}),
    } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Image upload failed");
    return data.image as { id: string; url: string; name: string };
  }, [code, uploadToken]);
  const uploadChatVideo = useCallback(async (file: File, recipients?: string[], voice = false)=>{
    if(file.size>50*1024*1024)throw Error("Choose a video up to 50 MB.");
    const response=await fetch(voice ? '/chat-video?kind=voice' : '/chat-video',{method:'POST',body:file,headers:{'x-room-code':code,'x-upload-token':uploadToken,'x-file-name':encodeURIComponent(file.name),...(recipients ? {'x-media-recipients':JSON.stringify(recipients)} : {})}});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Video upload failed.');return data.video as NonNullable<ChatMsg['video']>;
  },[code,uploadToken]);
  const mediaQuery = `?room=${encodeURIComponent(code)}`;
  const roomAction=useCallback(async (event:string,payload:object) => {
    const socket=socketRef.current;
    if(!socket?.connected)throw Error("Reconnect to the room first.");
    const result=await socket.timeout(5000).emitWithAck(event,payload);
    if(result?.error)throw Error(result.error);
    return result;
  },[]);
  const updateProfile=async (status:string,imageId:string|null,file?:File) => {
    const image=file?await uploadChatImage(file,undefined,true):null;
    const result=await roomAction(EVENTS.PARTICIPANT_PROFILE,{status,imageId:image?.id||imageId});
    try { localStorage.setItem(`kn_profile_${code}`, JSON.stringify(result.profile)); } catch {}
  };
  const updateLiveLocation=useCallback(async (id:string, position?:{lat:number;lng:number})=>{await roomAction(EVENTS.CHAT_LOCATION_UPDATE,{id,...(position || {stop:true})});},[roomAction]);
  const editMessage=useCallback(async (id:string,text:string)=>{await roomAction(EVENTS.CHAT_EDIT,{id,text});},[roomAction]);
  const reactMessage=useCallback(async (id:string,emoji:string)=>{await roomAction(EVENTS.CHAT_REACT,{id,emoji});},[roomAction]);
  const setVideoMode = useCallback((enabled: boolean) => {
    if(enabled && current?.videoId.startsWith("local_")&&current.mediaType!=="video"){setNotice("Local files are audio-only. Choose a YouTube song for video.");return;}
    if (detachedHostDevice.current) setWatchVideo(enabled);
    else emit(EVENTS.CONTROL_VIDEO, { enabled }, (result: any) => { if (result.error) setNotice(result.error); });
    if (enabled) { setTab("now"); setNotice("Video is playing the same song. Switch back to Audio anytime."); }
  }, [emit, current?.videoId,current?.mediaType]);
  const react = useCallback((emoji: string) => emit(EVENTS.REACTION, { emoji }), [emit]);
  const onTyping = useCallback(() => signal("typing"), [signal]);
  const likeCurrent = useCallback(() => {
    if (current?.id) likeTrack(current.id);
  }, [current?.id, likeTrack]);

  const openSearch = useCallback(() => {
    window.dispatchEvent(new Event("konnectivity:home"));
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
  const homeView=()=>{setToolsOpen(false);setSceneOnly(false);setPlayerExpanded(false);setLibraryOpen(false);setTab('now');setCenter('queue');window.dispatchEvent(new Event("konnectivity:home"));};
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

  if(roomEnded)return <main className="studio-entry kn-room-entry sw-couple mx-auto flex min-h-[100dvh] flex-col items-center justify-center px-6"><Panel className="max-w-md text-center"><h1 className="font-display text-2xl">Room ended</h1><p className="my-4 text-sm text-muted">{roomEnded}</p><a href="/">Return home</a></Panel></main>;
  if (kicked) {
    return (
      <main className="studio-entry kn-room-entry sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
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
      <main className="studio-entry kn-room-entry sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
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
      <main className="studio-entry kn-room-entry sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
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
      <main className="studio-entry kn-room-entry sw-couple mx-auto flex min-h-[100dvh] w-full flex-col items-center justify-center px-6">
        <Panel className="w-full max-w-md text-center">
          <div className="mb-2 text-[11px] font-semibold tracking-eyebrow text-[var(--accent-2)] uppercase">
            Listening room
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">{asHost ? "Open your room" : "Join the room"}</h1>
          <p className="mb-6 text-sm text-muted">Choose the name others will see.</p>

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
            aria-label="Display name"
            placeholder="Choose a display name…"
            value={nick}
            maxLength={24}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doJoin()}
          />
          <Button variant="primary" className="w-full" onClick={doJoin} disabled={!nick.trim()}>
            {asHost ? "Open my group room" : requestingJoin ? "Request to join" : "Join"}
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
        compact={!expanded}
        onToggleExpanded={()=>expanded?setPlayerExpanded(false):goHome()}
        current={current}
        isPlaying={isPlaying}
        position={position}
        duration={current?.duration ?? 0}
        isHost={canControl}
        downloadPct={curDl}
        bufferedRanges={deviceBuffer}
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
        onReplay={replayMedia}
        onVoteSkip={voteSkip}
        onShuffle={() => {emit(EVENTS.CONTROL_SHUFFLE);setNotice(shuffle?"Shuffle and autoplay off":"Shuffle and similar-song autoplay on");}}
        onRepeat={() => {emit(EVENTS.CONTROL_REPEAT);setNotice(repeat==="off"?"Repeat this song":repeat==="one"?"Repeat the queue":"Repeat off");}}
        onReact={react}
        onLyrics={()=>{setLyricsOpen(value=>!value);setSceneOnly(false);if(!playerExpanded)setTab("now");}}
        castSupported={casting.supported && (!videoActive || localVideo)}
        castConnected={casting.connected}
        onCast={casting.prompt}
      /></div>
  );

  return (
    <div className="studio-room kn-room-shell sw-couple flex h-[var(--kn-app-height,100dvh)] flex-col overflow-hidden" data-video-active={videoActive} data-room-background={appearance.background}>
      {isRoomOwner && roomScoped && <RoomCookies key={code} code={code} onboarding />}
      <RoomGuide open={guideOpen} onOpenChange={setGuideOpen} />
      <Dialog open={playerExpanded} onOpenChange={setPlayerExpanded}>
        <DialogContent fullscreen {...playerSwipe} className="kn-expanded-player sw-couple" data-room-background={appearance.background} aria-describedby="expanded-player-description">
          <div className="kn-expanded-heading"><button type="button" onClick={()=>setPlayerExpanded(false)} aria-label="Collapse player to bottom bar"><ChevronDown size={24}/></button><div><DialogTitle>Now playing <RoomClock/></DialogTitle><DialogDescription id="expanded-player-description">Your shared soundtrack. Collapse to keep listening below.</DialogDescription></div></div>
          <div className="expanded-view-controls"><button type="button" aria-label={appearance.showArtwork?"Hide artwork":"Show artwork"} aria-pressed={appearance.showArtwork} onClick={()=>appearance.update({showArtwork:!appearance.showArtwork})}>{appearance.showArtwork?<Eye size={17}/>:<EyeOff size={17}/>}<span>Artwork</span></button><button type="button" aria-label={sceneOnly?"Restore song details":"Focus on background"} aria-pressed={sceneOnly} onClick={()=>setSceneOnly(v=>!v)}>{sceneOnly?<Minimize2 size={17}/>:<Scan size={17}/>}<span>{sceneOnly?"Details":"Focus"}</span></button></div>
          {renderChatNotice()}
          <div className="kn-expanded-scene">
            {!current&&lastVideo&&<section className="kn-video-finished"><button className="kn-video-finished-close" title="Close finished video" aria-label="Close finished video" onClick={()=>setLastVideo(null)}><X size={20}/></button><p>Video finished</p><h2>{lastVideo.title}</h2><button title="Replay video" aria-label="Replay video" onClick={()=>emit(EVENTS.CONTROL_PLAY_NOW,{track:lastVideo,preferVideo:true})}><RotateCcw size={24}/></button></section>}
        <RoomBackground videoId={current?.videoId} mediaQuery={mediaQuery} artwork={current?.art||current?.thumbnail}/>
            <RoomLights position={position} playing={isPlaying&&!syncHolding&&!preparing}/>{sceneOnly&&<AmbientVisualizer room playing={isPlaying&&!syncHolding&&!preparing}/>}
          <NowPlaying lyricsVisible={lyricsOpen} mediaQuery={mediaQuery} comments={current?<SongComments compact socket={socketRef.current} track={current} members={participants.filter(member=>member.id!==you)}/>:undefined} current={current} isPlaying={isPlaying&&!syncHolding} preparing={preparing} cachePct={curDl??0} buffering={buffering} participants={participants} position={position} likes={currentLikes} liked={youLikeCurrent} onLike={likeCurrent} canSeek={canControl&&!preparing&&(current?.duration??0)>0} onSeek={seekTo} className={cn("kn-expanded-artwork flex-1",sceneOnly&&"!hidden")}/>
          </div>
          <div className="expanded-room-actions" aria-label="Player messages and emoji reactions"><button type="button" onClick={()=>setMessageComposerOpen(true)}><MessageSquare size={17}/>Message</button><button type="button" onClick={openSongComments}><MessageSquare size={17}/>Comments &amp; tags</button><ReactionBar onReact={react}/></div>
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



      <Dialog open={messageComposerOpen} onOpenChange={setMessageComposerOpen}><DialogContent className="!max-w-md"><DialogTitle>Playback message</DialogTitle><DialogDescription>Share a message alongside the artwork.</DialogDescription><PlayerMessageComposer disabled={Boolean(participants.find(p=>p.id===you)?.muted)} onClear={()=>new Promise<void>((resolve,reject)=>socketRef.current?.timeout(5000).emit(EVENTS.PLAYER_MESSAGE,{clear:true},(err:any,r:any)=>err||r?.error?reject(Error(r?.error||"Message could not be saved.")):resolve()))} onSent={()=>setMessageComposerOpen(false)} onSend={(text,emoji,duration,animation)=>new Promise<void>((resolve,reject)=>socketRef.current?.timeout(5000).emit(EVENTS.PLAYER_MESSAGE,{text,emoji,duration,animation},(err:any,r:any)=>err||r?.error?reject(Error(r?.error||"Message could not be saved.")):resolve()))}/></DialogContent></Dialog>
      <LibraryPanel photos={photos} mediaQuery={mediaQuery} onUploadPhoto={async file=>{const image=await uploadChatImage(file);await sendChat("",image.id);return image;}} open={libraryOpen} section={librarySection} onSection={setLibrarySection} onClose={() => setLibraryOpen(false)}
        code={code} uploadToken={uploadToken} playlists={playlists} library={library} seed={playlistSeed}
        tracks={[...(current ? [current] : []), ...queue]} onAdd={addTrack} onAddMany={addTracks} onPlayNow={track=>{playNow(track);setLibraryOpen(false);}} onPlaylistAdd={addToPlaylist} emit={emit} />
      {showPlaybackWait && playbackWaiting && current && (
        <div className="sw-save-notice flex items-center gap-3">
          <span role="status" className="min-w-0 break-words">{preparing ? <>Getting “{current.title}” ready for everyone{playbackRequester ? ` · requested by ${playbackRequester}` : ""}…</> : <>“{current.title}” is buffering on this device. Playback will catch up automatically.</>}</span>
          <button type="button" aria-label="Dismiss playback message" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10" onClick={()=>{dismissedPlaybackWait.current=current.videoId;setShowPlaybackWait(false);}}><X size={17}/></button>
        </div>
      )}
      <FeedbackToast message={notice||error||undefined}/>
      {helpOpen && <ShortcutsDialog open onOpenChange={setHelpOpen} isHost={canControl} />}
      {soundOpen && (
        <SoundSettings open onOpenChange={setSoundOpen} rtt={networkRtt} nativeVolumeOnly={nativeVolumeOnly} waitingFor={waitingFor} />
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

      {/* ── top bar: identity, mood, search, presence ── */}
      {/* z-50 so the search dropdown clears the bottom player (z-40) rather
          than sliding behind it on a short window. */}
      <Dialog open={exit.open} onOpenChange={open=>{if(!open)exit.cancel();}}>
        <DialogContent>
          <DialogTitle>{isHost?"Leave the party?":"Are you sure you want to leave?"}</DialogTitle>
          <DialogDescription>{isHost
            ?"Choose a listener to keep the party going, or end the session for everyone."
            :"You will disconnect from this room and any active call."}</DialogDescription>
          {isHost&&participants.some(member=>member.id!==you&&member.status!=="reconnecting")&&
            <label className="block text-sm font-medium">New host
              <select className="mt-2 block w-full rounded-lg border border-input bg-field px-3 py-2"
                value={nextHostId} onChange={event=>setNextHostId(event.target.value)} disabled={exit.leaving}>
                <option value="">Choose a listener</option>
                {participants.filter(member=>member.id!==you&&member.status!=="reconnecting").map(member=>
                  <option key={member.id} value={member.id}>{member.nick}</option>)}
              </select>
            </label>}
          {exit.error&&<p role="alert" className="text-sm text-muted">{exit.error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={exit.leaving} onClick={exit.cancel}>Stay</Button>
            {isHost&&nextHostId
              ? <Button disabled={exit.leaving||!participants.some(member=>member.id===nextHostId&&member.status!=="reconnecting")}
                  onClick={()=>void exit.confirm(nextHostId)}>{exit.leaving?"Handing off…":"Make host & leave"}</Button>
              : <Button variant="danger" disabled={exit.leaving} onClick={()=>void exit.confirm()}>
                  {exit.leaving?"Leaving…":"Leave"}
                </Button>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={toolsOpen} onOpenChange={setToolsOpen}><DialogContent className="studio-settings kn-settings-dialog !max-w-xl"><DialogTitle>Settings</DialogTitle><DialogDescription>{adminSettingsMode?"Room management":"Your listening space"}</DialogDescription>
      {adminSettingsMode&&<button type="button" className="settings-back" onClick={()=>settingsSection==="overview"?setAdminSettingsMode(false):setSettingsSection("overview")}><ArrowLeft size={18}/>Back</button>}
      {!adminSettingsMode?<nav className="settings-personal-options" aria-label="Settings sections"><AppearanceSettings onSaved={()=>{setNotice("Appearance saved for everyone.");}} onSave={patch=>new Promise((resolve,reject)=>{socketRef.current?.timeout(5000).emit(EVENTS.APPEARANCE_SET,patch,(err:any,result:any)=>err||result?.error?reject(Error(result?.error||"Could not save. Try again.")):(result?.appearance&&receiveRoomAppearance(result.appearance),resolve()));})} persistentSpace={persistentSpace} canManagePersistentSpace={Boolean(isHost)} onPersistentSpaceChange={enabled=>emit(EVENTS.PERSONAL_SPACE_SET,{enabled},(result:any)=>setNotice(result?.error|| (enabled?"Appearance and settings will be reused in new rooms.":"Appearance and settings stay room-local.")))} onUploadImage={uploadChatImage} mediaQuery={mediaQuery} artwork={current?.videoId&&!current.videoId.startsWith("local_")?`/api/artwork?videoId=${encodeURIComponent(current.videoId)}`:current?.art||current?.thumbnail} />
      <button type="button" onClick={()=>{setAdminSettingsMode(true);setSettingsSection("overview");}}><Users size={18}/>Room management<ArrowRight size={16}/></button>
      <button type="button" onClick={()=>setSoundOpen(true)}><SlidersHorizontal size={18}/>Sound & playback<ArrowRight size={16}/></button>
      <button type="button" onClick={()=>{setAdminSettingsMode(true);setSettingsSection("dj");}}><Sparkles size={18}/>AI DJ<ArrowRight size={16}/></button>
      <button type="button" onClick={()=>setHelpOpen(true)}><Keyboard size={18}/>Keyboard shortcuts<ArrowRight size={16}/></button>
      <button type="button" aria-pressed={soundsOn} onClick={()=>{unlockSounds();setSoundEnabled(!soundsOn);setSoundsOn(!soundsOn);}}><Volume2 size={18}/><span>Notification sounds {soundsOn?"on":"off"}</span></button>
      {isHost&&<label className="settings-check-row"><input type="checkbox" checked={persistentSpace} onChange={event=>emit(EVENTS.PERSONAL_SPACE_SET,{enabled:event.target.checked},(result:any)=>setNotice(result?.error||"Saved settings preference updated."))}/><span><strong>Save my settings across rooms</strong><small>Keep appearance, mood, profile and saved playlists.</small></span></label>}
      <button type="button" onClick={()=>{setToolsOpen(false);setGuideOpen(true);}}>Room guide<ArrowRight size={16}/></button>
      </nav>:<>
      {settingsSection==="overview"&&<nav className="settings-nested-nav" aria-label="Room management sections">
      <button type="button" onClick={()=>{setGroupNameDraft(roomName.slice(0,15));setGroupAvatarDraft(null);setSettingsSection("identity");}}><Pencil size={18}/>Group name & avatar<ArrowRight size={16}/></button>
      <button type="button" onClick={()=>{setToolsOpen(false);openPeople("mood");}}><Smile size={18}/>Room mood<ArrowRight size={16}/></button>
      <button type="button" onClick={()=>setSettingsSection("sync")}><Radio size={18}/>Device synchronization<ArrowRight size={16}/></button>
      {isHost&&<><button type="button" onClick={()=>{setToolsOpen(false);openPeople("admin");}}><Users size={18}/>Hosts, listeners & requests<ArrowRight size={16}/></button><button type="button" onClick={()=>setSettingsSection("permissions")}><Settings size={18}/>Listener permissions<ArrowRight size={16}/></button></>}
      {isRoomOwner&&<button type="button" onClick={()=>setSettingsSection("integrations")}><ListMusic size={18}/>YouTube integration<ArrowRight size={16}/></button>}
      {isHost&&roomScoped&&<button type="button" onClick={()=>setSettingsSection("discovery")}><SearchIcon size={18}/>Group discovery<ArrowRight size={16}/></button>}
      </nav>}
      {settingsSection==="identity"&&<form className="kn-group-settings" onSubmit={async event=>{event.preventDefault();try{await roomAction(EVENTS.ROOM_NAME_SET,{name:groupNameDraft,imageId:groupAvatarDraft??roomAvatar});setNotice("Group identity saved.");setSettingsSection("overview");}catch(error){setNotice(error instanceof Error?error.message:"Could not save group.");}}}><label>Group avatar<div className="kn-group-avatar-preview">{(groupAvatarDraft??roomAvatar)?<img alt="Group avatar preview" src={`/chat-media/${groupAvatarDraft??roomAvatar}${mediaQuery}`}/>:<Users size={30}/>}</div><input type="file" aria-label="Choose group avatar" accept="image/*" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;try{const image=await uploadChatImage(file,undefined,true);setGroupAvatarDraft(image.id);}catch(error){setNotice(error instanceof Error?error.message:"Upload failed.");}}}/></label><label>Group name<input aria-label="Group name" required maxLength={15} value={groupNameDraft} onChange={event=>setGroupNameDraft(event.target.value)}/><small>{groupNameDraft.length}/15 characters</small></label><button type="submit"><Check size={18}/>Save group</button></form>}
      {settingsSection==="sync"&&<section><h3>Device synchronization</h3>{isHost?<label className="settings-check-row"><input type="checkbox" checked={!hostDeviceDetached} onChange={event=>toggleHostDeviceSync(event.target.checked)}/><span><strong>Sync this device with the room</strong><small>Turn off to control playback locally. Other listeners keep playing.</small></span></label>:<p>Your playback follows the room’s synchronization permission.</p>}{isHost&&<PermissionManager key={JSON.stringify(permissions)} value={permissions} onSave={patch=>roomAction("permissions:set",patch).then(()=>{setNotice("Room synchronization permissions saved.");})}/>}</section>}
      {settingsSection==="permissions"&&isHost&&<PermissionManager key={JSON.stringify(permissions)} value={permissions} onSave={patch=>roomAction("permissions:set",patch).then(()=>{setNotice("Listener permissions saved.");})}/>}
      {settingsSection==="integrations"&&isRoomOwner&&<RoomCookies code={code} recovery={roomScoped}/>}
      {settingsSection==="discovery"&&isHost&&<label className="settings-check-row"><input type="checkbox" checked={discoverable} onChange={event=>emit("group:discovery",{enabled:event.target.checked})}/><span>Allow random matching while an admin is online.</span></label>}
      {settingsSection==="dj"&&<section><h3>AI DJ</h3><p>{aiDj?`${aiDj} is available. Use /dj in chat to request music.`:"AI DJ is currently disabled."}</p><AdminRoomSettings/></section>}
      </>}
      </DialogContent></Dialog>
      <div className="studio-frame">
        <aside className="studio-sidebar" aria-label="Room navigation">
          <button type="button" className="studio-sidebar-brand" onClick={homeView} aria-label="Home"><Logo size="md"/><span>Konnectivity</span></button>
          <nav aria-label="Listening room">
            <button type="button" aria-pressed={tab === "now"} onClick={() => { setSceneOnly(false); setTab("now"); }}><Radio size={19}/>Now playing</button>
            <button type="button" aria-pressed={tab === "queue"} onClick={() => { setSceneOnly(false); setTab("queue"); }}><ListMusic size={19}/>Queue{queue.length > 0 && <span>{queue.length}</span>}</button>
            <button type="button" aria-pressed={companionOpen} onClick={() => {setSceneOnly(false);setTab("chat");setPane("chat");setCompanionOpen(true);window.dispatchEvent(new Event("konnectivity:open-chat"));}}><MessageSquare size={19}/>Conversation{unread > 0 && <span>{unread}</span>}</button>
          </nav>
          <nav aria-label="Room activities"><button type="button" aria-pressed={tab==="activities"} onClick={()=>openActivities("plans")}><CalendarDays size={19}/>Polls &amp; Plans</button></nav>
          <nav aria-label="Collections">
            <button type="button" onClick={() => openLibrary("songs")}><Music2 size={19}/>Library</button>
            <button type="button" onClick={() => openLibrary("playlists")}><ListMusic size={19}/>Playlists</button>
          </nav>
          <nav className="studio-sidebar-bottom" aria-label="Room tools">
            <button type="button" onClick={() => {setAdminSettingsMode(false);setToolsOpen(true);}}><Menu size={19}/>Room management</button>
            <button type="button" onClick={() => {setAdminSettingsMode(false);setToolsOpen(true);}}><Settings size={19}/>Settings</button>
          </nav>
        </aside>
        <div className="studio-workspace">
          <header className="studio-header sw-safe-t sw-safe-x">
            <button type="button" className="studio-room-title" aria-label="Konnectivity — open player" aria-haspopup="dialog" onClick={() => { setSceneOnly(false); goHome(); }}>
              {roomAvatar?<img className="kn-room-avatar" alt="" src={`/chat-media/${roomAvatar}${mediaQuery}`}/>:<span className="kn-room-avatar"><Users size={22}/></span>}<span><strong>{roomName}</strong><small>{participants.length} {participants.length === 1 ? "listener" : "listeners"}</small></span>
            </button>
              <div className="room-profile-anchor">
              <div className="header-personal-actions"><button type="button" aria-label="Home" onClick={homeView}><Home size={18}/></button><button type="button" aria-label="Leave party" onClick={()=>exit.request()}><LogOut size={18}/></button></div>
              <button type="button" className="room-profile-trigger" aria-label={`Edit profile for ${ownParticipant?.nick || nick}`} title={ownParticipant?.nick || nick} onClick={() => setProfileMenuOpen(true)}>
                {ownParticipant?.profile?.imageId
                  ? <img src={`/chat-media/${ownParticipant.profile.imageId}${mediaQuery}`} width={32} height={32} className="room-profile-avatar" alt="Your profile" />
                  : <Avatar name={ownParticipant?.nick || nick} size="sm" />}
              </button>
                {profileMenuOpen&&<div className="room-profile-popover" role="dialog" aria-label="Your profile"><div className="profile-menu-heading">{ownParticipant?.profile?.imageId?<img className="room-profile-avatar" alt="Your avatar" src={`/chat-media/${ownParticipant.profile.imageId}${mediaQuery}`}/>:<Avatar name={ownParticipant?.nick||nick} size="sm"/>}<strong>{ownParticipant?.nick||nick}</strong><button type="button" aria-label="Close profile menu" onClick={()=>setProfileMenuOpen(false)}><X size={17}/></button></div><div className="profile-action-list">
        <button type="button" onClick={()=>{setProfileMenuOpen(false);openPeople("profile");}}><UserRound size={19}/>Edit profile · photo or GIF</button><button type="button" onClick={()=>{setProfileMenuOpen(false);openPeople("rename");}}><Pencil size={19}/>Change display name</button>
      </div></div>}</div>

            <div className="studio-search">
              <SearchPanel roomCode={code}
          library={library} playlists={playlists} onPlaylistAdd={addToPlaylist} onCreatePlaylist={createPlaylistFor}
                onPlayNow={playFromSearch}
          onSearchActivity={reportSearchActivity}
          onAdd={queueFromSearch}
          onAddMany={addTracks}
          queuedIds={roomIds}
          variant="overlay"
          shortcut
          openSignal={searchSignal}
          className="kn-toolbar-search"
          onUpload={()=>openLibrary("upload")}
        />
            </div>
            <div className="studio-header-tools"><div className="kn-people-controls"><RoomPeople onBack={()=>{setAdminSettingsMode(true);setSettingsSection("overview");setToolsOpen(true);}} onHostRole={async(id,enabled)=>{await roomAction("host:role-set",{id,enabled});}} shortcut={peopleShortcut} roomName={roomName} onRoomName={async name=>{await roomAction(EVENTS.ROOM_NAME_SET,{name});}} onRename={renameMe} onProfile={updateProfile} mediaQuery={mediaQuery} mood={mood?.label||""}
          onMood={async label=>{await roomAction(EVENTS.MOOD_SET,{label});}} onBuzz={async targetId=>{await roomAction(EVENTS.ROOM_BUZZ,{targetId});}} socket={socketRef.current} list={participants} you={you} isHost={Boolean(isHost)} pending={pendingRequests} inviteOnly={inviteOnly} discoverable={discoverable}
            onApprovalChange={enabled=>socketRef.current?.emit(EVENTS.HOST_APPROVAL_SET,{enabled})}
            onApprove={approveJoin} onDeny={denyJoin} onKick={kickParticipant} onMute={muteParticipant}/></div>{isHost&&<button type="button" className="global-buzz" aria-label="Buzz listeners" title="Buzz listeners" onClick={()=>openPeople("buzz")}><Zap size={18}/><span>Buzz</span></button>}<div className="global-share"><ShareButton code={code}/></div><div className="global-room-call"><RoomTogether onClose={homeView} activitiesTarget={activitiesTarget} inlineActivities={tab==="activities"} openRequest={activityRequest} socket={socketRef.current} muted={Boolean(participants.find(p=>p.id===you)?.muted)}/></div><div className="global-notifications"><RoomNotifications room={code} socket={socketRef.current} onOpen={openActivities} onMention={openSongComments}/></div>              <button type="button" className="studio-more" onClick={() => {setAdminSettingsMode(false);setToolsOpen(true);}} aria-label="Settings" aria-haspopup="dialog"><Menu size={20}/></button>
            </div>
          </header>
          <Dialog open={roomActionsOpen} onOpenChange={setRoomActionsOpen}>
            <DialogContent className="studio-action-sheet max-w-md">
              <DialogTitle>Manage room</DialogTitle>
              <DialogDescription>{roomName}</DialogDescription>
              <div className="studio-action-list">

                <button type="button" onClick={() => { setRoomActionsOpen(false); setAdminSettingsMode(false); setToolsOpen(true); }}><Settings size={20}/>Settings</button>
                <button type="button" onClick={() => { setRoomActionsOpen(false); homeView(); }}><Home size={20}/>Home</button>
                <button type="button" className="kn-forward-control" disabled={viewIndex.current>=viewHistory.current.length-1} onClick={() => { setRoomActionsOpen(false); navigateView(1); }}><ArrowRight size={20}/>Forward</button>
                <button type="button" className="studio-leave" onClick={() => { setRoomActionsOpen(false); exit.request(); }}><LogOut size={20}/>Leave party</button>
              </div>
            </DialogContent>
          </Dialog>
      {hostDeviceDetached && <div className="kn-playback-error" role="status">
        <div><strong>This device is unsynced</strong><span>The room is still playing independently.</span></div>
        <Button variant="outline" onClick={() => toggleHostDeviceSync(true)}>Rejoin sync</Button>
      </div>}
      {playbackError&&<div className="kn-playback-error" role="alert"><div><strong>Playback paused</strong><span>{playbackError}</span></div><Button onClick={()=>emit(EVENTS.CONTROL_RETRY)}>Retry track</Button><Button variant="ghost" onClick={()=>emit(EVENTS.CONTROL_SKIP)}>Skip track</Button></div>}
      {current?.mediaType==="video"&&current.hasAudio===false&&!watchVideo&&<p className="kn-cast-notice" role="status">This video has no audio track. Select Watch video to view it.</p>}
      {casting.error&&<p className="kn-cast-notice" role="status">{casting.error}</p>}
      {syncHolding && <div className="sw-sync-message" role="status">Synchronizing playback{waitingFor.length ? ` — waiting for ${waitingFor.join(" & ")}` : ""}. Buffering or device permission may be required; enable playback on that device if prompted.</div>}
      {/* ── body ── */}
      <main ref={mainRef} className={cn("relative flex min-h-0 flex-1 flex-col", videoActive && "sw-watching", reactionDockOpen && "sw-reactions-open")} data-view={tab} data-companion={companionOpen&&tab!=="activities"} {...swipe}>
        <section className={cn("room-activities-workspace",tab!=="activities"&&"!hidden")} aria-label="Polls and plans workspace"><div ref={setActivitiesTarget}/></section>
        <nav className="room-media-toolbar" aria-label="Media controls">
          <div className="room-media-mode" aria-label="Media playback mode">
            <button type="button" aria-pressed={!watchVideo} onClick={() => setVideoMode(false)}><Music2 size={16}/>Music</button>
            <button type="button" aria-pressed={watchVideo} disabled={Boolean(current?.videoId.startsWith("local_") && current.mediaType !== "video")} onClick={() => setVideoMode(true)}><Video size={16}/>Video</button>
          </div>
          <button type="button" onClick={() => openLibrary("songs")} aria-label="Open media library" title="Library and playlists"><ListMusic size={18}/><span>Library</span></button>
          <button type="button" aria-label="Change room mood" title="Change room mood" onClick={()=>openPeople("mood")}><span aria-hidden="true">{mood?.emoji||"✨"}</span><span>{mood?.label||"Mood"}</span></button>
          <button type="button" className="room-chat-toggle" aria-label="Open room chat" title="Open chat" onClick={openChatNotice}><MessageSquare size={18}/></button>
          <button type="button" className="room-focus-toggle" aria-label={sceneOnly?"Restore song details":"Focus on background"} title={sceneOnly?"Restore song details":"Focus on background"} aria-pressed={sceneOnly} onClick={()=>setSceneOnly(value=>!value)}>{sceneOnly?<Minimize2 size={18}/>:<Scan size={18}/>}</button>
        </nav>
        {videoActive && current && <div className="sw-video-stage">
          <VideoStage transport={renderPlayer()} hidden={videoControlsHidden} onToggle={()=>setVideoControlsHidden(v=>!v)} onReplay={replayMedia}><>{localVideo?<UploadedVideo src={`/audio/${current.videoId}${mediaQuery}&token=${encodeURIComponent(uploadToken)}`} title={current.title} volume={deviceVolume} syncKey={syncKey} getPosition={getMediaPosition} getRunning={getMediaRunning} onReadyChange={reportReady} onEnded={onEnded} onElement={setLocalVideo} onBuffer={updateDeviceBuffer}/>:<YouTubePlayer videoId={current.videoId} position={position} playing={isPlaying && !preparing && !syncHolding && serverNow() >= resumeAt} desiredPlaying={isPlaying} holding={syncHolding} volume={deviceVolume} title={current.title}
            onPlaying={(playing) => { if (!detachedHostDevice.current) emit(EVENTS.CONTROL_PLAY_STATE, { playing }); }} onEnded={onEnded}
            onMetadata={(duration, title) => { if (!detachedHostDevice.current) emit(EVENTS.CONTROL_VIDEO_METADATA, { videoId: current.videoId, duration, title }); }}
            getPosition={getMediaPosition} getRunning={getMediaRunning} syncKey={syncKey} onReadyChange={reportReady} onPlaybackSampler={setYouTubePlaybackSampler} onBuffer={updateDeviceBuffer} />}</></VideoStage>
        </div>}
        {!current&&lastVideo&&<section className="kn-video-finished"><button className="kn-video-finished-close" title="Close finished video" aria-label="Close finished video" onClick={()=>setLastVideo(null)}><X size={20}/></button><p>Video finished</p><h2>{lastVideo.title}</h2><button title="Replay video" aria-label="Replay video" onClick={()=>emit(EVENTS.CONTROL_PLAY_NOW,{track:lastVideo,preferVideo:true})}><RotateCcw size={24}/></button></section>}
        <RoomBackground videoId={current?.videoId} mediaQuery={mediaQuery} artwork={current?.art || current?.thumbnail} />
        <RoomLights position={position} playing={isPlaying&&!syncHolding&&!preparing}/>{sceneOnly&&<AmbientVisualizer room playing={isPlaying&&!syncHolding&&!preparing}/>}
        <div className="sw-love-stars" aria-hidden><i>♡</i><i>✦</i><i>♡</i><i>✧</i><i>♡</i></div>
        {/* The bottom padding on phones is the reaction pill's safe area: it
            floats over this region, and without the gap it sits on top of
            whatever the panel ends with. */}
        <div className={cn(sceneOnly&&"!hidden","studio-stage-grid kn-listening-layout flex min-h-0 w-full flex-1 flex-col")}>
          {/* ── column 1: the hero ── */}
          <NowPlaying
            lyricsVisible={lyricsOpen} mediaQuery={mediaQuery}
            comments={current?<SongComments compact socket={socketRef.current} track={current} members={participants.filter(member=>member.id!==you)}/>:undefined}

            current={current}
            isPlaying={isPlaying&&!syncHolding}
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
            onFindTrack={openSearch}
            className={cn(
              tab === "now" ? "flex flex-1" : "hidden",
              videoActive && "!hidden"
            )}
          />

          {/* ── column 2: what the room is about to hear, and what it has ── */}
          <div
            className={cn(
              "kn-queue-column min-h-0 flex-1 flex-col gap-4",
              tab === "queue" || tab === "search" ? "flex" : "hidden",
              "studio-queue"
            )}
          >

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "kn-queue-surface",
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
                <HistoryPanel current={current} isPlaying={isPlaying} history={history} onReAdd={addTrack} className="min-h-0 flex-1" />
              )}
              {center === "stats" && <StatsPanel stats={stats} className="min-h-0 flex-1" />}
            </Panel>

            <Panel
              className={cn(
                tab === "queue" ? "flex" : "hidden",
                "studio-recommendations",
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
                onPlayNow={playFromSearch}
                className="min-h-0 flex-1"
              />
            </Panel>
          </div>

          {/* ── column 3: the people ── */}
          <Panel
            className={cn(tab === "chat" ? "flex flex-1" : "hidden", "kn-community-surface min-h-0 overflow-hidden md:gap-4")}
          >
            <div className="room-conversation-header">
              <nav className="room-conversation-tabs" aria-label="Conversation views">
                <button type="button" aria-pressed={pane === "chat"} onClick={() => setPane("chat")}>Chat{unread > 0 && pane !== "chat" && <small>{unread}</small>}</button>
                <button type="button" aria-pressed={pane === "activity"} onClick={() => setPane("activity")}>Activity</button>

              </nav>

            </div>
            <ActivityFeed events={chat} reactions={reactionLog} onClose={()=>{setPane("chat");setTab("now");}} className={pane === "activity" ? "flex-1 room-activity-panel" : "!hidden"}/>

            <ChatPanel
              onBuzz={isHost?()=>{void roomAction(EVENTS.ROOM_BUZZ,{}).catch(error=>setNotice(error.message));}:undefined} onCall={()=>openActivities("call")}
              ownProfile={ownParticipant?.profile}
              youId={you}
              chat={chat}
              photos={photos}
              canUploadPhotos={isHost || permissions.photos !== false}
              canUploadVideos={isHost || permissions.videos !== false}
              canSharePrivately={isHost || permissions.privateMedia === true}
              members={participants.filter(member => member.id !== you && member.status !== "reconnecting")}
              you={nick.trim()}
              aiDj={aiDj}
              djTyping={djTyping}
              onSend={sendChat}
              onEdit={editMessage}
              onReact={reactMessage}
              onRecordingChange={setRecordingVoice}
              onLiveLocation={updateLiveLocation}
              canShareLocation={isHost || permissions.location !== false}
              onUploadImage={uploadChatImage}
              onUploadVideo={uploadChatVideo}
              receipts={receipts}
              onRead={markChatRead}
              mediaQuery={mediaQuery}
              mobileOpen={tab==="chat"}
              onMobileClose={()=>setTab("now")}
              onExpandedChange={setChatExpanded}
              onTyping={onTyping}
              statuses={statuses}
              muted={participants.find((p) => p.id === you)?.muted}
              className={cn(
                pane === "chat" ? "flex flex-1" : "!hidden"
              )}
            />
          </Panel>
        </div>

        <div className={cn("px-4 pb-2 md:hidden",sceneOnly&&"hidden")}>
          <InstallBanner code={code} />
        </div>
      </main>

      {tab==="now"&&<div className="room-visible-actions" aria-label="Artwork actions and emoji reactions"><button type="button" onClick={()=>setMessageComposerOpen(true)} aria-label="Send playback message"><MessageSquare size={17}/><span>Message</span></button><button type="button" onClick={openSongComments} aria-label="Song comments and tags" title="Song comments & tags"><span className="song-comments-at">@</span><span>Comments</span></button><ReactionBar onReact={react}/></div>}
      {!videoActive&&(!audioSetupDone||needsGesture)&&<div className="kn-scene-controls audio-permission-row">
      {/* autoplay blocked (mobile) — a tap satisfies the gesture requirement */}
      {!videoActive && (!audioSetupDone || needsGesture) && (
        <button
          onClick={resumeAudio}
          className="kn-enable-audio fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-max items-center gap-2 rounded-full bg-[image:var(--accent-gradient)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--glow-accent)] animate-pulse"
        >
          <Play className="size-4" /> {audioSetupDone ? "Resume audio on this device" : "Enable room audio"}
        </button>
      )}
      </div>}

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
      <aside ref={reactionDockRef} className="sw-reaction-dock" aria-label="Room reactions">
        {reactionDockOpen && <ReactionBar onReact={(emoji) => { react(emoji); setReactionDockOpen(false); }} className="sw-side-reactions" />}
        <button className="sw-reaction-dock-toggle" aria-label="Reactions" aria-expanded={reactionDockOpen} onClick={() => setReactionDockOpen(v => !v)}><Smile size={18}/></button>
      </aside>

      </div>
      </div>
      {renderPlayer()}
      <div className="kn-room-dock sw-safe-x relative z-40 shrink-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-2 backdrop-blur-xl md:hidden">
        <TabBar tab={libraryOpen&&librarySection==="playlists"?"playlists":toolsOpen?"settings":tab} setTab={(value) => value === "settings" ? setToolsOpen(true) : value === "playlists" ? openLibrary("playlists") : value === "search" ? openSearch() : value === "activities" ? openActivities("plans") : (window.dispatchEvent(new Event("konnectivity:home")),setSceneOnly(false),setTab(value))} queueCount={queue.length} unread={unread} />
      </div>
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
      {item("search", <SearchIcon className="size-4" />, "Search")}
      {item("chat", <MessageSquare className="size-4" />, "Chat", unread)}
      {item("playlists", <ListMusic className="size-4" />, "Playlists")}
      {item("activities", <CalendarDays className="size-4" />, "Polls & Plans")}
    </div>
  );
}

/**
 * Who's waiting to get in. Host-only, and only rendered at all when someone
 * actually is — an invite-only room with nobody waiting shouldn't carry a
 * permanent empty button in the header.
 */
