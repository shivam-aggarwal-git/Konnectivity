"use client";
import PlaylistPicker from "./PlaylistPicker";
import type { Playlist } from "@/lib/types";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Check,
  Clock3,
  Disc,
  Link2,
  Loader2,
  Mic2,
  Music,
  Plus,
  Play,
  Search,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AlbumDetail, AlbumResult, ArtistResult, SearchType, Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { TrackRowSkeleton } from "@/components/ui/skeleton";
import { Cover, RowAction, TrackRow } from "@/components/ui/track-row";

/**
 * Finding music, in two shapes.
 *
 * `overlay` lives in the room's top bar and drops its results over the layout,
 * which is what lets the desktop centre column belong entirely to the queue.
 * `panel` is the same thing rendered inline for the phone's Add tab, where
 * there is no layout to float above. They share every behaviour below so a
 * result row looks and acts the same either way.
 *
 * Songs, albums and artists are three tabs over one endpoint. Albums and
 * artists are not playable in themselves — picking either drills into the
 * songs behind it, which is the only thing that can actually join a queue.
 */

const RECENT_KEY = "sw_recent_searches";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 350;

const TABS: { id: SearchType; label: string; icon: React.ElementType }[] = [
  { id: "songs", label: "Songs", icon: Music },
  { id: "albums", label: "Albums", icon: Disc },
  { id: "artists", label: "Artists", icon: Mic2 },
];

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Looks like something to resolve rather than words to search for. */
function looksLikeLink(s: string) {
  const t = s.trim();
  return /^https?:\/\/\S+$/i.test(t) || /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be|open\.spotify\.com)\/\S+$/i.test(t);
}

type LinkInfo = { source: string; total: number; missing: string[] };

function SearchPanel({
  roomCode,
  playlists, onPlaylistAdd, onCreatePlaylist,
  onPlayNow,
  onSearchActivity, onUpload,
  onAdd,
  onAddMany,
  queuedIds,
  library = [],
  variant = "panel",
  shortcut = false,
  openSignal = 0,
  className,
}: {
  roomCode: string;
  playlists?: Playlist[]; onPlaylistAdd?: (id: string, track: Track) => void; onCreatePlaylist?: (track?: Track) => void;
  onPlayNow?: (t: Track) => void;
  onSearchActivity?: () => void;
  onUpload?:()=>void;
  onAdd: (t: Track) => void;
  /** Add a batch in one go: one chat line, one broadcast. Falls back to `onAdd` per track. */
  onAddMany?: (tracks: Track[], from?: string) => void;
  /** videoIds already in the room, so a result can say so instead of duplicating. */
  queuedIds: Set<string>;
  library?: Track[];
  variant?: "overlay" | "panel";
  /** Bind ⌘K / Ctrl-K to this instance. Only ever set on one of them. */
  shortcut?: boolean;
  /** Bump to focus the field from elsewhere — the `/` shortcut does this. */
  openSignal?: number;
  className?: string;
}) {
  const [refresh,setRefresh]=useState(0);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | "local" | "youtube">("all");
  const [tab, setTab] = useState<SearchType>("songs");
  const [results, setResults] = useState<(Track | AlbumResult | ArtistResult)[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  /** When set, the list shows this album's tracks instead of search results. */
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [cursor, setCursor] = useState(-1);
  /** Set when the list on screen came from a pasted link rather than an album. */
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const isLink = looksLikeLink(q);

  // The room renders two of these — the desktop overlay and the phone's Add
  // tab — and both were emitting id="sw-search-results". Duplicate ids make
  // aria-controls ambiguous, so assistive tech resolves it to whichever came
  // first in the DOM regardless of which field has focus.
  const listId = useId();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  // Guards against a slow early request landing after a later, faster one.
  const runId = useRef(0);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!onSearchActivity || q.trim().length < 2 || (variant === "overlay" && !open)) return;
    const timer = setTimeout(onSearchActivity, 900);
    return () => clearTimeout(timer);
  }, [q, open, variant, onSearchActivity]);

  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [openSignal]);

  const remember = useCallback((term: string) => {
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* private mode — recents are a convenience, not state we need */
      }
      return next;
    });
  }, []);

  const run = useCallback(
    async (term: string, type: SearchType, { persist = false } = {}) => {
      const clean = term.trim();
      if (source === "local" || !clean) {
        setLoading(false);
        setResults([]);
        return;
      }
      const id = ++runId.current;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(clean)}&type=${type}`
        );
        const data = await res.json();
        if (runId.current !== id) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setCursor(-1);
        if (persist) remember(clean);
      } catch {
        if (runId.current === id) setResults([]);
      } finally {
        if (runId.current === id) setLoading(false);
      }
    },
    [remember, source]
  );

  /**
   * A pasted YouTube or Spotify link. One song shows as a single result; a
   * playlist or album opens as a list to review, the same view an album uses,
   * so "Add all" works the same way for both.
   */
  const runLink = useCallback(async (url: string) => {
    const id = ++runId.current;
    setLoading(true);
    setLinkError(null);
    setResults([]);
    setCursor(-1);
    try {
      const res = await fetch(`/api/link?room=${encodeURIComponent(roomCode)}&url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (runId.current !== id) return;
      if (!res.ok) {
        setLinkError(data?.message || "Couldn't open that link.");
      } else if (data.kind === "track" && data.track) {
        setResults([data.track]);
      } else if (data.kind === "list" && data.list) {
        const l = data.list;
        setAlbum({ albumId: `link:${url}`, title: l.title, artist: l.artist, year: null, thumbnail: l.thumbnail, tracks: l.tracks || [] });
        setLinkInfo({ source: l.source, total: l.total ?? l.tracks?.length ?? 0, missing: l.missing || [] });
      }
    } catch {
      if (runId.current === id) setLinkError("Couldn't reach the server to open that link.");
    } finally {
      if (runId.current === id) setLoading(false);
    }
  }, []);

  // Instant results: type and they arrive, no Enter required. Enter still works
  // and is what promotes a term into the recent list — pressing it is the
  // signal that the query was the one you meant.
  useEffect(() => {
    if (album) return;
    ++runId.current;
    setLoading(false);
    setResults([]);
    if (source === "local") return;
    setLinkInfo(null);
    setLinkError(null);
    if (looksLikeLink(q)) {
      // A paste arrives whole, so there's no typing to wait out.
      const id = setTimeout(() => runLink(q), 50);
      return () => clearTimeout(id);
    }
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      if (open || variant === "panel") { const suggested=setTimeout(()=>run(["soft acoustic love songs","Hindi indie evening songs","classic romantic duets","relaxing piano favourites","Bollywood unplugged music","feel good road trip songs"][refresh%6],"songs"),DEBOUNCE_MS);return()=>clearTimeout(suggested); }
      return;
    }
    const id = setTimeout(() => run(q, tab), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q, tab, album, source, run, runLink, open, variant,refresh]);

  // Overlay only: close on outside click.
  useEffect(() => {
    if (variant !== "overlay") return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !(e.target as Element)?.closest?.("[data-playlist-menu]")) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [variant]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const add = useCallback(
    (t: Track) => {
      if(q.trim().length>=2 && !looksLikeLink(q))remember(q.trim());
      onAdd(t);
      setAdded((a) => ({ ...a, [t.videoId]: true }));
    },
    [onAdd,q,remember]
  );

  const openAlbum = useCallback(async (a: AlbumResult) => {
    const id = ++runId.current;
    setLoading(true);
    setCursor(-1);
    try {
      const res = await fetch(`/api/album?id=${encodeURIComponent(a.albumId)}`);
      const data = await res.json();
      if (runId.current !== id) return;
      // Fall back to what the search result already told us, so a partial
      // response still shows a header rather than an error.
      setAlbum(data.album ?? { ...a, tracks: [] });
    } catch {
      if (runId.current === id) setAlbum({ ...a, tracks: [] });
    } finally {
      if (runId.current === id) setLoading(false);
    }
  }, []);

  /** The rows the arrow keys walk, whatever the current tab is showing. */
  const rows = useMemo(() => {
    if(q.trim().length<2 && !album){ const offset=library.length?(refresh*4)%library.length:0;const local=source==='youtube'?[]:[...library.slice(offset),...library.slice(0,offset)].slice(0,source==='local'?8:4);return [...local,...(source==='local'?[]:results.slice(0,6))]; }
    if (source === "youtube") return album ? album.tracks : results;
    if (album) return album.tracks;
    if (tab !== "songs" || q.trim().length < 2 || isLink) return results;
    const term = q.trim().toLowerCase();
    const local = library.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(term)).slice(0, 40);
    return source === "local" ? local : [...local, ...results];
  }, [album, results, tab, q, isLink, library, source,refresh]);

  const playResult = useCallback((track: Track) => { if(q.trim().length>=2&&!looksLikeLink(q))remember(q.trim()); onPlayNow?.(track); setOpen(false); }, [onPlayNow,q,remember]);

  const activate = useCallback(
    (i: number) => {
      const row = rows[i];
      if (!row) return;
      if ("videoId" in row) { if (onPlayNow) playResult(row as Track); else add(row as Track); }
      else if ("albumId" in row) openAlbum(row as AlbumResult);
      else if ("artistId" in row) {
        // An artist isn't playable, so picking one means "show me their songs".
        setQ((row as ArtistResult).name);
        setTab("songs");
        inputRef.current?.focus();
      }
    },
    [rows, add, openAlbum, onPlayNow, playResult]
  );

  const onFieldKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (cursor >= 0) {
        e.preventDefault();
        activate(cursor);
        return;
      }
      if (isLink) {
        if (source === "local") return;
        if (!album && !loading) runLink(q);
        return;
      }
      run(q, tab, { persist: true });
      return;
    }
    if (e.key === "Escape") {
      if (album) {
        setAlbum(null);
        return;
      }
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!rows.length) return;
      e.preventDefault();
      setCursor((c) => {
        const next =
          e.key === "ArrowDown"
            ? Math.min(rows.length - 1, c + 1)
            : Math.max(0, (c === -1 ? 0 : c) - 1);
        listRef.current
          ?.querySelectorAll("li[data-row]")
          [next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    }
    if (e.key === "Tab" && source !== "local" && !e.shiftKey && !album && rows.length === 0) {
      // Nothing to walk yet — Tab cycles the type instead of leaving the field.
      e.preventDefault();
      setTab((t) => TABS[(TABS.findIndex((x) => x.id === t) + 1) % TABS.length].id);
    }
  };

  const showResults = variant === "panel" || open;
  const [resultBounds,setResultBounds]=useState<{top:number;bottom:number}|null>(null);
  useEffect(()=>{
    if(!open||variant!=="overlay")return;
    const measure=()=>{
      const room=wrapRef.current?.closest('.studio-room');
      const toolbar=room?.querySelector('.room-media-toolbar')?.getBoundingClientRect();
      const header=wrapRef.current?.getBoundingClientRect();
      const footer=room?.querySelector('.kn-player-bar')?.getBoundingClientRect();
      const height=window.visualViewport?.height||window.innerHeight;
      setResultBounds({top:Math.max(header?.bottom||0,toolbar?.bottom||0)+4,bottom:Math.max(8,height-(footer?.top||height)+4)});
    };
    measure();const observer=new ResizeObserver(measure);
    const room=wrapRef.current?.closest('.studio-room');
    for(const el of [wrapRef.current,room?.querySelector('.kn-player-bar'),room?.querySelector('.room-media-toolbar')])if(el)observer.observe(el);
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
  },[open,variant]);
  const isEmptyQuery = q.trim().length < 2;

  const list = (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Search results"
      className={cn(
        "sw-scroll -mx-1 flex flex-col gap-1 overflow-y-auto px-1",
        variant === "overlay" ? "max-h-[min(60vh,26rem)]" : "min-h-0 flex-1"
      )}
    >
      {loading && rows.length === 0 && <TrackRowSkeleton count={4} />}

      {album && (
        <li className="mb-1 flex items-center gap-3 px-1 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAlbum(null)}
            aria-label="Back to results"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Cover src={album.thumbnail} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{album.title}</div>
            <div className="truncate text-xs text-muted">
              {linkInfo
                ? `${linkInfo.source} · ${album.tracks.length === linkInfo.total ? `${album.tracks.length} tracks` : `${album.tracks.length} of ${linkInfo.total} found`}`
                : `${album.artist}${album.year ? ` · ${album.year}` : ""} · ${album.tracks.length} tracks`}
            </div>
          </div>
          {album.tracks.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              className="gap-1"
              onClick={() => {
                const fresh = album.tracks.filter((t) => !queuedIds.has(t.videoId) && !added[t.videoId]);
                if (!fresh.length) return;
                if (onAddMany) {
                  onAddMany(fresh, linkInfo ? album.title : `${album.title} by ${album.artist}`);
                  setAdded((a) => ({ ...a, ...Object.fromEntries(fresh.map((t) => [t.videoId, true])) }));
                } else {
                  fresh.forEach(add);
                }
              }}
            >
              {album.tracks.some((t) => !queuedIds.has(t.videoId) && !added[t.videoId]) ? (
                <>
                  <Plus className="size-3.5" /> Add all
                </>
              ) : (
                <>
                  <Check className="size-3.5" /> Added
                </>
              )}
            </Button>
          )}
        </li>
      )}

      {album && linkInfo && linkInfo.missing.length > 0 && (
        <li className="mb-1 rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-muted">
          Couldn&rsquo;t find {linkInfo.missing.length} on YouTube Music:{" "}
          <span className="text-ink-soft">{linkInfo.missing.slice(0, 3).join(", ")}</span>
          {linkInfo.missing.length > 3 ? ` and ${linkInfo.missing.length - 3} more` : ""}.
        </li>
      )}

      {!album && source === "local" && isLink && <li className="py-4 text-sm text-muted">Switch to YouTube or All to open an online link.</li>}

      {!album && source !== "local" && isLink && linkError && !loading && (
        <li className="flex flex-1">
          <EmptyState icon={<Link2 className="size-5" />} title="Couldn't open that link" hint={linkError} />
        </li>
      )}

      {!album && recent.length > 0 && <li className="px-1 pb-2 pt-2"><div className="sw-label mb-2 text-[10px]"><Clock3 className="size-3"/>Recent searches<button type="button" aria-label="Clear all recent searches" className="ml-auto" onClick={()=>{setRecent([]);try{localStorage.removeItem(RECENT_KEY);}catch{}}}>Clear all</button></div><div className="flex flex-wrap gap-2">{recent.map(term=><div key={term} className="flex max-w-full items-center rounded-full border border-white/10 bg-white/5"><button type="button" className="truncate py-2 pl-3 pr-2 text-xs text-ink-soft" onClick={()=>{setQ(term);setAlbum(null);inputRef.current?.focus();}}>{term}</button><button type="button" aria-label={`Remove ${term} from search history`} title="Remove from history" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/10" onClick={()=>setRecent(prev=>{const next=prev.filter(v=>v!==term);try{localStorage.setItem(RECENT_KEY,JSON.stringify(next));}catch{}return next;})}><X size={12}/></button></div>)}</div></li>}
      {!album && isEmptyQuery && rows.length>0 && <li className="sw-label kn-suggestion-heading px-1 pb-1 pt-2 text-[10px]"><span>Suggestions for your next moment</span><button type="button" className="kn-suggestion-refresh" aria-label="Refresh suggestions" title="Show different suggestions" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15} className={loading?"animate-spin":""}/><span>Refresh</span></button></li>}

      {!album && isEmptyQuery && recent.length === 0 && rows.length === 0 && (
        <li className="flex flex-1">
          <EmptyState
            icon={<Search className="size-5" />}
            title={source === "local" ? "Search your local library" : "Search music"}
            hint={source === "local" ? "Find uploaded songs by title or artist. Switch to YouTube to search online." : "Search songs, albums and artists, or paste a YouTube or Spotify link."}
          />
        </li>
      )}

      {!album && !isLink && !isEmptyQuery && !loading && rows.length === 0 && (
        <li className="flex flex-1">
          <EmptyState
            icon={<Search className="size-5" />}
            title={`Nothing for “${q.trim()}”`}
            hint="Try the artist's name, or a line from the chorus."
          />
        </li>
      )}

      {rows.map((row, i) => {
        const selected = cursor === i;

        if ("videoId" in row) {
          const t = row as Track;
          const inRoom = queuedIds.has(t.videoId) || added[t.videoId];
          return (
            <TrackRow
              key={t.videoId}
              onClick={onPlayNow ? () => playResult(t) : undefined}
              art={t.thumbnail}
              title={t.title}
              artist={t.videoId.startsWith("local_") ? `${t.artist} · Local library` : t.artist}
              active={selected}
              option
              className="scroll-mt-2"
              trailing={<>{onPlaylistAdd && <PlaylistPicker track={t} playlists={playlists || []} onAdd={onPlaylistAdd} onCreate={() => onCreatePlaylist?.(t)} />}{onPlayNow ? <RowAction label={`Play ${t.title} now`} onClick={() => playResult(t)}><Play className="size-4" /></RowAction> : undefined}</>}
              actions={
                inRoom ? (
                  <span
                    className="grid size-8 place-items-center rounded-full text-[var(--success)]"
                    title="Already in the room"
                  >
                    <Check className="size-4" />
                  </span>
                ) : (
                  <RowAction label={`Add ${t.title}`} tone="accent" onClick={() => add(t)}>
                    <Plus className="size-4" />
                  </RowAction>
                )
              }
            />
          );
        }

        if ("albumId" in row) {
          const a = row as AlbumResult;
          return (
            <ResultRow
              key={a.albumId}
              selected={selected}
              thumbnail={a.thumbnail}
              title={a.title}
              sub={`${a.artist}${a.year ? ` · ${a.year}` : ""}`}
              badge="Album"
              onClick={() => openAlbum(a)}
            />
          );
        }

        const ar = row as ArtistResult;
        return (
          <ResultRow
            key={ar.artistId}
            selected={selected}
            thumbnail={ar.thumbnail}
            title={ar.name}
            sub="See their songs"
            badge="Artist"
            round
            onClick={() => {
              setQ(ar.name);
              setTab("songs");
              inputRef.current?.focus();
            }}
          />
        );
      })}
    </ul>
  );

  const field = (
    <div className="kn-search-field">
      <Search className="pointer-events-none size-4 shrink-0 text-muted" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          ++runId.current;
          setLoading(false);
          setQ(e.target.value);
          setAlbum(null);
        }}
        onFocus={() => {setOpen(true);if(!q.trim())setRefresh(n=>n+1);}} onClick={()=>{if(!q.trim())setRefresh(n=>n+1);}}
        onKeyDown={onFieldKey}
        placeholder={source === "local" ? "Search local library…" : source === "youtube" ? "Search YouTube Music…" : "Search local songs or YouTube…"}
        aria-label="Search music"
        role="combobox"
        aria-expanded={showResults}
        // Only claim to control the list while it's actually in the DOM — the
        // overlay unmounts its results when closed, and aria-controls pointing
        // at nothing is worse than not pointing at all.
        aria-controls={showResults ? listId : undefined}
        aria-autocomplete="list"
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
      />
      <div className="flex shrink-0 items-center gap-1">
        {onUpload&&<button type="button" aria-label="Upload music" title="Upload music"
          className="kn-search-upload" onClick={()=>{setOpen(false);onUpload();}}><Upload size={16}/></button>}
        {loading && <Loader2 className="size-4 animate-spin text-muted" />}
        {(
          <button
            disabled={!q}
            data-search-clear
            type="button"
            onClick={() => {
              ++runId.current;
              setLoading(false);
              setLinkInfo(null);
              setLinkError(null);
              setCursor(-1);
              setQ("");
              setResults([]);
              setAlbum(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            title="Clear search"
            className="grid size-8 place-items-center rounded-full bg-white/5 text-ink transition-colors duration-200 ease-[var(--ease)] hover:bg-white/10 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button type="button" aria-label="Refresh search" title="Refresh search and suggestions" disabled={loading} onClick={()=>{setAlbum(null);setOpen(true);setRefresh(n=>n+1);}} className="kn-search-refresh"><RefreshCw size={15} className={loading?"animate-spin":""}/></button>
        {shortcut && !q && !loading && (
          <Kbd className="pointer-events-none mr-1 hidden rounded-sm lg:inline-flex">⌘K</Kbd>
        )}
      </div>
    </div>
  );

  const tabs = (
    <div className="sw-seg mt-3" role="tablist" aria-label="Result type">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          data-active={tab === id}
          className="sw-seg-item"
          onClick={() => {
            setTab(id);
            setAlbum(null);
          }}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  const body = (
    <div id={listId}>
      <div className="sw-seg mt-2" role="group" aria-label="Search source">
        {([['all', 'All'], ['local', 'Local library'], ['youtube', 'YouTube']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={source === id} data-active={source === id} className="sw-seg-item" onClick={() => {
            ++runId.current; setLoading(false); setResults([]); setAlbum(null); setLinkInfo(null); setLinkError(null); setCursor(-1); setSource(id); if (id === 'local') setTab('songs');
          }}>{label}</button>
        ))}
      </div>
      {!isEmptyQuery && !album && !isLink && source !== "local" && tabs}
      <div className={cn(variant === "overlay" ? "mt-2" : "mt-4 flex min-h-0 flex-1 flex-col")}>
        {list}
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div ref={wrapRef} className={cn("relative", className)}>
        {field}
        {showResults && (
          <div style={resultBounds?{top:resultBounds.top,bottom:resultBounds.bottom}:undefined} className="kn-search-results sw-glass-strong sw-fade-in absolute inset-x-0 top-full z-50 mt-2 p-2">
            <div className="kn-search-results-heading"><strong>Search</strong><button type="button" aria-label="Close search results" onClick={()=>{setOpen(false);inputRef.current?.blur();}}><X size={18}/></button></div>
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0">{field}</div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  );
}

/** An album or artist hit. Same row anatomy as a track, different payload. */
function ResultRow({
  thumbnail,
  title,
  sub,
  badge,
  selected,
  round,
  onClick,
}: {
  thumbnail?: string;
  title: string;
  sub: string;
  badge: string;
  selected: boolean;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <li
      data-row
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "sw-row sw-rise group flex cursor-pointer items-center gap-3 p-2",
        selected && "sw-row-active"
      )}
    >
      <Cover src={thumbnail} size="sm" className={cn(round && "rounded-full")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
        {badge}
      </span>
    </li>
  );
}

/**
 * Memoised: the room re-renders four times a second to advance the progress
 * bar, and none of that touches this panel. Its props are all stable —
 * server state or callbacks the room holds with useCallback.
 */
export default memo(SearchPanel);
