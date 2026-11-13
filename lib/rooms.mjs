import { supportedEmoji } from "./emoji-catalog.mjs";
import { selectedGif } from "./gif-library.mjs";
import { selectedGiphy } from "./giphy.mjs";
import { canViewMedia, publicRoomEntry, visibleRoomEntries } from "./media-audience.mjs";
import { clearAllPersonalCookies, clearRoomCookies, downloadContext, needsYoutubeCookie, YOUTUBE_SETUP_MESSAGE } from "./room-credentials.mjs";
import {allowed,permissionFor,permissionState,PERMISSIONS} from './permissions.mjs';
import {MESSAGE_ANIMATIONS} from './visual-options.mjs';
import {registerSocial,SOCIAL_EVENTS,clearRoomSocial,leaveRoomCall,endRoomCall,notifyRoom} from "./social.mjs";
import {chatVideo, videoAudience} from "./chat-video.mjs";
import {memberSpace,roomSpace,saveMemberSpace,rememberProfile,personalSpace,savePersonalSpace,savedPlaylists,rememberSettings,rememberAppearance,rememberPlaylist} from "./personal-space.mjs";
// In-memory room store (persisted to disk) + Socket.io wiring.
// The SERVER owns the playback clock; clients render their <audio> position
// from `startedAt`, so everyone stays in sync. Rooms are durable: they survive
// an empty room and a server restart (permanent links). Ownership is by a
// durable ownerToken the creator holds in localStorage.

import {DEFAULT_APPEARANCE,appearancePatch} from "./appearance.mjs";
import { onSessionRevoked, SESSION_COOKIE } from "./auth.mjs";
import { adminRequest, cookieMap, equalToken, requestIp, roomAdminKey, roomKeyHash } from "./access.mjs";
import { inheritBackground, chatImage, imageAudience } from "./chat-media.mjs";
import { uploadedTrack, allUploadedTracks } from "./uploads.mjs";
import { customAlphabet } from "nanoid";
import {
  EVENTS,
  ROOM_PHOTO_LIMIT,
  MOODS,
  RECONNECT_GRACE_MS,
  SKIP_THRESHOLD,
  STATUSES,
} from "./protocol.mjs";
import { prefetchAudio, ensureAudio, touchCache, cacheStatus, cachedGain } from "./resolver.mjs";
import { loadSync, saveDebounced } from "./store.mjs";
import { searchSongs } from "./ytmusic.mjs";
import { djEnabled, generateIntro, interpretRequest, djName } from "./dj.mjs";

/**
 * Playback time, on a clock that only ever moves forward.
 *
 * `startedAt` and the `serverNow` clients calibrate against have to advance at
 * the same rate and never jump. `Date.now()` does jump: an NTP correction, a
 * VM suspend and resume, or someone fixing the server's timezone steps it by
 * whatever the drift was. Every listener derives its audio position from those
 * two numbers, so a step doesn't desync one client — it yanks the entire room
 * at once, mid-song.
 *
 * The wall-clock anchor is taken once at boot purely so the values still look
 * like timestamps on the wire. Nothing downstream depends on them matching
 * real time, only on the difference between them being honest. Rooms restore
 * with `startedAt: 0`, so these never have to survive a restart.
 */
const WALL_AT_BOOT = Date.now();
const MONO_AT_BOOT = performance.now();
const monoNow = () => WALL_AT_BOOT + (performance.now() - MONO_AT_BOOT);

const genCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);
const genToken = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 24);

/** How much of the room's past it remembers. Bounded — this is all in memory. */
const HISTORY_MAX = 120;
/** Window the mood is inferred over. */
const MOOD_WINDOW_MS = 10 * 60 * 1000;

/** @type {Map<string, any>} */
const rooms = (globalThis.__SW_ROOMS ??= new Map());

/** Empty session counters. Reset per process, not per room lifetime. */
function freshSession() {
  return {
    startedAt: Date.now(),
    messages: 0,
    reactions: 0,
    skips: 0,
    /** Every nickname seen this session, so "listeners" isn't just who's here now. */
    seen: new Set(),
    /** Rolling signal log for the mood. Trimmed to MOOD_WINDOW_MS on read. */
    recentReactions: [],
    recentSkips: [],
  };
}

// Rehydrate durable rooms once at startup.
if (!globalThis.__SW_ROOMS_LOADED) {
  globalThis.__SW_ROOMS_LOADED = true;
  const saved = loadSync("rooms", {});
  for (const [code, r] of Object.entries(saved)) {
    rooms.set(code, {
      code,
      name: r.name || `Room ${code}`,
      ownerToken: r.ownerToken || null,
      delegatedAdmin: r.delegatedAdmin || null,
      roomAvatarImageId:r.roomAvatarImageId||null,personalIdentity:r.personalIdentity||null,
      coHostMediaKeys: Array.isArray(r.coHostMediaKeys)?r.coHostMediaKeys:[],
      adminClaim: r.adminClaim || null,
      roomScoped: Boolean(r.roomScoped),
      discoverable: Boolean(r.roomScoped && r.discoverable),
      requireYoutubeCookie: Boolean(r.roomScoped && r.requireYoutubeCookie),
      inviteToken: r.inviteToken || genToken(),
      createdAt: r.createdAt || Date.now(),
      hostId: null,
      participants: new Map(),
      // ip -> { until, nick }. Never persisted (see persist() below) — a kick
      // ban resets on restart, consistent with this being a lightweight
      // moderation tool rather than a security system.
      bannedIps: new Map(),
      inviteOnly: r.approvalVersion === 1 ? Boolean(r.inviteOnly) : true,
      approvalVersion: 1,
      permissions: permissionState(r),
      flushOnHostLeave: true,
      playerMessage: r.playerMessage?.duration===null?r.playerMessage:null,
      // socketId -> { id, nick, requestedAt }. Live-session only — someone
      // waiting for approval when the server restarts just rejoins the queue.
      pending: new Map(),
      queue: (r.queue || []).map(normalizeItem),
      history: r.history || [],
      current: null,
      startedAt: 0,
      isPlaying: false,
      preparing: false,
      playToken: 0,
      pausedPosition: 0,
      watchVideo: false,
      volume: r.volume ?? 1,
      appearance: {...DEFAULT_APPEARANCE,...appearancePatch(r.appearance)},
      playlists: r.playlists || [],
      library: r.library || [],
      shuffle: r.shuffle || false,
      continuousPlay: r.continuousPlay ?? true,
      repeat: r.repeat || "off",
      skipVotes: new Set(),
      chat: [],
      photos: Array.isArray(r.photos) ? r.photos : [],
      mood: null,
      moodOverride: typeof r.moodOverride === "string" ? r.moodOverride : "",
      session: freshSession(),
    });
  }
}

/**
 * Bring a queue item up to the current shape. Rooms persisted before likes and
 * votes existed replay with neither, and every read site would otherwise need
 * its own `?? []`.
 */
function normalizeItem(t) {
  const upload=t.videoId?.startsWith("local_")?uploadedTrack(t.videoId):null;
  return {
    ...t,
    ...(typeof upload?.hasAudio==="boolean"?{hasAudio:upload.hasAudio}:{}),
    addedAt: t.addedAt ?? Date.now(),
    likes: Array.isArray(t.likes) ? t.likes : [],
    votes: Array.isArray(t.votes) ? t.votes : [],
  };
}

function persist() {
  const out = {};
  for (const [code, r] of rooms) {
    // Persist the upcoming list (with current re-queued at front so nothing is lost).
    const queue = [r.current, ...r.queue].filter(Boolean);
    out[code] = {
      code,
      name: r.name,
      ownerToken: r.ownerToken,
      delegatedAdmin: r.delegatedAdmin,
      coHostMediaKeys: r.coHostMediaKeys||[],roomAvatarImageId:r.roomAvatarImageId||null,personalIdentity:r.personalIdentity||null,
      adminClaim: r.adminClaim,
      roomScoped: r.roomScoped,
      discoverable: r.discoverable,
      requireYoutubeCookie: r.requireYoutubeCookie,
      inviteToken: r.inviteToken || (r.inviteToken = genToken()),
      createdAt: r.createdAt,
      permissions: permissionState(r),
      watchVideo: r.watchVideo,
      moodOverride: r.moodOverride,
      volume: r.volume,
      appearance: r.appearance,
      playlists: r.playlists,
      library: r.library,
      photos: r.photos,
      shuffle: r.shuffle,
      continuousPlay: r.continuousPlay ?? true,
      repeat: r.repeat,
      inviteOnly: r.inviteOnly,
      flushOnHostLeave: true,
      approvalVersion: 1,
      playerMessage:r.playerMessage?.duration===null?r.playerMessage:null,
      queue,
      history: r.history.slice(-HISTORY_MAX),
    };
  }
  saveDebounced("rooms", out);
}

// Persistent lists are instance references; unchecked lists stay room-local.
for(const room of rooms.values()){
 if(room.roomScoped)continue;
 for(const saved of savedPlaylists()){
  const i=room.playlists.findIndex(p=>p.id===saved.id);
  if(i<0)room.playlists.push(saved);else room.playlists[i]=saved;
 }
 if(personalSpace.enabled){room.appearance={...DEFAULT_APPEARANCE,...personalSpace.appearance};Object.assign(room,personalSpace.settings);
  if(room.appearance.backgroundImageId&&!inheritBackground(room.appearance.backgroundImageId,personalSpace.backgroundRoom,room.code)){room.appearance.background='none';room.appearance.backgroundImageId=null;}}
}

// Persist migrated invitation tokens so restart keeps shared links valid.
persist();

function persistPreference(io,room,key){
 rememberSettings(room,[key]);
 if(room.roomScoped)return;
 if(personalSpace.enabled)for(const target of rooms.values()){
  if(target===room||target.roomScoped)continue;target[key]=room[key];
  if(key==='inviteOnly')io.to(target.code).emit(EVENTS.ROOM_ACCESS_UPDATE,{inviteOnly:target.inviteOnly});else broadcastPlayback(io,target);
 }
}

export function createRoom(name, inviteOnly, roomScoped = false, { discoverable = false, requireYoutubeCookie = false } = {}) {
  let code;
  do { code = genCode(); } while (rooms.has(code));
  const ownerToken = roomScoped ? null : genToken();
  const room = {
    code,
    name: name || `Room ${code}`,
    ownerToken,
    roomScoped,
    discoverable: roomScoped && discoverable,
    requireYoutubeCookie: roomScoped && requireYoutubeCookie,
    delegatedAdmin: null,
    inviteToken: genToken(),
    createdAt: Date.now(),
    hostId: null,
    participants: new Map(),
    bannedIps: new Map(),
    inviteOnly: discoverable || (typeof inviteOnly === "boolean" ? inviteOnly : (!roomScoped && personalSpace.enabled) ? (personalSpace.settings.inviteOnly ?? true) : true),
    approvalVersion: 1,
    flushOnHostLeave: true,
    pending: new Map(),
    queue: [],
    history: [],
    current: null,
    startedAt: 0,
    isPlaying: false,
    preparing: false,
    playToken: 0,
    pausedPosition: 0,
    watchVideo: false,
    volume: (!roomScoped && personalSpace.enabled) ? (personalSpace.settings.volume ?? 1) : 1,
    appearance: (!roomScoped && personalSpace.enabled) ? {...DEFAULT_APPEARANCE,...personalSpace.appearance} : {...DEFAULT_APPEARANCE},
    playlists: roomScoped ? [] : savedPlaylists(),
    library: [],
    continuousPlay: (!roomScoped && personalSpace.enabled) ? (personalSpace.settings.continuousPlay ?? true) : true,
    shuffle: (!roomScoped && personalSpace.enabled) ? Boolean(personalSpace.settings.shuffle) : false,
    repeat: (!roomScoped && personalSpace.enabled) ? (personalSpace.settings.repeat || "off") : "off",
    skipVotes: new Set(),
    chat: [],
    photos: [],
    mood: null,
    session: freshSession(),
  };
  if(room.appearance.backgroundImageId&&!inheritBackground(room.appearance.backgroundImageId,personalSpace.backgroundRoom,code)){room.appearance.background='none';room.appearance.backgroundImageId=null;}
  rooms.set(code, room);
  persist();
  return room;
}

export function registerUpload(io, room, track) {
  room.library ??= [];
  if (!room.library.some(t => t.videoId === track.videoId)) room.library.push(track);
  persist();
  io.to(room.code).emit(EVENTS.LIBRARY_UPDATE, { playlists: room.playlists, library: room.library });
}

/** Safe room metadata for the authenticated admin console. */
export function listRoomSummaries() {
  return [...rooms.values()].sort((a, b) => b.createdAt - a.createdAt).map(room => ({
    code: room.code,
    name: room.name,
    listeners: [...room.participants.values()].filter(p => p.status !== "reconnecting").length,
    inviteOnly: Boolean(room.inviteOnly),
    hasRoomAdmin: Boolean(room.delegatedAdmin),
    roomScoped: Boolean(room.roomScoped),
    claimPending: Boolean(room.adminClaim),
    discoverable: Boolean(room.discoverable),
    matching: Boolean(canMatch(room)),
  }));
}

export function roomCount() {
  return rooms.size;
}

function canMatch(room) {
  return room.discoverable && room.pending.size < 25
    && [...room.participants.values()].some(p => p.isHost && p.status !== "reconnecting");
}

export function randomDiscoverableRoom() {
  const candidates = [...rooms.values()].filter(canMatch);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getRoom(code) {
  return rooms.get(code);
}

/* ------------------------------------------------------------------ state */

function queueWithStatus(room) {
  if (!room.queue.length) return [];
  const prefix = downloadContext(room).prefix;
  return room.queue.map((t) => ({ ...t, status: cacheStatus(t.videoId, prefix) }));
}

/** Where the current track is, in seconds, whether it's running or paused. */
function elapsed(room) {
  if (!room.current) return 0;
  if (room.preparing) return 0;
  if (room.syncHolding || monoNow() < (room.resumeAt || 0)) return room.pausedPosition;
  return room.isPlaying ? Math.max(0, (monoNow() - room.startedAt) / 1000) : room.pausedPosition;
}

/**
 * A summary of the session so far.
 *
 * Derived on read rather than kept as running totals: the inputs (history,
 * counters) are small and bounded, and a derived number can't drift out of
 * step with the thing it describes.
 */
function roomStats(room) {
  const s = room.session;
  const played = room.history;

  const listenedSec =
    played.reduce((n, h) => n + (h.playedSec || 0), 0) + elapsed(room);

  const byContributor = new Map();
  for (const h of played) {
    if (!h.addedBy) continue;
    byContributor.set(h.addedBy, (byContributor.get(h.addedBy) || 0) + 1);
  }
  let topContributor = null;
  for (const [nick, count] of byContributor) {
    if (!topContributor || count > topContributor.count) topContributor = { nick, count };
  }

  let mostLiked = null;
  for (const h of played) {
    const likes = h.likes?.length || 0;
    if (likes > 0 && (!mostLiked || likes > mostLiked.likes)) {
      mostLiked = { title: h.title, artist: h.artist, thumbnail: h.thumbnail, likes };
    }
  }

  return {
    since: s.startedAt,
    songsPlayed: played.length,
    listenedSec: Math.round(listenedSec),
    listeners: s.seen.size,
    hereNow: [...room.participants.values()].filter((p) => p.status !== "reconnecting").length,
    messages: s.messages,
    reactions: s.reactions,
    skips: s.skips,
    topContributor,
    mostLiked,
  };
}

/**
 * What the room feels like right now.
 *
 * Rule-based on purpose — see MOODS. The signals are all rates over the last
 * ten minutes so a burst an hour ago doesn't hold the room hostage.
 */
function moodFor(room) {
  const now = Date.now();
  const cutoff = now - MOOD_WINDOW_MS;
  const mins = MOOD_WINDOW_MS / 60000;

  const reactions = room.session.recentReactions.filter((r) => r.ts >= cutoff);
  const skips = room.session.recentSkips.filter((ts) => ts >= cutoff);
  const chats = room.chat.filter((m) => !m.system && m.ts >= cutoff);
  const recentTracks = room.history.slice(-5);

  const hearts = reactions.filter((r) => r.emoji === "❤️").length;

  const signals = {
    reactionRate: reactions.length / mins,
    chatRate: chats.length / mins,
    skipRate: skips.length / mins,
    heartShare: reactions.length ? hearts / reactions.length : 0,
    avgTrackSec: recentTracks.length
      ? recentTracks.reduce((n, t) => n + (t.duration || 0), 0) / recentTracks.length
      : 0,
    hour: new Date().getHours(),
  };

  const hit = MOODS.find((m) => m.match(signals)) ?? MOODS[MOODS.length - 1];
  return { id: hit.id, emoji: hit.emoji, label: hit.label, why: hit.why };
}

/**
 * What a participant looks like on the wire.
 *
 * Whitelisted rather than spread, because everything on this object is walked
 * by the socket.io encoder before it goes out. Anything not JSON — a timer, a
 * socket, a stream — is a live crash rather than a stray field: the encoder
 * recurses through it looking for binary, and Node's internals are full of
 * circular references, so it never comes back.
 */
function publicParticipant(p) {
  return {
    id: p.id,
    nick: p.nick,
    isHost: p.isHost,
    isRoomOwner: Boolean(p.isRoomOwner),
    status: p.status,
    statusAt: p.statusAt,
    joinedAt: p.joinedAt,
    songsAdded: p.songsAdded,
    messages: p.messages,
    reactions: p.reactions,
    muted: p.muted,
    profile: p.profile,
  };
}

function publicState(room, socketId) {
  reconcileSync(null, room);
  const isHost = room.participants.get(socketId)?.isHost;
  return {
    code: room.code,
    isRoomOwner: Boolean(room.participants.get(socketId)?.isRoomOwner),
    permissions: permissionState(room),
    playerMessage:room.playerMessage&&(room.playerMessage.duration===null||Date.now()<room.playerMessage.sentAt+(room.playerMessage.duration||15000))?{...room.playerMessage,remainingMs:room.playerMessage.duration===null?null:Math.max(0,room.playerMessage.sentAt+(room.playerMessage.duration||15000)-Date.now())}:null,
    name: room.name,
    queue: queueWithStatus(room),
    participants: [...room.participants.values()].map(publicParticipant),
    history: room.history.slice(-HISTORY_MAX),
    stats: roomStats(room),
    mood: room.mood,
    ...syncFields(room),
    current: room.current,
    startedAt: room.startedAt,
    isPlaying: room.isPlaying,
    preparing: room.preparing,
    playbackRequester: room.preparing ? room.playbackRequester : null,
    playbackError: room.playbackError || null,
    pausedPosition: room.pausedPosition,
    watchVideo: Boolean(room.watchVideo),
    volume: room.volume,
    appearance: room.appearance,roomAvatarImageId:room.roomAvatarImageId||null,
    roomScoped: Boolean(room.roomScoped),
    discoverable: room.discoverable,
    persistentSpace: Boolean(memberSpace(room.personalIdentity)?.enabled||roomSpace(room)?.enabled),
    shuffle: room.shuffle,
    continuousPlay: room.continuousPlay !== false,
    repeat: room.repeat,
    serverNow: monoNow(),
    skipVotes: room.skipVotes.size,
    you: socketId,
    uploadToken: room.participants.get(socketId)?.uploadToken,
    playlists: room.playlists,
    library: room.library,
    aiDj: djEnabled() ? djName() : null,
    inviteOnly: room.inviteOnly,
    flushOnHostLeave: true,
    // Only the host's own snapshot carries the pending list — this function
    // has exactly one call site (JOIN), so there's no other leak surface.
    pending: isHost ? [...room.pending.values()] : [],
  };
}

function broadcastPending(io, room) {
  for(const member of room.participants.values())if(member.isHost&&member.status!=="reconnecting")io.to(member.id).emit(EVENTS.PENDING_UPDATE,{pending:[...room.pending.values()]});
}

/* -------------------------------------------------------------- broadcast */

function syncFields(room) {
  return { syncKey: room.syncKey || "", syncHolding: Boolean(room.syncHolding), resumeAt: room.resumeAt || 0,
    waitingFor: [...(room.syncWaiters?.keys() || [])].map(id => room.participants.get(id)?.nick).filter(Boolean) };
}
function reconcileSync(io, room) {
  // Each device buffers independently; readiness must never stop another listener.
  const wasHolding = room.syncHolding;
  clearTimeout(room.syncTimer);
  room.syncKey = room.current ? `${room.current.id}:${room.playToken}` : "";
  room.syncWaiters = new Map(); room.syncIgnored = new Set();
  room.syncHolding = false; room.resumeAt = 0;
  if (wasHolding && room.isPlaying) room.startedAt = monoNow() - room.pausedPosition * 1000;
}

const trackDeadlines = new WeakMap();
const BACKGROUND_RECONNECT_MS = 30 * 60 * 1000;
function cancelTrackDeadline(room) {
  clearTimeout(trackDeadlines.get(room)?.timer);
  trackDeadlines.delete(room);
}

function scheduleTrackEnd(io, room) {
  const duration = room.current?.duration;
  if (!room.isPlaying || room.preparing || !Number.isFinite(duration) || duration <= 0 || duration > 86400) {
    cancelTrackDeadline(room);
    return;
  }
  const key = `${room.syncKey}:${room.startedAt}:${duration}`;
  if (trackDeadlines.get(room)?.key === key) return;
  cancelTrackDeadline(room);
  const timer = setTimeout(() => {
    trackDeadlines.delete(room);
    if (io.konnectivityStopping || rooms.get(room.code)!==room || !room.isPlaying || room.preparing) return;
    if (elapsed(room) < duration) { scheduleTrackEnd(io, room); return; }
    void playNext(io, room, {fromEnd:true});
  }, Math.max(1, Math.ceil((duration - elapsed(room)) * 1000)));
  timer.unref?.();
  trackDeadlines.set(room,{key,timer});
}

function broadcastPlayback(io, room) {
  reconcileSync(io, room);
  scheduleTrackEnd(io, room);
  io.to(room.code).emit(EVENTS.PLAYBACK_UPDATE, {
    ...syncFields(room),
    current: room.current,
    startedAt: room.startedAt,
    isPlaying: room.isPlaying,
    preparing: room.preparing,
    playbackRequester: room.preparing ? room.playbackRequester : null,
    playbackError: room.playbackError || null,
    pausedPosition: room.pausedPosition,
    watchVideo: Boolean(room.watchVideo),
    volume: room.volume,
    shuffle: room.shuffle,
    continuousPlay: room.continuousPlay !== false,
    repeat: room.repeat,
    serverNow: monoNow(),
    skipVotes: room.skipVotes.size,
  });
}
function broadcastQueue(io, room) {
  io.to(room.code).emit(EVENTS.QUEUE_UPDATE, { queue: queueWithStatus(room) });
}
function broadcastParticipants(io, room) {
  io.to(room.code).emit(EVENTS.PARTICIPANTS_UPDATE, {
    participants: [...room.participants.values()].map(publicParticipant),
  });
}
function broadcastHistory(io, room) {
  io.to(room.code).emit(EVENTS.HISTORY_UPDATE, { history: room.history.slice(-HISTORY_MAX) });
}

/**
 * Stats change on nearly every event, and nobody needs them at 60Hz. One
 * broadcast per room per two seconds is plenty for a summary panel, and it
 * keeps a busy room from spending its bandwidth on its own scoreboard.
 */
const statsTimers = new Map();

/**
 * socket id → the timer holding that seat during the reconnect grace period.
 * Kept here and not on the participant, which is broadcast verbatim.
 */
const dropTimers = new Map();

function broadcastStats(io, room) {
  if (statsTimers.has(room.code)) return;
  statsTimers.set(
    room.code,
    setTimeout(() => {
      statsTimers.delete(room.code);
      io.to(room.code).emit(EVENTS.STATS_UPDATE, { stats: roomStats(room) });
    }, 2000)
  );
}

/**
 * Say whether the DJ is composing.
 *
 * Tracked per room so a late `false` from an abandoned call can't switch off an
 * indicator a newer call turned on, and cleared on a timer as a backstop: a
 * process that dies mid-generation would otherwise leave every client in the
 * room believing the DJ is still typing, with nothing left alive to say
 * otherwise.
 */
const djTypingTimers = new Map();
function djTyping(io, room, on) {
  clearTimeout(djTypingTimers.get(room.code));
  djTypingTimers.delete(room.code);
  if (on) {
    djTypingTimers.set(
      room.code,
      setTimeout(() => {
        djTypingTimers.delete(room.code);
        io.to(room.code).emit(EVENTS.DJ_TYPING, { typing: false, nick: djName() });
      }, 30_000)
    );
  }
  io.to(room.code).emit(EVENTS.DJ_TYPING, { typing: on, nick: djName() });
}

/** Recompute the mood, and tell the room only when it actually changed. */
function refreshMood(io, room) {
  const next = room.moodOverride ? {id:"custom",label:room.moodOverride,emoji:"✨",why:"Set by the room host"} : moodFor(room);
  if (room.mood?.id === next.id && room.mood?.label === next.label) return;
  room.mood = next;
  io.to(room.code).emit(EVENTS.MOOD_UPDATE, { mood: next });
}

/**
 * Append to the room log and broadcast it.
 *
 * A message is either something a person (or the DJ) said, or something that
 * happened. The second kind carries `kind` and usually `actor` so the client
 * can render it as an event — icon, avatar, timestamp — instead of parsing the
 * sentence back out of `text`. `text` stays authoritative either way: rooms
 * persisted before `kind` existed replay fine, they just render generically.
 */
function pushChat(io, room, msg, audience) {
  const entry = { id: crypto.randomUUID(), ts: Date.now(), ...msg, audience };
  room.chat.push(entry);
  if (room.chat.length > 200) {
    const oldest = room.chat.shift();
    room.chatReads?.delete(oldest.id);
  }
  if (entry.image) {
    room.photos = [...room.photos.slice(1 - ROOM_PHOTO_LIMIT), {
      id: entry.id, image: entry.image, nick: entry.nick, text: entry.text, ts: entry.ts, audience,
    }];
    persist();
  }
  const published = publicRoomEntry(entry);
  if (audience) {
    for (const participant of room.participants.values()) {
      if (canViewMedia(audience, participant)) io.to(participant.id).emit(EVENTS.CHAT_NEW, published);
    }
  } else {
    io.to(room.code).emit(EVENTS.CHAT_NEW, published);
  }
  return entry;
}

// Warm a track and stream its download progress to the room.
function warm(io, room, videoId) {
  if (!videoId.startsWith("local_") && (room.watchVideo || needsYoutubeCookie(room, videoId))) return;
  prefetchAudio(videoId, (pct) => {
    io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId, percent: pct });
  }, room);
}

async function queueRecommendation(io,room){
 if(!room.continuousPlay||room.queue.length)return;
 if(room.autoplayPromise)return room.autoplayPromise;
 const seed=room.current||room.history?.at(-1),query=seed?.artist||room.moodOverride||'popular music';
 room.autoplayPromise=(async()=>{let timeout;try{const candidates=await Promise.race([searchSongs(query,18),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error("Recommendation timed out")),12000);})]);if(rooms.get(room.code)!==room||!room.continuousPlay||room.queue.length)return;const seen=new Set([room.current?.videoId,...(room.history||[]).slice(-30).map(t=>t.videoId)]);const available=candidates.filter(t=>t?.videoId&&!seen.has(t.videoId));const chosen=available[Math.floor(Math.random()*available.length)];if(chosen){enqueueMany(io,room,[chosen],'Autoplay');pushChat(io,room,{system:true,kind:'queued',text:`Autoplay added “${chosen.title}”`});}}catch{pushChat(io,room,{system:true,kind:'error',text:'Similar songs are unavailable right now. Add a song or retry autoplay.'});}finally{clearTimeout(timeout);room.autoplayPromise=null;}})();
 return room.autoplayPromise;
}

// Pull the next track off the queue — random position when shuffle is on.
function pickNext(room) {
  if (!room.queue.length) return null;
  if (room.shuffle) {
    const i = Math.floor(Math.random() * room.queue.length);
    return room.queue.splice(i, 1)[0];
  }
  return room.queue.shift();
}

/**
 * File the track that just finished into the room's history.
 *
 * `skipped` is inferred rather than passed around: a track that leaves with
 * more than five seconds left on it did not end on its own, whoever cut it
 * short. The likes it collected travel with it, which is what makes "most
 * liked song" answerable at the end of a session.
 */
function recordHistory(io, room, { skipped }) {
  const t = room.current;
  if (!t) return;
  const playedSec = Math.max(0, Math.min(t.duration || 0, elapsed(room)));
  room.history.push({
    id: crypto.randomUUID(),
    videoId: t.videoId,
    isShort:t.isShort===true,
    title: t.title,
    artist: t.artist,
    thumbnail: t.thumbnail,
    art: t.art,
    duration: t.duration,
    addedBy: t.addedBy,
    likes: t.likes || [],
    playedAt: Date.now(),
    playedSec: Math.round(playedSec),
    skipped,
  });
  if (room.history.length > HISTORY_MAX) room.history.shift();
  if (skipped) {
    room.session.skips += 1;
    room.session.recentSkips.push(Date.now());
  }
  broadcastHistory(io, room);
  broadcastStats(io, room);
  refreshMood(io, room);
}

/**
 * How many tracks may fail back-to-back before the room stops trying.
 *
 * A failure is usually not about the track — a 403 from YouTube, an expired
 * cookie, a proxy pool that has run dry — so the next track fails the same
 * way, and the one after that. Advancing through a queue of them as fast as
 * yt-dlp can refuse is a spinning loop that writes a line of chat per attempt
 * and teaches the room nothing.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

async function playNext(io, room, { fromEnd = false, failed = false, selectedId, videoMode = Boolean(room.watchVideo), requester } = {}) {
  room.playbackError=null;
  room.skipVotes.clear();

  // Repeat-one: a track that ends on its own just replays (no re-cache needed).
  // An explicit skip (fromEnd=false) bypasses this and moves on.
  if (fromEnd && room.repeat === "one" && room.current) {
    recordHistory(io, room, { skipped: false });
    room.playToken++;
    room.startedAt = monoNow();
    room.isPlaying = true;
    room.preparing = false;
    broadcastPlayback(io, room);
    persist();
    return;
  }

  if (room.current) {
    // Five seconds of slack: a track that runs out doesn't always fire its
    // `ended` handler at exactly its stated duration.
    const left = (room.current.duration || 0) - elapsed(room);
    recordHistory(io, room, { skipped: !fromEnd && left > 5 });
  }

  // Repeat-all: send the track we're leaving to the back of the queue — but
  // only if we actually played it. A track that could not be fetched would
  // otherwise be re-queued to fail again, and with two such tracks the room
  // alternates between them forever.
  if (room.repeat === "all" && room.current && !failed) {
    room.queue.push({ ...room.current, likes: [], votes: [], addedAt: Date.now() });
  }

  if(!room.queue.length&&room.continuousPlay&&!selectedId){const token=room.playToken;await queueRecommendation(io,room);if(room.playToken!==token)return;}
  const next = selectedId ? room.queue.splice(room.queue.findIndex(t => t.id === selectedId), 1)[0] : pickNext(room);
  if (!next) {
    room.current = null;
    room.isPlaying = false;
    room.preparing = false;
    room.startedAt = 0;
    room.pausedPosition = 0;
    room.playToken++;
    broadcastQueue(io, room);
    broadcastPlayback(io, room);
    persist();
    return;
  }

  // Enter a "preparing" state: the track is current but the shared clock has
  // NOT started, so the progress bar stays put while the audio caches. A token
  // lets a later skip/track supersede this preparation.
  room.playbackError=null;
  const token = ++room.playToken;
  room.current = next;
  if(room.continuousPlay&&!room.queue.length)void queueRecommendation(io,room);
  room.playbackRequester = requester || next.addedBy || null;
  room.watchVideo=Boolean(videoMode) && !needsYoutubeCookie(room, next.videoId);
  room.isPlaying = false;
  room.preparing = true;
  room.startedAt = 0;
  room.pausedPosition = 0;
  touchCache(next.videoId, { title: next.title, artist: next.artist }, room);
  broadcastQueue(io, room);
  broadcastPlayback(io, room);
  persist();

  // Warm the following track in the background so it's ready when we advance.
  // Give the current track first claim on download capacity.

  // Fully cache the current track BEFORE starting playback.
  try {
    if (needsYoutubeCookie(room, next.videoId)) throw new Error(YOUTUBE_SETUP_MESSAGE);
    if (!(room.watchVideo && !next.videoId.startsWith("local_"))) await ensureAudio(next.videoId, (pct) => {
      if (room.playToken === token) {
        io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId: next.videoId, percent: pct });
      }
    }, true, room);
    for(const queued of room.queue)warm(io,room,queued.videoId);
  } catch (err) {
    if(room.playToken!==token)return;
    room.isPlaying=false;room.preparing=false;room.startedAt=0;room.pausedPosition=0;
    room.playbackError=String(err?.message||'The audio could not be prepared.').slice(0,700);
    pushChat(io,room,{system:true,kind:'error',text:`Playback paused for "${next.title}". ${room.playbackError} Retry or skip this track.`});
    broadcastQueue(io,room);broadcastPlayback(io,room);persist();return;
  }

  // A newer skip/vote started another track while we were caching — abandon.
  if (room.playToken !== token) return;

  // Audio is ready: start the shared clock now. A track only carries a gain
  // once it's been played and measured before — the first-ever spin plays
  // unnormalized rather than delaying the room's clock on a measurement.
  const gain = cachedGain(next.videoId, room);
  if (gain) next.gain = gain;
  // Consecutive, not cumulative: one bad track in an evening shouldn't count
  // toward a ceiling meant to catch a server that has stopped working.
  room.failStreak = 0;
  room.startedAt = monoNow();
  room.isPlaying = !(next.mediaType==="video"&&next.hasAudio===false&&!room.watchVideo);
  room.preparing = false;
  io.to(room.code).emit(EVENTS.DOWNLOAD_PROGRESS, { videoId: next.videoId, percent: 100 });
  broadcastQueue(io, room);
  broadcastPlayback(io, room);
  persist();

  if (djEnabled()) {
    // An LLM takes a second or two, and a room that has just changed track and
    // then sits silent reads as a DJ that has nothing to say. Say it's writing.
    djTyping(io, room, true);
    generateIntro(next, { mood: room.mood })
      .then((intro) => {
        if (intro) pushChat(io, room, { nick: djName(), dj: true, text: intro });
      })
      .finally(() => djTyping(io, room, false));
  } else {
    pushChat(io, room, {
      system: true,
      kind: "nowplaying",
      // Carried so the client can draw the cover instead of repeating the
      // title as prose in the middle of the conversation.
      track: { title: next.title, artist: next.artist, thumbnail: next.thumbnail },
      text: `Now playing: ${next.title} — ${next.artist}`,
    });
  }
}

/** Add a track to the back of the queue. Shared by people, the DJ and re-adds. */
function enqueue(io, room, track, addedBy) {
  const item = normalizeItem({ ...track, id: crypto.randomUUID(), addedBy, addedAt: Date.now() });
  room.queue.push(item);
  warm(io, room, item.videoId);
  broadcastQueue(io, room);
  persist();
  return item;
}

/**
 * Add several at once — one broadcast, one save, and only the front of the
 * batch pre-fetched.
 *
 * `enqueue` warms every track it adds, which is right for a single addition
 * and wrong for ten: that is ten concurrent downloads for tracks the room
 * won't reach for half an hour. The rest are fetched on demand when they reach
 * the front, which is the same path a prefetch that didn't finish already
 * takes.
 */
const BULK_WARM = 2;
/** Largest batch one person can add at once. Matches the link importer's cap. */
const MAX_BATCH = 2000;
function enqueueMany(io, room, tracks, addedBy) {
  const items = tracks.map((t) =>
    normalizeItem({ ...t, id: crypto.randomUUID(), addedBy, addedAt: Date.now() })
  );
  room.queue.push(...items);
  for (const item of items) warm(io, room, item.videoId);
  broadcastQueue(io, room);
  persist();
  return items;
}

async function handleDjRequest(io, room, text, requester) {
  // One try/finally around the whole thing. Every early return in here is a
  // normal outcome — the message wasn't a request, the search found nothing —
  // and an indicator that survives any of them stays on forever, which is a
  // worse lie than never showing one.
  djTyping(io, room, true);
  try {
    const queries = await interpretRequest(text, { mood: room.mood });
    if (!queries.length) return;

    // One search per query, in parallel. A query that finds nothing costs its
    // own slot and not the whole request — asking for ten and getting eight is
    // a better answer than asking for ten and getting an apology.
    const settled = await Promise.allSettled(queries.map((q) => searchSongs(q, 1)));
    const already = new Set(
      [room.current?.videoId, ...room.queue.map((t) => t.videoId)].filter(Boolean)
    );
    const found = [];
    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      const top = r.value[0];
      // Deduplicated against the queue as well as against itself: ten queries
      // for one mood tend to converge on the same few obvious records.
      if (!top || already.has(top.videoId)) continue;
      already.add(top.videoId);
      found.push(top);
    }
    if (!found.length || rooms.get(room.code)!==room || !room.participants.size) return;

    enqueueMany(io, room, found, djName());

    const first = found[0];
    const rest = found.length - 1;
    pushChat(io, room, {
      nick: djName(),
      dj: true,
      text:
        rest > 0
          ? `On it, ${requester} — queued ${found.length} tracks, starting with "${first.title}" by ${first.artist}.`
          : `On it, ${requester} — queuing "${first.title}" by ${first.artist}.`,
    });
    pushChat(io, room, {
      system: true,
      kind: "dj",
      actor: djName(),
      track: { title: first.title, artist: first.artist, thumbnail: first.thumbnail },
      text:
        rest > 0
          ? `${djName()} queued ${found.length} tracks`
          : `${djName()} queued ${first.title}`,
    });
    if (!room.current) playNext(io, room);
  } catch {
    /* ignore DJ failures */
  } finally {
    djTyping(io, room, false);
  }
}

// Use the same proxy trust policy for bans and HTTP rate limits.
function socketIp(socket) {
  return requestIp(socket.request);
}

const KICK_BAN_MS = 30 * 60 * 1000;

/**
 * Seat someone as a full participant — shared by a normal JOIN and an
 * approved pending request, which is the only reason this isn't just inlined
 * in the JOIN handler. `targetSocket` is deliberately a parameter rather than
 * the closure's own `socket`: an approval runs inside the *host's* handler,
 * acting on a different connection.
 */
function reconnectingSeat(room, socket, isOwner = false) {
  const token = cookieMap(socket.request)[`kn_member_${room.code}`];
  const seats = [...room.participants.values()].filter(member => member.status === "reconnecting");
  return seats.find(member => equalToken(member.uploadToken, token)) ||
    (isOwner ? seats.find(member => member.isRoomOwner && member.isHost) : undefined);
}

function seatParticipant(io, room, targetSocket, name, isHost, mediaIdentity) {
  // The Mac's music collection is available when either listener opens a new room.
  const library = new Map((room.library || []).map(t => [t.videoId, t]));
  if (!room.roomScoped) for (const track of allUploadedTracks()) library.set(track.videoId, track);
  room.library = [...library.values()];
  if (room.library.length && !room.playlists.some(p => p.name === "Our songs ♡")) {
    room.playlists.unshift({ id: crypto.randomUUID(), name: "Our songs ♡", tracks: [...room.library] });
  }
  persist();
  if (isHost && (!room.hostId||!room.participants.has(room.hostId))) room.hostId = targetSocket.id;

  // Someone dropping off wifi and coming back should not read to the room as
  // a departure and an arrival. If a seat is still being held for this name,
  // take it back — counters and join time included.
  const carried = reconnectingSeat(room, targetSocket, Boolean(targetSocket.data.isRoomOwner));
  if (carried) {
    clearTimeout(dropTimers.get(carried.id));
    dropTimers.delete(carried.id);
    room.participants.delete(carried.id);
  }

  room.participants.set(targetSocket.id, {
    id: targetSocket.id,
    uploadToken: carried?.uploadToken ?? crypto.randomUUID(),
    socialId: carried?.socialId ?? crypto.randomUUID(),
    mediaIdentity,
    profile: carried?.profile,
    nick: carried?.nick ?? name,
    isHost,
    isRoomOwner: Boolean(targetSocket.data.isRoomOwner),
    handedOffHost: Boolean(isHost && carried?.handedOffHost),
    status: "listening",
    statusAt: Date.now(),
    joinedAt: carried?.joinedAt ?? Date.now(),
    songsAdded: carried?.songsAdded ?? 0,
    messages: carried?.messages ?? 0,
    reactions: carried?.reactions ?? {},
    muted: carried?.muted ?? false,
  });
  const savedMember=memberSpace(mediaIdentity);
  const seated=room.participants.get(targetSocket.id);
  if(savedMember?.enabled){
    if(savedMember.profile){const profile=structuredClone(savedMember.profile);if(profile.imageId&&!inheritBackground(profile.imageId,savedMember.profileRoom||savedMember.backgroundRoom,room.code))profile.imageId=null;seated.profile=profile;}
    if(isHost&&room.participants.size===1&&!room.current){room.personalIdentity=mediaIdentity;room.appearance={...DEFAULT_APPEARANCE,...savedMember.appearance};Object.assign(room,savedMember.settings);for(const id of [room.appearance.backgroundImageId,room.roomAvatarImageId].filter(Boolean))inheritBackground(id,savedMember.backgroundRoom,room.code);room.playlists=structuredClone(savedMember.playlists||[]);room.library=structuredClone(savedMember.library||[]);refreshMood(io,room);}
  }
  if(isHost&&!savedMember&&!room.roomScoped&&personalSpace.enabled)saveMemberSpace(room,seated,true);
  room.session.seen.add(name);

  targetSocket.join(room.code);
  if (!room.mood) refreshMood(io, room);
  const member = room.participants.get(targetSocket.id);
  const chat = visibleRoomEntries(room.chat, member);
  const receipts = Object.fromEntries(chat.filter(entry => room.chatReads?.has(entry.id))
    .map(entry => [entry.id, room.chatReads.get(entry.id)]));
  targetSocket.emit(EVENTS.ROOM_STATE, { ...publicState(room, targetSocket.id), chat, receipts, photos: visibleRoomEntries(room.photos, member) });
  broadcastParticipants(io, room);
  broadcastStats(io, room);
  if (!carried) {
    pushChat(io, room, { system: true, kind: "joined", actor: name, text: `${name} joined` });
  }
  // Resume a persisted queue on first presence.
  if (!room.current && room.queue.length) playNext(io, room);
}

/* --------------------------------------------------------------- handlers */

function endRoomSession(io, room) {
  cancelTrackDeadline(room);
  const message = "The host left and ended this session.";
  if (!room.roomScoped) return deleteRoom(io, room, message);
  endRoomCall(io, room, message);
  clearRoomSocial(room.code);
  clearTimeout(room.syncTimer);
  room.playToken++;
  room.isPlaying = false; room.preparing = false; room.current = null;
  room.startedAt = 0; room.pausedPosition = 0; room.playbackError = null;
  room.queue = []; room.chat = []; room.history = []; room.chatReads?.clear();
  room.playbackDeviceLog = []; room.skipVotes.clear(); room.mood = null;
  room.session = freshSession();
  room.playerMessage = null;
  io.to(room.code).emit("room:ended", { message });
  for (const id of [...room.participants.keys(), ...room.pending.keys()]) {
    clearTimeout(dropTimers.get(id)); dropTimers.delete(id);
    const seat = io.sockets.sockets.get(id);
    if (!seat) continue;
    seat.data.kicked = true;
    if (room.pending.has(id)) seat.emit(EVENTS.JOIN_DENIED, {});
    setTimeout(() => seat.disconnect(true), 150).unref?.();
  }
  room.participants.clear(); room.pending.clear(); room.hostId = null;
  persist();
}

/** End a room and revoke every socket and invitation for it. */
export function deleteRoom(io, room, message, deferSave = false) {
  cancelTrackDeadline(room);
  clearRoomCookies(room.code);
  clearAllPersonalCookies(room.code);
  room.playToken++;
  room.isPlaying = false;
  room.preparing = false;
  clearTimeout(room.syncTimer);
  clearRoomSocial(room.code);
  rooms.delete(room.code);
  if (!deferSave) persist();
  io.to(room.code).emit("room:ended", { message });
  for (const id of [...room.participants.keys(), ...room.pending.keys()]) {
    clearTimeout(dropTimers.get(id));
    dropTimers.delete(id);
    const socket = io.sockets.sockets.get(id);
    if (!socket) continue;
    socket.data.kicked = true;
    if (room.pending.has(id)) socket.emit("join:denied", {});
    setTimeout(() => socket.disconnect(true), 150).unref?.();
  }
  room.participants.clear();
  room.pending.clear();
  room.chat = [];
  room.queue = [];
  room.current = null;
}

export function deleteRooms(io, expectedCodes, all) {
  if ((all && expectedCodes.size !== rooms.size) || [...expectedCodes].some(code => !rooms.has(code))) {
    return null;
  }
  let deleted = 0;
  let failed = 0;
  for (const code of expectedCodes) {
    try {
      deleteRoom(io, rooms.get(code), "The superadmin deleted this room.", true);
      deleted++;
    } catch {
      failed++;
    }
  }
  if (deleted) persist();
  return { deleted, failed };
}

/** Provision a single-use invitation. Only its recipient gets the lasting key. */
export function issueRoomAdminClaim(room, enabled) {
  if (!room.roomScoped || room.delegatedAdmin) return null;
  const token = enabled ? genToken() : null;
  room.adminClaim = roomKeyHash(token);
  persist();
  return token;
}

function assignRoomAdmin(room) {
  const key = genToken();
  room.delegatedAdmin = roomKeyHash(key);
  room.adminClaim = null;
  persist();
  return key;
}

export function claimRoomAdmin(room, claim) {
  if (!room.roomScoped || room.delegatedAdmin || !equalToken(roomKeyHash(claim), room.adminClaim)) return null;
  return assignRoomAdmin(room);
}

export function createOwnedGroup(name, inviteOnly, options) {
  const room = createRoom(name, inviteOnly, true, options);
  return { room, credential: assignRoomAdmin(room) };
}

export function registerRoomHandlers(io, { authorizeJoin = () => false } = {}) {
  io.on("connection", (socket) => {
    let joinedCode = null;
    const originalOn=socket.on.bind(socket);
    socket.on=(event,handler)=>originalOn(event,(...args)=>{
      if((Object.values(EVENTS).includes(event)||SOCIAL_EVENTS.includes(event))){
        const payload=args[0];
        if(payload!==undefined && (payload===null || typeof payload!=="object" || Array.isArray(payload))) { socket.emit(EVENTS.ERROR,{message:"Invalid request"}); return; }
        if(args.length===0 || payload===undefined)args[0]={};
        const windowMs=10000,now=Date.now();socket.data.gate??={at:now,n:0};if(now-socket.data.gate.at>windowMs)socket.data.gate={at:now,n:0};
        if(++socket.data.gate.n>120){socket.emit(EVENTS.ERROR,{message:"Too many requests. Slow down."});return;}
      }
      if (event !== "disconnect" && socket.data.adminSeat && !adminRequest(socket.request)) {
        socket.disconnect(true);
        return;
      }
      const permission=permissionFor(event,args[0]);const room=rooms.get(joinedCode);const member=room?.participants.get(socket.id);
      if(member&&((permission&&!allowed(room,member,permission))||(event==='chat:send'&&[['text','chat'],['imageId','photos'],['videoId','videos'],['location','location']].some(([field,key])=>args[0]?.[field]&&!allowed(room,member,key))))){const error='The host has disabled this permission for listeners.';const ack=args.at(-1);if(typeof ack==='function')ack({error});socket.emit(EVENTS.ERROR,{message:error});return;}
      try{const result=handler(...args);if(result?.catch)result.catch(()=>socket.emit(EVENTS.ERROR,{message:"Request could not be completed"}));}catch{socket.emit(EVENTS.ERROR,{message:"Invalid request"});}
    });

    socket.on(EVENTS.JOIN, ({ code, nick, ownerToken, mediaKey }) => {
      if(typeof code!=="string" || !/^[A-Z0-9]{6}$/.test(code) || typeof nick!=="string" || !nick.trim() || nick.length>24)return socket.emit(EVENTS.ERROR,{message:"Invalid room or display name"});
      const room = rooms.get(code);
      if (!room) {
        socket.emit(EVENTS.ERROR, { message: "Room not found." });
        return;
      }
      room.inviteToken ||= genToken();
      if(!authorizeJoin(socket,room,ownerToken))return socket.emit(EVENTS.ERROR,{message:"Not authorized for this room"});
      if(joinedCode && joinedCode!==code)return socket.emit(EVENTS.ERROR,{message:"Disconnect before changing rooms"});
      if(room.participants.has(socket.id)||room.pending.has(socket.id))return;
      const isOwner = Boolean((!room.roomScoped && adminRequest(socket.request)) || roomAdminKey(room, ownerToken));
      const returning = reconnectingSeat(room, socket, isOwner);
      const hasHost = [...room.participants.values()].some(member => member.isHost);
      const isHost = Boolean(returning?.isHost || isOwner || room.coHostMediaKeys?.includes(roomKeyHash(mediaKey)));
      const ban = room.bannedIps.get(socketIp(socket));
      if (!isOwner && ban && ban.until > Date.now()) {
        socket.emit(EVENTS.ERROR, { message: "You've been removed from this room." });
        return;
      }
      const name = nick || "guest";
      const mediaIdentity = roomKeyHash(mediaKey);

      // An invite-only room parks a non-host joiner instead of seating them —
      // they get a live socket (so an approval can reach them) but no
      // participant record until the host says yes.
      if ((room.inviteOnly || room.discoverable) && !isHost && !returning) {
        if (room.discoverable && room.pending.size >= 25) return socket.emit(EVENTS.ERROR, { message: "This group has too many pending requests. Try again later." });
        joinedCode = room.code;
        room.pending.set(socket.id, { id: socket.id, nick: name, requestedAt: Date.now() });
        socket.data.mediaIdentity = mediaIdentity;
        socket.emit(EVENTS.JOIN_PENDING, {});
        broadcastPending(io, room);
        return;
      }

      joinedCode = room.code;
      socket.data.isRoomOwner = isOwner;
      socket.data.adminSeat = isOwner && !roomAdminKey(room, ownerToken);
      if (socket.data.adminSeat) {
        const stopWatching = onSessionRevoked(cookieMap(socket.request)[SESSION_COOKIE], () => socket.disconnect(true));
        socket.once("disconnect", stopWatching);
      }
      seatParticipant(io, room, socket, name, isHost, mediaIdentity);
    });

    socket.on(EVENTS.HOST_APPROVAL_SET, ({enabled} = {}) => {
      const room = host();
      if (!room || typeof enabled !== "boolean" || room.discoverable) return;
      room.inviteOnly = enabled;
      persistPreference(io,room,"inviteOnly");
      persist();
      io.to(room.code).emit(EVENTS.ROOM_ACCESS_UPDATE, {inviteOnly: enabled});
    });

    socket.on("group:discovery", ({ enabled } = {}, ack) => {
      const room = host();
      if (!room?.roomScoped || typeof enabled !== "boolean") return ack?.({ error: "Group admin access required." });
      room.discoverable = enabled;
      if (enabled) room.inviteOnly = true;
      persist();
      io.to(room.code).emit(EVENTS.ROOM_ACCESS_UPDATE, { inviteOnly: room.inviteOnly, discoverable: enabled });
      ack?.({ ok: true });
    });

    /** Let a pending joiner in. Mirrors a normal JOIN once seated. */
    socket.on(EVENTS.HOST_APPROVE, ({ id }) => {
      const room = host();
      if (!room) return;
      const req = room.pending.get(id);
      if (!req) return;
      room.pending.delete(id);
      const targetSocket = io.sockets.sockets.get(id);
      // They may have closed the tab while waiting — nothing to seat.
      if (targetSocket) seatParticipant(io, room, targetSocket, req.nick, false, targetSocket.data.mediaIdentity);
      broadcastPending(io, room);
    });

    socket.on(EVENTS.HOST_DENY, ({ id }) => {
      const room = host();
      if (!room || !room.pending.delete(id)) return;
      io.sockets.sockets.get(id)?.emit(EVENTS.JOIN_DENIED, {});
      broadcastPending(io, room);
    });

    const inRoom = () => rooms.get(joinedCode);
    const host = () => {
      const room = inRoom();
      return room && room.participants.get(socket.id)?.isHost ? room : null;
    };
    const controller = () => { const r = inRoom(); return r?.participants.has(socket.id) ? r : null; };
    const me = () => inRoom()?.participants.get(socket.id) ?? null;
    registerSocial(io,socket,inRoom);
    socket.on('permissions:set',(patch={},ack)=>{const room=host();if(!room)return ack?.({error:'Only the host can manage listener permissions.'});if(!patch||Array.isArray(patch)||typeof patch!=='object'||Object.entries(patch).some(([k,v])=>!Object.hasOwn(PERMISSIONS,k)||typeof v!=='boolean'))return ack?.({error:'Invalid permissions.'});room.permissions={...permissionState(room),...patch};for(const p of room.participants.values())if(!p.isHost&&!allowed(room,p,'calls')){leaveRoomCall(io,room,p.id);io.to(p.id).emit('call:ended',{message:'The host disabled listener calls.'});}reconcileSync(io,room);persist();io.to(room.code).emit('permissions:update',permissionState(room));broadcastPlayback(io,room);ack?.({ok:true});});
    socket.on(EVENTS.ROOM_POLICY,({flushOnHostLeave}={},ack)=>{const room=host();if(!room)return ack?.({error:'Only the host can change this setting.'});if(flushOnHostLeave!==true)return ack?.({error:'Rooms always end when the host leaves.'});room.flushOnHostLeave=true;persist();ack?.({ok:true});});
    socket.on(EVENTS.ROOM_LEAVE, ({ nextHostId } = {}, ack) => {
      const room = inRoom(), member = me();
      if (!room || !member) return ack?.({error:"You are not in this room."});
      let successor;
      if (nextHostId !== undefined) {
        if (!member.isHost) return ack?.({error:"Only the host can hand off the party."});
        successor = typeof nextHostId === "string" ? room.participants.get(nextHostId) : null;
        if (!successor || successor.id === member.id || successor.status === "reconnecting" ||
            !io.sockets.sockets.get(successor.id)?.connected) {
          return ack?.({error:"Choose a listener who is still connected."});
        }
        // Change the call and room roles before removing the old seat.
        member.isHost = false;
        successor.isHost = true;
        successor.handedOffHost = true;
        room.hostId = successor.id;
      }
      socket.data.kicked = true;
      if (member.isHost && ![...room.participants.values()].some(p=>p.id!==member.id&&p.isHost&&p.status!=="reconnecting")) { ack?.({ok:true}); endRoomSession(io, room); return; }
      leaveRoomCall(io, room, socket.id);
      room.participants.delete(socket.id);
      room.skipVotes.delete(socket.id);
      room.syncWaiters?.delete(socket.id);
      socket.leave(room.code);
      if (room.hostId === socket.id) room.hostId = [...room.participants.values()].find(p=>p.id!==socket.id&&p.isHost&&p.status!=="reconnecting")?.id||null;
      pushChat(io, room, {system:true,kind:successor?undefined:"left",actor:member.nick,text:successor
        ? `${member.nick} made ${successor.nick} host and left` : `${member.nick} left`});
      broadcastParticipants(io, room);
      broadcastPlayback(io, room);
      if (successor) broadcastPending(io, room);
      ack?.({ok:true});
      setTimeout(() => socket.disconnect(true), 150).unref?.();
    });
    socket.on(EVENTS.PLAYER_MESSAGE,({text,emoji,duration=15000,animation="float",clear=false}={},ack)=>{
      const room=controller(),p=me();if(!room||!p||p.muted)return ack?.({error:'Messaging is unavailable.'});
      if(clear===true){room.playerMessage=null;persist();io.to(room.code).emit('player:message',null);ack?.({ok:true});return;}
      if(!MESSAGE_ANIMATIONS.some(([id])=>id===animation))return ack?.({error:'Choose a supported animation.'});
      if(![15000,30000,null].includes(duration))return ack?.({error:'Choose 15 seconds, 30 seconds, or permanent.'});
      if(typeof text!=='string'||!text.trim()||text.length>100||!['❤️','💕','💖','✨','🥰','💙'].includes(emoji))return ack?.({error:'Enter a message of up to 100 characters and choose an emoji.'});
      if(Date.now()-(p.lastPlayerMessage||0)<3000)return ack?.({error:'Please wait a moment before sending another message.'});p.lastPlayerMessage=Date.now();
      room.playerMessage={id:crypto.randomUUID(),nick:p.nick,text:text.trim(),emoji,sentAt:Date.now(),duration,animation};persist();io.to(room.code).emit('player:message',room.playerMessage);ack?.({ok:true});
    });

    /**
     * Any deliberate action means the person is here and not typing, so it
     * clears whatever transient status they were showing. Saves the client
     * from having to send a "never mind" after every interaction.
     */
    const active = (room) => {
      const p = room?.participants.get(socket.id);
      if (!p || p.status === "listening" || p.status === "reconnecting") return;
      p.status = "listening";
      p.statusAt = Date.now();
      broadcastParticipants(io, room);
    };

    socket.on(EVENTS.PARTICIPANT_RENAME, ({ nick, targetId } = {}, ack) => {
      if (typeof ack !== "function") return;
      const room = controller();
      const actor = me();
      if (!room || !actor) return ack({ error: "Join the room first." });
      if (targetId && targetId !== socket.id && !actor.isHost) return ack({error:"Only a host can rename another listener."});
      const member = targetId ? room.participants.get(targetId) : actor;
      if (!member || member.status === "reconnecting") return ack({error:"That listener is unavailable."});
      const name = typeof nick === "string" ? nick.trim() : "";
      if (!name || name.length > 24 || /[\u0000-\u001f\u007f]/.test(name)) {
        return ack({ error: "Enter a display name of 1–24 characters." });
      }
      const taken = [...room.participants.values(), ...room.pending.values()]
        .some(person => person.id !== member.id && person.nick.toLowerCase() === name.toLowerCase());
      if (taken) return ack({ error: "That name is already in use." });
      member.nick = name;
      io.to(member.id).emit("participant:renamed", {nick:name});
      broadcastParticipants(io, room);
      ack({ nick: name });
    });

    socket.on(EVENTS.PARTICIPANT_PROFILE, ({ imageId, status } = {}, ack) => {
      const room = controller(), member = me();
      if (!room || !member || typeof status !== "string" || status.length > 100)
        return ack?.({error:"Enter a status of up to 100 characters."});
      const image = imageId ? chatImage(imageId, room.code, member) : null;
      if (imageId && (!image || imageAudience(imageId))) return ack?.({error:"Choose a room-visible profile image."});
      member.profile = { imageId: image?.id || null, status: status.trim() };rememberProfile(room,member);
      broadcastParticipants(io, room);
      ack?.({profile:member.profile});
    });
    socket.on(EVENTS.ROOM_NAME_SET, ({ name,imageId } = {}, ack) => {
      const room = controller();
      if (!room || me()?.status === "reconnecting") return ack?.({error:"Join the room first."});
      const value = typeof name === "string" ? name.trim() : "";
      if (!value || value.length > 15 || /[\u0000-\u001f\u007f]/.test(value))
        return ack?.({error:"Enter a room name of 1–15 characters."});
      if(imageId!==undefined){if(!allowed(room,me(),"appearance"))return ack?.({error:"The host has restricted room appearance changes."});if(imageId!==null&&(!chatImage(imageId,room.code)||imageAudience(imageId)))return ack?.({error:"Choose a room-visible group avatar."});room.roomAvatarImageId=imageId;rememberSettings(room,["roomAvatarImageId"]);}
      if (room.name !== value||imageId!==undefined) {
        room.name = value;
        persist();
        io.to(room.code).emit(EVENTS.ROOM_NAME_UPDATED, { name:value,imageId:room.roomAvatarImageId||null });
      }
      ack?.({name:value,imageId:room.roomAvatarImageId||null});
    });
    socket.on(EVENTS.MOOD_SET, ({ label } = {}, ack) => {
      const room = controller(), member = me();
      if (!room || !member || !allowed(room,member,"appearance")) return ack?.({error:"The host has restricted room appearance changes."});
      if (typeof label !== "string" || label.length > 40) return ack?.({error:"Enter a mood of up to 40 characters."});
      room.moodOverride = label.trim();rememberSettings(room,["moodOverride"]);
      refreshMood(io, room); persist(); ack?.({ok:true});
    });
    socket.on(EVENTS.ROOM_BUZZ, ({ targetId } = {}, ack) => {
      const room = host(), sender = me();
      if (!room || !sender) return ack?.({error:"Only the host can buzz listeners."});
      const now = Date.now();
      if (now - (sender.lastBuzz || 0) < 8000) return ack?.({error:"Wait a moment before buzzing again."});
      const targets = [...room.participants.values()].filter(p=>p.id!==socket.id&&p.status!=="reconnecting"&&(!targetId||targetId===p.id));
      if (!targets.length) return ack?.({error:"There are no available recipients."});
      sender.lastBuzz = now;
      notifyRoom(io, room, {kind:"buzz", text:`${sender.nick} buzzed you`, detail:""}, targets);
      ack?.({ok:true});
    });

    socket.on(EVENTS.PRESENCE_SET, ({ status }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p || !STATUSES.includes(status)) return;
      // `reconnecting` is the server's to assign — a client claiming it would
      // be claiming to be absent while plainly connected.
      if (status === "reconnecting" || p.status === status) return;
      p.status = status;
      p.statusAt = Date.now();
      broadcastParticipants(io, room);
    });

    const cleanTrack = (t) => {
      if (typeof t?.videoId !== "string") return null;
      if (t.videoId.startsWith("local_")) {
        const room = inRoom();
        if (room?.roomScoped && !room.library.some(track => track.videoId === t.videoId)) return null;
        const upload = uploadedTrack(t.videoId);
        return upload?.roomCode && upload.roomCode !== room?.code ? null : upload;
      }
      if (!/^[\w-]{11}$/.test(t.videoId)) return null;
      return { videoId: t.videoId, title: String(t.title || "Unknown").slice(0, 200),
        artist: String(t.artist || "Unknown").slice(0, 200),
        duration: Number.isFinite(t.duration) ? Math.max(0, t.duration) : 0,
        thumbnail: typeof t.thumbnail === "string" ? t.thumbnail : undefined,
        art: typeof t.art === "string" ? t.art : undefined, mediaType:t.mediaType==="video"?"video":"audio",isShort:t.isShort===true,aspectRatio:Number.isFinite(t.aspectRatio)&&t.aspectRatio>0&&t.aspectRatio<5?t.aspectRatio:undefined };
    };
    const libraryUpdate = (room) => {
      const ownSpace=memberSpace(room.personalIdentity);if(ownSpace?.enabled){ownSpace.playlists=structuredClone(room.playlists).map(list=>({...list,persistent:true}));ownSpace.library=structuredClone(room.library||[]);savePersonalSpace();}
      if(room.roomScoped){
        const space=roomSpace(room);if(space?.enabled){space.playlists=room.playlists.map(list=>({...list,persistent:true}));savePersonalSpace();}
        persist();
        io.to(room.code).emit(EVENTS.LIBRARY_UPDATE,{playlists:room.playlists,library:room.library});
        return;
      }
      for(const list of room.playlists.filter(p=>p.persistent))rememberPlaylist(list);
      for(const target of rooms.values()){
        if(target.roomScoped)continue;
        if(target!==room)for(const list of room.playlists.filter(p=>p.persistent)){
          const i=target.playlists.findIndex(p=>p.id===list.id),copy=structuredClone(list);
          if(i<0)target.playlists.push(copy);else target.playlists[i]=copy;
        }
        io.to(target.code).emit(EVENTS.LIBRARY_UPDATE,{playlists:target.playlists,library:target.library});
      }
      persist();
    };
    socket.on(EVENTS.PLAYLIST_PERSIST,({id,enabled}={},ack)=>{
      const room=controller(),list=room?.playlists.find(p=>p.id===id);
      if(room?.roomScoped)return ack?.({error:"This room keeps its playlists separate."});
      if(!list||typeof enabled!=="boolean")return ack?.({error:"Playlist not found"});
      if(enabled&&personalSpace.playlists.length>=100&&!personalSpace.playlists.some(p=>p.id===id))return ack?.({error:"Personal space holds up to 100 playlists"});
      list.persistent=enabled;rememberPlaylist(list);
      if(!enabled)for(const target of rooms.values()){const copy=target.playlists.find(p=>p.id===id);if(copy)copy.persistent=false;}
      libraryUpdate(room);ack?.({ok:true});
    });
    socket.on(EVENTS.PERSONAL_SPACE_SET,({enabled}={},ack)=>{
      const room=host();if(!room||typeof enabled!=="boolean")return ack?.({error:"Only a host can save room preferences."});
      if(!saveMemberSpace(room,me(),enabled)&&room.roomScoped)return ack?.({error:"Reconnect before saving preferences."});
      if(room.roomScoped){io.to(room.code).emit(EVENTS.PERSONAL_SPACE_UPDATE,{enabled});persist();return ack?.({ok:true});}
      personalSpace.enabled=enabled;
      if(enabled){rememberAppearance(room);rememberSettings(room);}
      savePersonalSpace();
      for(const target of rooms.values()){
        if(target.roomScoped)continue;
        if(enabled){target.appearance=structuredClone(room.appearance);Object.assign(target,personalSpace.settings);
          if(target.appearance.backgroundImageId)inheritBackground(target.appearance.backgroundImageId,room.code,target.code);
          io.to(target.code).emit(EVENTS.APPEARANCE_UPDATE,target.appearance);broadcastPlayback(io,target);
        }
        io.to(target.code).emit(EVENTS.PERSONAL_SPACE_UPDATE,{enabled});
      }
      persist();ack?.({ok:true});
    });
    socket.on(EVENTS.CONTROL_VIDEO_PLAY, ({ url } = {}, ack) => {
      const room = controller(); if (!room || typeof url !== "string") return;
      if (needsYoutubeCookie(room)) return ack?.({ error: YOUTUBE_SETUP_MESSAGE });
      let videoId;
      try {
        const parsed = new URL(url);
        if (!["https:","http:"].includes(parsed.protocol)) throw new Error();
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        if (host === "youtu.be") videoId = parsed.pathname.split("/")[1];
        else if (["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com"].includes(host)) videoId = parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
        if (!/^[\w-]{11}$/.test(videoId || "")) throw new Error();
      } catch { ack?.({ error: "Paste a valid YouTube video link" }); return; }
      room.watchVideo = true;
      const track = normalizeItem({ id: crypto.randomUUID(), videoId, title: "YouTube video", artist: "Watching together", duration: 0, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, addedBy: me().nick });
      room.queue.unshift(track); playNext(io, room, { selectedId: track.id, videoMode:true }); ack?.({ ok: true });
    });
    socket.on(EVENTS.CONTROL_VIDEO_METADATA, ({ videoId, duration, title } = {}) => {
      const room = controller();
      if (!room?.watchVideo || room.current?.videoId !== videoId || !Number.isFinite(duration) || duration <= 0 || duration > 86400 || room.current.duration > 0) return;
      room.current.duration = duration;
      if (typeof title === "string" && title.trim()) room.current.title = title.trim().slice(0, 200);
      broadcastPlayback(io, room); persist();
    });
    function logControl(room, action, track) {
      const actor = room.participants.get(socket.id)?.nick;
      if (!actor) return;
      pushChat(io, room, {
        system: true,
        actor,
        text: `${actor} ${action}${track ? ` “${track.title}”` : ""}`,
      });
      persist();
    }

    let lastSearchActivity = -Infinity;
    socket.on(EVENTS.SEARCH_ACTIVITY, () => {
      const room = controller();
      const now = monoNow();
      if (!room || now - lastSearchActivity < 10000) return;
      lastSearchActivity = now;
      logControl(room, "searched for music");
    });

    socket.on(EVENTS.CONTROL_PLAY_STATE, ({ playing } = {}) => {
      const room = controller();
      if (!room || !room.current || room.preparing || (playing && needsYoutubeCookie(room, room.current.videoId)) || typeof playing !== "boolean" || room.isPlaying === playing) return;
      const position = elapsed(room);
      room.pausedPosition = position; room.startedAt = monoNow() - position * 1000; room.isPlaying = playing;
      logControl(room, playing ? "resumed" : "paused", room.current);
      broadcastPlayback(io, room);
    });
    socket.on(EVENTS.CONTROL_VIDEO, async ({ enabled } = {}, ack) => {
      const room = controller();
      if (!room || typeof enabled !== "boolean") return;
      if (room.current && needsYoutubeCookie(room, room.current.videoId)) return ack?.({ error: YOUTUBE_SETUP_MESSAGE });
      if (room.watchVideo === enabled) { ack?.({ ok: true }); return; }
      const position = elapsed(room), playing = room.isPlaying || room.preparing;
      room.watchVideo = enabled;
      room.playbackRequester = me()?.nick || null;
      if(room.current?.hasAudio===false&&room.current.mediaType==="video"){room.pausedPosition=position;room.startedAt=monoNow()-position*1000;room.isPlaying=enabled;}
      if (room.current && !room.current.videoId.startsWith("local_")) {
        room.playbackError=null;
  const token = ++room.playToken;
        room.pausedPosition = position; room.isPlaying = false;
        room.preparing = !enabled;
        broadcastPlayback(io, room);
        if (!enabled) {
          try { await ensureAudio(room.current.videoId, undefined, true, room); }
          catch { if (token === room.playToken) { room.preparing = false; room.isPlaying = false; broadcastPlayback(io, room); } ack?.({ error: "Audio could not load. Try Watch together." }); return; }
        }
        if (token !== room.playToken) return;
        room.startedAt = monoNow() - position * 1000; room.isPlaying = playing; room.preparing = false;
      }
      logControl(room, enabled ? "switched to video" : "switched to audio");
      persist(); broadcastPlayback(io, room); ack?.({ ok: true });
    });
    socket.on(EVENTS.APPEARANCE_SET, (value,ack) => {
      const room=controller();if(!room)return ack?.({error:"Join the room before saving."});
      const patch=appearancePatch(value);if(!Object.keys(patch).length)return;
      if(patch.backgroundImageId && !chatImage(patch.backgroundImageId,room.code))return;
      if(patch.background==='photo' && !chatImage(patch.backgroundImageId||room.appearance?.backgroundImageId,room.code))return;
      room.appearance={...DEFAULT_APPEARANCE,...room.appearance,...patch};
      rememberAppearance(room);
      for(const target of rooms.values()){
        if(target!==room&&(room.roomScoped||target.roomScoped||!personalSpace.enabled))continue;
        if(target!==room){target.appearance=structuredClone(room.appearance);if(target.appearance.backgroundImageId)inheritBackground(target.appearance.backgroundImageId,room.code,target.code);}
        io.to(target.code).emit(EVENTS.APPEARANCE_UPDATE,target.appearance);
      }
      persist();ack?.({ok:true,appearance:room.appearance});
    });
    let volumeActivity;
    socket.on(EVENTS.CONTROL_VOLUME, ({ volume } = {}) => {
      const room = controller();
      if (!room || !Number.isFinite(volume)) return;
      const previous = room.volume;
      const next = Math.max(0, Math.min(1, volume));
      if (previous === next) return;
      const start = volumeActivity?.start ?? previous;
      clearTimeout(volumeActivity?.timer);
      volumeActivity = { start, timer: setTimeout(() => {
        volumeActivity = undefined;
        if (controller() !== room || next === start) return;
        logControl(room, `${next > start ? "raised" : "lowered"} the volume to ${Math.round(next * 100)}%`);
      }, 400) };
      room.volume = next;
      persistPreference(io,room,"volume");
      broadcastPlayback(io, room);
      persist();
    });
    socket.on(EVENTS.PLAYLIST_ADD_TRACK, ({ id, track } = {}, ack) => {
      const room = controller(), list = room?.playlists.find(p => p.id === id), clean = cleanTrack(track);
      if (!list || !clean) { ack?.({ error: "Playlist or song not found" }); return; }
      if (list.tracks.length >= 2000) { ack?.({ error: "Playlist limit is 2,000 songs" }); return; }
      if (!list.tracks.some(t => t.videoId === clean.videoId)) list.tracks.push(clean);
      libraryUpdate(room); ack?.({ ok: true, id });
    });
    socket.on(EVENTS.PLAYLIST_REMOVE_TRACK, ({ id, videoId } = {}, ack) => {
      const room = controller(), list = room?.playlists.find(p => p.id === id);
      if (!list) { ack?.({ error: "Playlist not found" }); return; }
      list.tracks = list.tracks.filter(t => t.videoId !== videoId);
      libraryUpdate(room); ack?.({ ok: true });
    });
    socket.on(EVENTS.PLAYLIST_REORDER, ({id,fromIndex,toIndex,expectedVideoId,expectedTitle}={},ack)=>{
      const room=controller(),list=room?.playlists.find(p=>p.id===id);
      if(!list||!Number.isInteger(fromIndex)||!Number.isInteger(toIndex)||fromIndex<0||toIndex<0||fromIndex>=list.tracks.length||toIndex>=list.tracks.length)return ack?.({error:"Invalid playlist position"});
      const track=list.tracks[fromIndex];
      if(track.videoId!==expectedVideoId||track.title!==expectedTitle)return ack?.({error:"Playlist changed. Please try the move again."});
      list.tracks.splice(fromIndex,1);list.tracks.splice(toIndex,0,track);libraryUpdate(room);ack?.({ok:true});
    });
    socket.on(EVENTS.PLAYLIST_QUEUE, ({ids}={},ack)=>{
      const room=controller(),p=me();
      if(!room||!p||!Array.isArray(ids)||!ids.length||ids.length>100)return ack?.({error:"Choose at least one playlist"});
      const chosen=[...new Set(ids)].map(id=>room.playlists.find(list=>list.id===id));
      if(chosen.some(list=>!list))return ack?.({error:"A selected playlist no longer exists"});
      const tracks=chosen.flatMap(list=>list.tracks);
      if(!tracks.length||tracks.length>MAX_BATCH)return ack?.({error:"Queue between 1 and 2,000 songs at a time"});
      const items=enqueueMany(io,room,tracks,p.nick);p.songsAdded+=items.length;active(room);broadcastParticipants(io,room);broadcastStats(io,room);
      pushChat(io,room,{system:true,kind:"queued",actor:p.nick,count:items.length,text:`${p.nick} queued ${items.length} songs from ${chosen.length} playlists`});
      ack?.({ok:true,count:items.length,playlists:chosen.length});
      if(!room.current)playNext(io,room);
    });
    socket.on(EVENTS.PLAYLIST_SAVE, ({ id, name, tracks } = {}, ack) => {
      const room = controller();
      if (!room || typeof name !== "string" || !name.trim() || !Array.isArray(tracks)) {ack?.({error:"A playlist name and track list are required"});return;}
      const clean = tracks.slice(0, 2000).map(cleanTrack).filter(Boolean);
      let savedId = id;
      if (id) {
        const list = room.playlists.find(p => p.id === id);
        if (!list) return;
        Object.assign(list, { name: name.trim().slice(0, 80), tracks: clean });
      } else {
        if (room.playlists.length >= 100) {ack?.({error:"This room already has 100 playlists. Delete one before creating another."});return;}
        savedId = crypto.randomUUID();
        room.playlists.push({ id: savedId, name: name.trim().slice(0, 80), tracks: clean });
      }
      libraryUpdate(room);
      ack?.({ ok: true, id: savedId });
    });
    socket.on(EVENTS.PLAYLIST_RENAME, ({ id, name } = {}) => {
      const room = controller();
      const list = room?.playlists.find(p => p.id === id);
      if (!list || typeof name !== "string" || !name.trim()) return;
      list.name = name.trim().slice(0, 80);
      libraryUpdate(room);
    });
    socket.on(EVENTS.PLAYLIST_DELETE, ({ id } = {}) => {
      const room = controller();
      if (!room) return;
      if(!room.roomScoped&&personalSpace.playlists.some(p=>p.id===id)){
        personalSpace.playlists=personalSpace.playlists.filter(p=>p.id!==id);savePersonalSpace();
        for(const target of rooms.values()){if(target.roomScoped)continue;target.playlists=target.playlists.filter(p=>p.id!==id);io.to(target.code).emit(EVENTS.LIBRARY_UPDATE,{playlists:target.playlists,library:target.library});}
      }
      room.playlists = room.playlists.filter(p => p.id !== id);
      libraryUpdate(room);
    });
    socket.on(EVENTS.CONTROL_PLAY_NOW, ({ track, id, preferVideo } = {}) => {
      const room = controller();
      if (!room) return;
      const index = room.queue.findIndex(t => t.id === id);
      const item = index >= 0 ? room.queue.splice(index, 1)[0] : cleanTrack(track);
      if (!item) return;

      // Force this selection even with shuffle enabled; preserve the remaining queue.
      const selected = normalizeItem({ ...item, id: item.id || crypto.randomUUID(), addedBy: me().nick });
      room.queue.unshift(selected);
      logControl(room, "selected", selected);
      playNext(io, room, { selectedId: selected.id,videoMode:preferVideo===true });
    });
    socket.on(EVENTS.QUEUE_ADD, ({ track, preferVideo } = {}) => {
      const room = inRoom();
      const p = me();
      track = cleanTrack(track);
      if (!room || !p || !track) return;

      const item = enqueue(io, room, track, p.nick);
      p.songsAdded += 1;
      active(room);
      broadcastParticipants(io, room);
      broadcastStats(io, room);
      pushChat(io, room, {
        system: true,
        kind: "queued",
        actor: item.addedBy,
        track: { title: item.title, artist: item.artist, thumbnail: item.thumbnail },
        text: `${item.addedBy} queued ${item.title}`,
      });
      if (!room.current) playNext(io, room);
    });

    // A whole album or playlist in one go. One broadcast, one chat line, and
    // only the front of the batch pre-fetched (see enqueueMany).
    socket.on(EVENTS.QUEUE_ADD_MANY, ({ tracks, from } = {}) => {
      const room = inRoom();
      const p = me();
      if (!room || !p || !Array.isArray(tracks)) return;
      const clean = tracks.slice(0, MAX_BATCH).map(cleanTrack).filter(Boolean);
      if (!clean.length) return;
      const items = enqueueMany(io, room, clean, p.nick);
      p.songsAdded += items.length;
      active(room);
      broadcastParticipants(io, room);
      broadcastStats(io, room);
      const source = typeof from === "string" && from.trim() ? from.trim().slice(0, 80) : "";
      const label = source ? ` from ${source}` : "";
      pushChat(io, room, {
        system: true,
        kind: "queued",
        actor: p.nick,
        count: items.length,
        ...(source ? { from: source } : {}),
        track: { title: items[0].title, artist: items[0].artist, thumbnail: items[0].thumbnail },
        text: `${p.nick} queued ${items.length} track${items.length === 1 ? "" : "s"}${label}`,
      });
      if (!room.current) playNext(io, room);
    });

    socket.on(EVENTS.QUEUE_REMOVE, ({ id }) => {
      const room = controller();
      if (!room) return;
      room.queue = room.queue.filter((t) => t.id !== id);
      broadcastQueue(io, room);
      persist();
    });

    /** Appreciation. Costs nothing, changes nothing, and people want it. */
    socket.on(EVENTS.QUEUE_LIKE, ({ id }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p) return;
      const item = room.current?.id === id ? room.current : room.queue.find((t) => t.id === id);
      if (!item) return;
      item.likes = item.likes || [];
      const at = item.likes.indexOf(p.nick);
      if (at >= 0) item.likes.splice(at, 1);
      else {item.likes.push(p.nick);notifyRoom(io,room,{kind:"like",text:`${p.nick} liked a song`,detail:item.title,trackId:item.videoId});}
      active(room);
      broadcastQueue(io, room);
      broadcastPlayback(io, room);
      persist();
    });

    /**
     * A vote is a nudge up the queue, not just a number. One per person per
     * track, and it moves the track one place forward — so ten people wanting
     * the same song move it ten places, and a single enthusiast can't jump the
     * whole room. The count stays visible either way.
     */
    socket.on(EVENTS.QUEUE_VOTE, ({ id }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p) return;
      const i = room.queue.findIndex((t) => t.id === id);
      if (i < 0) return;
      const item = room.queue[i];
      item.votes = item.votes || [];
      if (item.votes.includes(p.nick)) return;
      item.votes.push(p.nick);
      if (i > 0) {
        room.queue.splice(i, 1);
        room.queue.splice(i - 1, 0, item);
      }
      active(room);
      broadcastQueue(io, room);
      persist();
    });

    socket.on(EVENTS.QUEUE_REORDER, ({ id, toIndex }) => {
      const room = controller();
      if (!room || typeof toIndex !== "number") return;
      const from = room.queue.findIndex((t) => t.id === id);
      if (from < 0) return;
      const to = Math.max(0, Math.min(room.queue.length - 1, Math.round(toIndex)));
      if (from === to) return;
      const [item] = room.queue.splice(from, 1);
      room.queue.splice(to, 0, item);
      broadcastQueue(io, room);
      persist();
    });

    const retryCurrent=()=>{const room=controller();if(!room?.current||!room.playbackError)return;const track=room.current;room.current=null;room.playbackError=null;room.queue=room.queue.filter(t=>t.id!==track.id);room.queue.unshift(track);void playNext(io,room,{selectedId:track.id,requester:me()?.nick});};
    socket.on(EVENTS.CONTROL_RETRY,retryCurrent);
    socket.on(EVENTS.CONTROL_REPLAY,(_={},ack)=>{const room=controller();if(!room?.current||room.preparing)return ack?.({error:'No ready media to replay.'});if(needsYoutubeCookie(room,room.current.videoId))return ack?.({error:YOUTUBE_SETUP_MESSAGE});room.playToken++;room.pausedPosition=0;room.startedAt=monoNow();room.resumeAt=0;room.playbackError=null;room.isPlaying=!(room.current.hasAudio===false&&!room.watchVideo);logControl(room,"replayed",room.current);broadcastPlayback(io,room);persist();ack?.({ok:true});});
    socket.on(EVENTS.CONTROL_SKIP, () => {
      const room = controller();
      if (!room) return;
      if (room.current) logControl(room, "skipped", room.current);
      playNext(io, room, { requester: me()?.nick });
    });

    socket.on(EVENTS.VOTE_SKIP, () => {
      const room = inRoom();
      if (!room || !me() || !room.current) return;
      room.skipVotes.add(socket.id);
      active(room);
      const need = Math.ceil(room.participants.size * SKIP_THRESHOLD);
      if (room.skipVotes.size >= need) {
        pushChat(io, room, { system: true, kind: "skipped", text: `Vote passed — skipping` });
        playNext(io, room);
      } else {
        broadcastPlayback(io, room);
      }
    });

    socket.on(EVENTS.CONTROL_PLAYPAUSE, () => {
      if(inRoom()?.playbackError){retryCurrent();return;}
      const room = controller();
      if (!room || !room.current || room.preparing) return;
      if (!room.isPlaying && needsYoutubeCookie(room, room.current.videoId)) return;
      if (room.isPlaying) {
        room.pausedPosition = elapsed(room);
        room.isPlaying = false;
      } else {
        room.startedAt = monoNow() - room.pausedPosition * 1000;
        room.isPlaying = true;
      }
      logControl(room, room.isPlaying ? "resumed" : "paused", room.current);
      broadcastPlayback(io, room);
    });

    socket.on(EVENTS.CONTROL_SEEK, ({ position }) => {
      const room = controller();
      if (!room || !room.current || room.preparing) return;
      if (!Number.isFinite(position)) return;
      position = Math.max(0, Math.min(room.current.duration || 0, position));
      room.startedAt = monoNow() - position * 1000;
      room.pausedPosition = position;
      room.resumeAt = 0;
      const seconds = Math.floor(position);
      const timestamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      logControl(room, `jumped to ${timestamp} in`, room.current);
      broadcastPlayback(io, room);
    });

    socket.on(EVENTS.TRACK_ENDED, ({ videoId, syncKey }) => {
      const room = controller();
      if (room && (!syncKey||syncKey===room.syncKey) && room.current && !room.preparing && room.isPlaying && !room.syncHolding && monoNow() >= (room.resumeAt || 0) && room.current.videoId === videoId && elapsed(room) >= room.current.duration - 2) {
        playNext(io, room, { fromEnd: true });
      }
    });

    socket.on(EVENTS.CONTROL_SHUFFLE, () => {
      const room = controller();
      if (!room) return;
      room.shuffle = !room.shuffle;
      if(room.shuffle)void queueRecommendation(io,room).then(()=>{if(!room.current&&room.queue.length)void playNext(io,room);});
      persistPreference(io,room,"shuffle");
      broadcastPlayback(io, room);
      persist();
    });

    socket.on("settings:reset", (_data,ack) => {
      const room=controller();if(!room||!allowed(room,me(),"appearance")){ack?.({error:"Room appearance and playback permission required."});return;}
      room.appearance={...DEFAULT_APPEARANCE};room.shuffle=false;room.repeat="off";room.continuousPlay=true;room.volume=1;
      rememberAppearance(room);rememberSettings(room);io.to(room.code).emit(EVENTS.APPEARANCE_UPDATE,room.appearance);broadcastPlayback(io,room);persist();ack?.({ok:true});
    });
    socket.on("control:continuous-play", (data,ack) => {
      const room=controller();if(!room){ack?.({error:"Playback permission required."});return;}
      if(typeof data?.enabled!=="boolean"){ack?.({error:"Choose on or off."});return;}
      room.continuousPlay=data.enabled;if(data.enabled&&room.current&&!room.queue.length)void queueRecommendation(io,room);persistPreference(io,room,"continuousPlay");broadcastPlayback(io,room);persist();ack?.({ok:true});
    });
    socket.on(EVENTS.CONTROL_REPEAT, () => {
      const room = controller();
      if (!room) return;
      const next = { off: "all", all: "one", one: "off" };
      room.repeat = next[room.repeat] ?? "all";
      persistPreference(io,room,"repeat");
      broadcastPlayback(io, room);
      persist();
    });

    /** Mute or unmute a participant's chat. The room stays visible to them either way. */
    socket.on('host:role-set',({id,enabled}={},ack)=>{const room=host(),sender=me();if(!room||!sender)return ack?.({error:'Only a host can manage hosts.'});const target=room.participants.get(id);if(!target||target.status==='reconnecting'||typeof enabled!=='boolean')return ack?.({error:'Choose an active listener.'});if(target.isRoomOwner&&!enabled)return ack?.({error:'The room owner remains a host.'});if(target.id===sender.id&&!enabled)return ack?.({error:'Ask another host to change your role.'});target.isHost=enabled;target.handedOffHost=enabled;room.coHostMediaKeys||=[];if(target.mediaIdentity){room.coHostMediaKeys=room.coHostMediaKeys.filter(key=>key!==target.mediaIdentity);if(enabled)room.coHostMediaKeys.push(target.mediaIdentity);}if(!room.hostId||!room.participants.get(room.hostId)?.isHost)room.hostId=[...room.participants.values()].find(p=>p.isHost)?.id||null;broadcastParticipants(io,room);broadcastPending(io,room);persist();ack?.({ok:true});});
    socket.on(EVENTS.HOST_MUTE, ({ id, muted }) => {
      const room = host();
      if (!room) return;
      const target = room.participants.get(id);
      if (!target) return;
      target.muted = Boolean(muted);
      broadcastParticipants(io, room);
    });

    /**
     * Remove someone from the room right now, and keep them out for a while.
     * There's no durable identity beyond a socket connection, so the ban keys
     * off IP rather than participant id — a fresh socket from the same
     * connection would otherwise rejoin instantly and undo the kick.
     */
    socket.on(EVENTS.HOST_KICK, ({ id }) => {
      const room = host();
      if (!room) return;
      const target = room.participants.get(id);
      if (!target || id === socket.id || target.isHost) return;

      const targetSocket = io.sockets.sockets.get(id);
      const ip = targetSocket ? socketIp(targetSocket) : null;
      if (ip) room.bannedIps.set(ip, { until: Date.now() + KICK_BAN_MS, nick: target.nick });

      room.participants.delete(id);
      // Their vote-to-skip has to go with them. The disconnect handler below
      // normally does this, but a kick deliberately short-circuits it — and a
      // vote left behind counts forever against a room that just got smaller,
      // which is how a skip passes with nobody having asked for it.
      room.skipVotes.delete(id);
      clearTimeout(dropTimers.get(id));
      dropTimers.delete(id);
      if (targetSocket) {
        targetSocket.data.kicked = true;
        targetSocket.emit(EVENTS.KICKED, {});
        targetSocket.disconnect(true);
      }
      pushChat(io, room, {
        system: true,
        kind: "kicked",
        actor: target.nick,
        text: `${target.nick} was removed by the host`,
      });
      broadcastParticipants(io, room);
      // The vote tally is carried on the playback payload, so removing a vote
      // has to say so or the room keeps showing the old "1/2".
      broadcastPlayback(io, room);
      broadcastStats(io, room);
    });

    socket.on(EVENTS.CHAT_READ, ({ ids } = {}) => {
      const room = controller();
      const reader = me();
      if (!room || !reader || !Array.isArray(ids) || ids.length > 30) return;
      room.chatReads ||= new Map();
      const updated = Object.create(null);
      for (const id of new Set(ids)) {
        if (typeof id !== "string") continue;
        const message = room.chat.find(item => item.id === id && !item.system && !item.dj);
        if (!message || (message.authorKey ? message.authorKey === (reader.mediaIdentity || reader.socialId) : message.nick === reader.nick) || !canViewMedia(message.audience, reader)) continue;
        const readers = room.chatReads.get(id) || [];
        if (readers.includes(reader.nick) || readers.length >= 50) continue;
        const next = [...readers, reader.nick];
        room.chatReads.set(id, next);
        updated[id] = next;
      }
      if (!Object.keys(updated).length) return;
      const entries = room.chat.filter(entry => Object.hasOwn(updated, entry.id));
      for (const member of room.participants.values()) {
        const visible = entries.filter(entry => canViewMedia(entry.audience, member));
        if (visible.length) io.to(member.id).emit(EVENTS.CHAT_RECEIPTS,
          Object.fromEntries(visible.map(entry => [entry.id, updated[entry.id]])));
      }
    });

    const chatIdentity = member => member.mediaIdentity || member.socialId;
    const publishChatUpdate = (room, entry) => {
      const reactions = entry.reactions || [];
      for (const member of room.participants.values()) {
        if (canViewMedia(entry.audience, member)) io.to(member.id).emit(EVENTS.CHAT_UPDATED,
          { id:entry.id, text:entry.text, editedAt:entry.editedAt, reactions, location:entry.location });
      }
    };
    socket.on(EVENTS.CHAT_LOCATION_UPDATE, ({ id, lat, lng, stop } = {}, ack) => {
      const room=controller(), member=me();
      const entry=room?.chat.find(message=>message.id===id);
      const pin=entry?.location;
      if (!member || !pin?.liveUntil || entry.authorKey!==chatIdentity(member))
        return ack?.({error:"This live location is unavailable."});
      const now=Date.now();
      if (stop===true) {
        pin.liveUntil=undefined;
        publishChatUpdate(room,entry);
        return ack?.({ok:true});
      }
      if (pin.liveUntil<=now || member.muted || !allowed(room,member,"location"))
        return ack?.({error:"Live location sharing has ended."});
      if (!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
        return ack?.({error:"Invalid location."});
      if (now-(pin.updatedAt||0)>=3000) {
        Object.assign(pin,{lat,lng,updatedAt:now});
        publishChatUpdate(room,entry);
      }
      ack?.({ok:true});
    });
    socket.on(EVENTS.CHAT_EDIT, ({ id, text } = {}, ack) => {
      const room = controller(), member = me();
      const entry = room?.chat.find(message=>message.id===id&&!message.system&&!message.dj);
      if (!entry || !member || member.muted || !allowed(room,member,"chat") || entry.authorKey!==chatIdentity(member))
        return ack?.({error:"You can edit your own messages."});
      if (typeof text!=="string"||!text.trim()||text.length>500) return ack?.({error:"Write up to 500 characters."});
      entry.text=text.trim(); entry.editedAt=Date.now();
      publishChatUpdate(room, entry); ack?.({ok:true});
    });
    socket.on(EVENTS.CHAT_REACT, ({ id, emoji } = {}, ack) => {
      const room=controller(), member=me();
      const entry=room?.chat.find(message=>message.id===id&&!message.system&&!message.dj);
      if (!entry || !member || member.muted || !allowed(room,member,"reactions") || !canViewMedia(entry.audience,member))
        return ack?.({error:"This message is unavailable."});
      if (!supportedEmoji(emoji)) return ack?.({error:"Choose an available reaction."});
      const key=chatIdentity(member);
      entry.emojiVotes ||= {};
      const votes=entry.emojiVotes[emoji] ||= [];
      const at=votes.indexOf(key);
      if (at>=0) votes.splice(at,1); else if(votes.length<100) votes.push(key);
      entry.reactions=Object.entries(entry.emojiVotes).map(([emoji, members])=>({emoji,count:members.length})).filter(x=>x.count);
      publishChatUpdate(room,entry); ack?.({ok:true});
    });
    socket.on(EVENTS.CHAT_SEND, ({ text, imageId, videoId, location, replyTo, gifId, gif: submittedGif } = {}, ack) => {
      const room = inRoom();
      const p = me();
      // A pending (not-yet-approved) socket has a room but no seat — an
      // invite-only room's whole point is gating this.
      if (!room || !p || p.muted) { ack?.({ error: "Chat is unavailable" }); return; }
      const image = typeof imageId === "string" ? chatImage(imageId, room.code, p) : null;
      if (imageId && !image) { ack?.({ error: "Image not found in this room" }); return; }
      const video=typeof videoId==='string'?chatVideo(videoId,room.code,p):null;
      if(videoId&&!video){ack?.({error:'Video not found in this room'});return;}
      const audience = (image && imageAudience(image.id)) || (video && videoAudience(video.id));
      if (audience && (audience.owner !== p.mediaIdentity || !allowed(room,p,"privateMedia") || (image && video) || location)) {
        return ack?.({ error: "You can share one private attachment per message." });
      }
      const gif = submittedGif ? selectedGiphy(submittedGif) : gifId ? selectedGif(gifId) : null;
      if ((submittedGif || gifId) && (!gif || !allowed(room,p,"photos") || audience)) return ack?.({error:"Choose a GIF available to everyone in the room."});
      let pin=null;
      if(location){const lat=location.lat,lng=location.lng;if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){ack?.({error:'Invalid location'});return;}pin={lat,lng,label:typeof location.label==='string'?location.label.trim().slice(0,120):'Shared location',
        ...(location.live===true?{liveUntil:Date.now()+15*60*1000,updatedAt:Date.now()}:{} )};}
      if (!(typeof text === "string" && text.trim()) && !image && !video && !pin && !gif) return;
      const nick = p.nick;
      const clean = typeof text === "string" ? text.trim().slice(0, 500) : "";
      const reply = replyTo ? room.chat.find(entry=>entry.id===replyTo&&!entry.system&&canViewMedia(entry.audience,p)) : null;
      if (replyTo && (!reply || reply.audience)) return ack?.({error:"Replies to private media are unavailable."});
      p.messages += 1;
      room.session.messages += 1;
      active(room);
      const entry = pushChat(io, room, { nick, senderId:p.id, authorKey:chatIdentity(p), text: clean, ...(gif?{gif}:{}), ...(reply?{reply:{id:reply.id,nick:reply.nick,text:reply.text.slice(0,100)}}:{}), ...(image ? { image } : {}),...(video?{video}:{}),...(pin?{location:pin}:{}) }, audience);
      ack?.({ ok: true, id:entry.id, liveUntil:pin?.liveUntil });
      broadcastStats(io, room);
      refreshMood(io, room);
      // "/dj <request>" (or any message when the DJ is on) can enqueue music.
      if (!audience && djEnabled()) {
        const m = clean.match(/^\/dj\s+(.+)/i);
        if (m) handleDjRequest(io, room, m[1], nick);
      }
    });

    // Ephemeral floating emoji — broadcast to everyone, never stored.
    socket.on(EVENTS.REACTION, ({ emoji }) => {
      const room = inRoom();
      const p = me();
      if (!room || !p || !supportedEmoji(emoji)) return;
      // Who reacted travels with it so the activity feed can attribute it.
      // Deliberately not written to room.chat: reactions are the one thing in
      // here that can arrive several times a second, and the log is replayed
      // to everyone who joins.
      io.to(room.code).emit(EVENTS.REACTION_NEW, { emoji, nick: p.nick, id: crypto.randomUUID() });

      room.session.reactions += 1;
      room.session.recentReactions.push({ ts: Date.now(), emoji });
      if (room.session.recentReactions.length > 400) room.session.recentReactions.shift();
      p.reactions[emoji] = (p.reactions[emoji] || 0) + 1;
      broadcastStats(io, room);
      refreshMood(io, room);
    });

    let deviceReport;
    socket.on(EVENTS.PLAYBACK_DEVICE_REPORT, ({ key, state, position, audioEnabled } = {}) => {
      const room = controller();
      const member = me();
      if (member && typeof audioEnabled === "boolean") member.audioEnabled = audioEnabled;
      if (!room?.current || !member || key !== room.syncKey ||
          !["checking", "playing", "buffering", "stopped", "blocked", "interrupted", "error", "casting"].includes(state) ||
          !Number.isFinite(position) || position < 0 || position > 86400) return;
      const now = Date.now();
      if (deviceReport?.key === key && now - deviceReport.at < 500) return;
      const prior = member.playbackDevice;
      deviceReport = { key, state, position, at: now, video: Boolean(room.watchVideo) };
      member.playbackDevice = deviceReport;
      if (state !== "checking" && (prior?.key !== key || prior?.state !== state || prior.video !== deviceReport.video)) {
        room.playbackDeviceLog ||= [];
        room.playbackDeviceLog.push({ nick: member.nick, state, at: now, title: room.current.title });
        if (room.playbackDeviceLog.length > 30) room.playbackDeviceLog.shift();
      }
    });
    socket.on(EVENTS.PLAYBACK_HOST_STATUS, (_payload, ack) => {
      const room = controller();
      if (typeof ack !== "function") return;
      if (!room || !me()?.isHost) return ack({ error: "Host access required." });
      const now = Date.now();
      const listeners = [...room.participants.values()].map(member => {
        const report = member.playbackDevice;
        const fresh = report && report.key === room.syncKey && report.video === Boolean(room.watchVideo) && now - report.at < 8000;
        const state = member.status === "reconnecting" ? "offline" :
          room.preparing ? "preparing" : !room.isPlaying ? "stopped" : fresh ? report.state : "unknown";
        return { id: member.id, state, position: fresh ? report.position : null, audioEnabled: member.status === "reconnecting" ? null : member.audioEnabled ?? null };
      });
      ack({ listeners, log: room.playbackDeviceLog || [] });
    });

    socket.on(EVENTS.SYNC_REPORT, ({ rtt } = {}) => {
      const p = me(); if (p && Number.isFinite(rtt)) p.syncRtt = Math.max(0, Math.min(10000, rtt));
    });
    socket.on(EVENTS.SYNC_MEDIA, ({ key, ready, background = false, blocked = false } = {}) => {
      const room = controller(); if (!room || !room.current || room.preparing || typeof ready !== "boolean") return;
      reconcileSync(io, room);
      if (key !== room.syncKey || !allowed(room,me(),"sync")) return;
      if (background === true || blocked === true) { room.syncWaiters.delete(socket.id); room.syncIgnored.add(socket.id); }
      else if (ready) { room.syncWaiters.delete(socket.id); room.syncIgnored.delete(socket.id); }
      else if (!room.syncIgnored.has(socket.id)) room.syncWaiters.set(socket.id, true);
      broadcastPlayback(io, room);
    });
    socket.on(EVENTS.SYNC_PING, ({ t0 }) => {
      socket.emit(EVENTS.SYNC_PONG, { t0, serverNow: monoNow() });
    });

    socket.on("disconnect", () => {
      // A kick already removed the participant and posted its own system
      // message — the reconnect-grace flow below would otherwise still try to
      // hold a seat for someone who was just deliberately removed.
      if (socket.data.kicked) return;
      const room = inRoom();
      if (!room) return;
      // A pending request never became a participant — nothing below applies,
      // just drop the request so it doesn't wait forever for someone gone.
      if (room.pending.delete(socket.id)) {
        broadcastPending(io, room);
        return;
      }
      const p = room.participants.get(socket.id);
      room.skipVotes.delete(socket.id);
      if (room.hostId === socket.id) room.hostId = [...room.participants.values()].find(p=>p.id!==socket.id&&p.isHost&&p.status!=="reconnecting")?.id||null;
      if (!p) return;
      if (io.konnectivityStopping) return;
      const keepRoom = room.roomScoped || p.handedOffHost;
      if (p.isHost && !keepRoom && ![...room.participants.values()].some(other=>other.id!==p.id&&other.isHost&&other.status!=="reconnecting")) { endRoomSession(io, room); return; }

      // Hold the seat briefly. Phones suspend sockets when the screen locks and
      // a train goes through a tunnel; announcing a departure for either one is
      // noise, and the room can see they're reconnecting in the meantime.
      p.status = "reconnecting";
      if (room.syncWaiters?.delete(socket.id)) broadcastPlayback(io, room);
      p.statusAt = Date.now();
      // Beside the participant, never on it. See publicParticipant.
      const scheduleExpiry = (delay) => {
        const timer=setTimeout(() => {
          dropTimers.delete(socket.id);
          const still=room.participants.get(socket.id);
          if (!still || still.status!=="reconnecting") return;
          // Keep the host's seat while the listening session is still in use.
          // Only an explicit host exit ends a persistent group's session.
          if (still.isHost && (room.isPlaying || room.preparing ||
              [...room.participants.values()].some(member=>member.status!=="reconnecting"))) {
            scheduleExpiry(BACKGROUND_RECONNECT_MS);
            return;
          }
          room.participants.delete(socket.id);
          pushChat(io,room,{system:true,kind:"left",actor:still.nick,text:`${still.nick} left`});
          broadcastParticipants(io,room);
          broadcastStats(io,room);
        },delay);
        timer.unref?.();
        dropTimers.set(socket.id,timer);
      };
      scheduleExpiry(keepRoom ? BACKGROUND_RECONNECT_MS : RECONNECT_GRACE_MS);

      // Rooms are durable — do NOT delete when empty; just update presence.
      broadcastParticipants(io, room);
    });
  });
}
