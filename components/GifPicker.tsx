"use client";

import {Search, X} from "lucide-react";
import { useEffect, useState } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Gif } from "@giphy/react-components";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { giphyMediaUrl } from "@/lib/giphy.mjs";
import type { RoomGif } from "@/lib/types";

const limit = 18;

type GifResult = Awaited<ReturnType<GiphyFetch["trending"]>>["data"][number];

function GifResults({ term, onSelect }: { term: string; onSelect: (gif: RoomGif) => void }) {
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [unavailable, setUnavailable] = useState<Set<GifResult["id"]>>(new Set());
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState({ offset: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch(`/api/gifs?q=${encodeURIComponent(term)}&offset=${page.offset}`).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);return {data:result.gifs as GifResult[],pagination:{total_count:result.total}};}).then(({ data, pagination }) => {
      if (!active) return;
      setGifs(previous => page.offset ? [...previous, ...data] : data);
      setOffset(page.offset + data.length);
      setMore(data.length > 0 && page.offset + data.length < pagination.total_count);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [term, page]);


  const visible = gifs.filter(gif => !unavailable.has(gif.id));

  return <div className="sw-scroll min-h-0 overflow-y-auto">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map(gif => {
        const url = gif.images.fixed_width?.url || gif.images.original?.url;
        if (typeof gif.id !== "string" || !url) return null;
        const title = gif.title || "GIPHY GIF";
        return <button key={gif.id} type="button" aria-label={`Select GIF: ${title}`} className="min-w-0 overflow-hidden rounded-xl border border-input bg-field text-left"
          onErrorCapture={() => setUnavailable(previous => new Set(previous).add(gif.id))}
          onClick={event => {
            if (typeof gif.id !== "string") return;
            const media = giphyMediaUrl(url, gif.id);
            if (media) onSelect({ id: gif.id, url: media, title, creator: gif.username || "", source: gif.url, license: "GIPHY" });
          }}>
          <img src={url} alt={title} loading="lazy" className="h-[118px] w-full object-cover"/>
          <span className="block truncate px-2 py-1.5 text-xs text-ink-soft">{gif.username ? `@${gif.username}` : title}</span>
        </button>;
      })}
    </div>
    {status === "loading" && <p role="status" className="py-3 text-sm text-muted">Loading GIFs…</p>}
    {status === "ready" && visible.length === 0 && <p role="status" className="py-3 text-sm text-muted">{gifs.length ? "GIF previews could not load." : "No matching GIFs."}</p>}
    {status === "error" && <p role="status" className="py-3 text-sm text-muted">GIPHY is unavailable right now.</p>}
    {(status === "error" || (status === "ready" && more)) && <button type="button" className="kn-background-upload mt-3"
      onClick={() => { setStatus("loading"); setPage({ offset }); }}>{status === "error" ? "Retry" : "Load more"}</button>}
  </div>;
}

export default function GifPicker({ open, onOpenChange, onSelect }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (gif: RoomGif) => void;
}) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setTerm(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="!flex max-w-xl !flex-col">
      <DialogTitle>Choose a GIF</DialogTitle>
      <DialogDescription>{term ? `Results for “${term}”` : "Trending GIFs"}</DialogDescription>
      <form className="app-search-field gif-search-field" role="search" onSubmit={event=>{event.preventDefault();setTerm(query.trim());}}><Search size={18} aria-hidden="true"/><input type="search" placeholder="Search GIFs on GIPHY…" aria-label="Search GIFs" value={query} onChange={event=>setQuery(event.target.value)} maxLength={70}/><button type="button" disabled={!query} aria-label="Clear GIF search" onClick={()=>{setQuery("");setTerm("");}}><X size={18}/></button><button type="submit" aria-label="Search GIFs" title="Search GIFs"><Search size={18}/></button></form>
      {open && <GifResults key={term} term={term} onSelect={gif => { onSelect(gif); onOpenChange(false); }}/>}
      <a className="flex shrink-0 items-center gap-2 self-start rounded bg-black px-2 py-1 text-xs font-semibold text-white" href="https://giphy.com/" target="_blank" rel="noreferrer">
        <img src="/giphy-logo.png" width="22" height="22" alt=""/> Powered by GIPHY
      </a>
    </DialogContent>
  </Dialog>;
}
