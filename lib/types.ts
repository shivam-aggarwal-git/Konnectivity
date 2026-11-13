/**
 * Shapes shared between the room components. These mirror what lib/rooms.mjs
 * puts on the wire; keep the two in step.
 */

export type Status = { state: "cached" | "downloading" | "pending"; percent: number };

export type Track = {
  mediaType?:"audio"|"video";
  isShort?:boolean;
  aspectRatio?:number;
  hasAudio?:boolean;
  sourceName?:string;nameKey?:string;
  id?: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  /** Larger cover for the now-playing hero. Absent on pre-existing rooms. */
  art?: string;
  addedBy?: string;
  /** When it was queued. Absent on rooms persisted before the rich queue. */
  addedAt?: number;
  /** Nicknames — the identity model here is the name you typed on the way in. */
  likes?: string[];
  votes?: string[];
  status?: Status;
  /** Loudness-normalization multiplier (linear), applied client-side. 1 or absent = no change. */
  gain?: number;
};

/** What someone is doing. Everything but `reconnecting` is client-reported. */
export type PresenceStatus =
  | "listening"
  | "typing"
  | "queueing"
  | "voting"
  | "afk"
  | "reconnecting";

export type Participant = {
  id: string;
  nick: string;
  isHost: boolean;
  isRoomOwner?: boolean;
  status: PresenceStatus;
  statusAt: number;
  joinedAt: number;
  songsAdded: number;
  messages: number;
  /** emoji → how many times they've sent it. */
  reactions: Record<string, number>;
  /** Host has muted this participant's chat. */
  muted?: boolean;
  profile?: {imageId:string|null;status:string};
};

/** What happened, for system entries in the room log. */
export type SystemKind =
  | "joined"
  | "left"
  | "queued"
  | "nowplaying"
  | "skipped"
  | "dj"
  | "error"
  | "kicked";

export type RoomGif = {id:number|string;url:string;source:string;title:string;creator:string;license:string};

export type ChatMsg = {
  id: string;
  ts: number;
  nick?: string;
  text: string;
  privateMedia?: boolean;
  editedAt?: number;
  senderId?: string;
  gif?: RoomGif;
  reply?: {id:string;nick?:string;text:string};
  reactions?: {emoji:string;count:number}[];
  image?: { id: string; url: string; name: string };
  video?: { id: string; url: string; name: string; voice?: boolean };
  location?: {lat:number;lng:number;label:string;live?:boolean;liveUntil?:number;updatedAt?:number};
  system?: boolean;
  dj?: boolean;
  /** Present on system entries written after the activity feed shipped. */
  kind?: SystemKind;
  /** Who did it, for system entries that have a person behind them. */
  actor?: string;
  /** The track a `queued` / `nowplaying` / `dj` entry is about. */
  track?: { title: string; artist: string; thumbnail?: string };
  /** A batch `queued` entry: how many tracks, and the album or playlist they came from. */
  count?: number;
  from?: string;
};

export type RoomPhoto = Pick<ChatMsg, "id" | "nick" | "text" | "ts" | "privateMedia"> & {
  image: NonNullable<ChatMsg["image"]>;
};

/** Reactions are never persisted, so they only exist in the live session. */
export type ReactionEvent = { id: string; emoji: string; nick?: string; ts: number };

export type HistoryEntry = {
  isShort?:boolean;
  aspectRatio?:number;
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  art?: string;
  duration: number;
  addedBy?: string;
  likes: string[];
  playedAt: number;
  /** How much of it the room actually heard. */
  playedSec: number;
  skipped: boolean;
};

export type RoomStats = {
  since: number;
  songsPlayed: number;
  listenedSec: number;
  /** Everyone seen this session, not just who is here now. */
  listeners: number;
  hereNow: number;
  messages: number;
  reactions: number;
  skips: number;
  topContributor: { nick: string; count: number } | null;
  mostLiked: { title: string; artist: string; thumbnail?: string; likes: number } | null;
};

export type Mood = { id: string; emoji: string; label: string; why: string };

/** A non-host joiner waiting on the host to let them into an invite-only room. */
export type PendingRequest = { id: string; nick: string; requestedAt: number };

export type Playlist = { persistent?: boolean; id: string; name: string; tracks: Track[] };

export type Repeat = "off" | "one" | "all";

/* --- search ------------------------------------------------------------- */

export type SearchType = "songs" | "videos" | "albums" | "artists";

export type AlbumResult = {
  albumId: string;
  title: string;
  artist: string;
  year: number | null;
  thumbnail?: string;
};

export type ArtistResult = {
  artistId: string;
  name: string;
  thumbnail?: string;
};

export type AlbumDetail = AlbumResult & { tracks: Track[] };

export type RoomPlan={id:string;creatorId:string;canClose:boolean;by:string;title:string;venue:string;when:string;budget:number;closed:boolean;myResponse:string|null;responses:{nick:string;choice:string}[];suggestions:{id:string;nick:string;text:string}[]};
export type RoomPoll={id:string;creatorId:string;canClose:boolean;by:string;question:string;options:string[];counts:number[];total:number;myVote:number|null;closed:boolean};
export type CallInvitation={id:string;from:string;nick:string;video:boolean;expiresAt:number};
export type CallMember={id:string;nick:string;mic?:boolean;camera?:boolean;sharing?:boolean;isHost?:boolean};
export type SocialState={plans:RoomPlan[];polls:RoomPoll[];call:{members:CallMember[];max:number;invitation?:CallInvitation|null}};
