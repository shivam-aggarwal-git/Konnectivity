"use client";
import { useState, useRef } from "react";
import { Heart, Upload, Music2, ListMusic, Search, Plus, Play, X, FolderUp } from "lucide-react";
import type { Playlist, Track } from "@/lib/types";
import { EVENTS } from "@/lib/protocol.mjs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PlaylistPicker from "./PlaylistPicker";
export type LibrarySection = "songs" | "playlists" | "upload";
type Props = { open: boolean; section: LibrarySection; onSection: (s: LibrarySection) => void; onClose: () => void;
  code: string; uploadToken: string; playlists: Playlist[]; library: Track[]; tracks: Track[]; seed?: Track;
  onAdd: (t: Track) => void; onAddMany: (t: Track[], from?: string) => void; onPlayNow: (t: Track) => void;
  onPlaylistAdd: (id: string, track: Track) => void;
  emit: (event: string, payload?: unknown, ack?: (result: any) => void) => unknown };
export default function LibraryPanel({ open, section, onSection, onClose, code, uploadToken, playlists, library, tracks, seed, onAdd, onAddMany, onPlayNow, onPlaylistAdd, emit }: Props) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [playlistUrl,setPlaylistUrl]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [name, setName] = useState(""), [selected, setSelected] = useState("");
  const [query, setQuery] = useState(""), [rename, setRename] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const filesRef = useRef<HTMLInputElement>(null), folderRef = useRef<HTMLInputElement>(null);
  const list = playlists.find(p => p.id === selected);
  const field = "sw-library-field";
  const songs = section === "playlists" ? list?.tracks || [] : library;
  const filtered = songs.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase()));
  async function upload(files: FileList | File[] | null) {
    if (!files?.length || busy) return;
    const audio = Array.from(files).filter(f => /\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|aiff|aif|wma)$/i.test(f.name));
    if (!audio.length) { setMessage("Choose audio files such as MP3, FLAC or WAV."); return; }
    setBusy(true); setProgress({ done: 0, total: audio.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < audio.length; i++) {
      const file = audio[i]; setMessage(`Importing ${i + 1} of ${audio.length}: ${file.name}`);
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error("File exceeds 100 MB");
        const response = await fetch("/upload", { method: "POST", body: file, headers: { "x-room-code": code, "x-upload-token": uploadToken, "x-file-name": encodeURIComponent(file.name) } });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Upload failed");
      } catch { failed++; }
      setProgress({ done: i + 1, total: audio.length, failed });
    }
    setMessage(`${audio.length - failed} songs imported into your saved library.${failed ? ` ${failed} failed; select those files again to retry. Duplicates are skipped.` : " Ready for your next listening session."}`);
    setBusy(false);
  }
  async function importPlaylist(){
    if(busy||!playlistUrl.trim())return;
    setBusy(true);setMessage('Reading YouTube playlist…');
    try{
      const response=await fetch(`/api/link?playlist=1&url=${encodeURIComponent(playlistUrl.trim())}`,{signal:AbortSignal.timeout(75000)});
      const data=await response.json();if(!response.ok)throw Error(data.message||'Could not read this playlist');
      const imported=data.list;if(data.kind!=='list'||!Array.isArray(imported?.tracks)||!imported.tracks.length)throw Error('No available songs were found in this playlist.');
      const result:any=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Saving timed out. Reconnect and check your playlists before retrying.')),12000);emit(EVENTS.PLAYLIST_SAVE,{name:name.trim()||imported.title||'YouTube playlist',tracks:imported.tracks},(reply:any)=>{clearTimeout(timer);reply?.error?reject(Error(reply.error)):resolve(reply);});});
      setSelected(result.id);setRename(null);setName('');setPlaylistUrl('');setConfirmDelete(false);setMessage(`${imported.tracks.length} songs saved as a new playlist.${imported.total>imported.tracks.length?` Source has ${imported.total} entries; this import includes up to 100 available songs.`:''} Rename or delete it below.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Playlist import failed.');}finally{setBusy(false);}
  }
  function save(tracksToSave: Track[]) {
    if (!name.trim()) return;
    emit(EVENTS.PLAYLIST_SAVE, { name, tracks: tracksToSave }, (result: any) => {
      if (result.error) { setMessage(result.error); return; }
      setSelected(result.id); setName(""); setMessage("Playlist saved. Add songs from your library, search results or the room queue.");
    });
  }
  function row(t: Track, i: number) { return <div key={`${t.videoId}-${i}`} className="sw-library-song">
    <span className="sw-library-note"><Music2 size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.title}</p><p className="truncate text-xs text-muted">{t.artist}</p></div>
    <button className="sw-library-icon" title={`Play ${t.title} now`} aria-label={`Play ${t.title} now`} onClick={() => onPlayNow(t)}><Play size={16} /></button>
    <button className="sw-library-icon" title="Add to queue" aria-label={`Queue ${t.title}`} onClick={() => onAdd(t)}><Plus size={17} /></button>
    {section === "playlists" && list ? <button className="sw-library-icon" aria-label={`Remove ${t.title} from playlist`} onClick={() => emit(EVENTS.PLAYLIST_REMOVE_TRACK, { id: list.id, videoId: t.videoId })}><X size={15} /></button>
      : <PlaylistPicker track={t} playlists={playlists} onAdd={onPlaylistAdd} onCreate={() => { onSection("playlists"); setSelected(""); setMessage("Create a playlist below, then add songs using ♡ Save."); }} />}
  </div>; }
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="sw-love-library !flex !max-w-3xl !flex-col !gap-0 !overflow-hidden !p-0">
    <div className="px-5 pt-5 pb-4"><p className="sw-love-eyebrow"><Heart size={12} fill="currentColor" /> YOUR SHARED LIBRARY</p>
      <DialogTitle className="mt-2 font-display text-2xl font-bold">Your music library</DialogTitle>
      <DialogDescription className="mt-1 text-xs text-muted">Upload songs to your server, save playlists, and listen together.</DialogDescription></div>
    <nav className="flex gap-1 border-y border-white/10 px-4 py-2" aria-label="Music collection">
      {([['songs',Music2,'Library'],['playlists',ListMusic,'Playlists'],['upload',Upload,'Upload songs']] as const).map(([id,Icon,label]) => <button key={id} onClick={() => { onSection(id); setQuery(""); }} className={`sw-library-tab ${section===id?'active':''}`}><Icon size={15} />{label}{id==='songs' && <span>{library.length}</span>}</button>)}
    </nav>
    <div className="sw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
      {section === 'upload' ? <>
        <div className="sw-upload-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
          <span className="sw-upload-heart"><Upload size={28} /></span><h3 className="mt-3 font-display text-lg font-semibold">Bring all your songs home</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted">Select all 400 songs at once or choose a folder. MP3, FLAC, WAV and more · up to 100 MB per song. No need to keep the originals open.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2"><Button disabled={busy || !uploadToken} onClick={() => filesRef.current?.click()}><Upload size={15} />Choose songs</Button><Button variant="secondary" disabled={busy || !uploadToken} onClick={() => folderRef.current?.click()}><FolderUp size={15} />Choose folder</Button></div>
          <input ref={filesRef} aria-label="Upload audio files" type="file" multiple className="sr-only" accept=".mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.webm,.aiff,.aif,.wma" onChange={e => { void upload(e.target.files); e.target.value=''; }} />
          <input ref={el => { folderRef.current=el; el?.setAttribute('webkitdirectory',''); }} aria-label="Upload music folder" type="file" multiple className="sr-only" onChange={e => { void upload(e.target.files); e.target.value=''; }} />
        </div>
        {progress.total>0 && <div className="mt-4"><progress className="w-full accent-pink-400" max={progress.total} value={progress.done} /><p className="mt-1 text-xs text-muted">{progress.done} / {progress.total} songs · {progress.failed} failed</p></div>}
        <p className="mt-4 text-xs leading-relaxed text-muted">Imports continue while this dialog is closed. Keep this browser tab open until the batch completes. Already-imported files are detected automatically.</p>
      </> : <>
        {section==='playlists' && <>
          <form className="kn-playlist-import" onSubmit={event=>{event.preventDefault();void importPlaylist();}}><label className="flex min-w-0 flex-1 flex-col gap-2"><strong className="text-sm">Import YouTube playlist</strong><input type="url" className={field} aria-label="YouTube playlist link" placeholder="Paste a YouTube playlist link…" required value={playlistUrl} maxLength={2048} onChange={event=>setPlaylistUrl(event.target.value)}/><small className="text-xs text-muted">Save up to 100 available songs as a new playlist. This does not start playback.</small></label><Button type="submit" disabled={busy||!playlistUrl.trim()}>{busy?'Importing…':'Import playlist'}</Button></form>
          <form onSubmit={e => { e.preventDefault(); save(seed ? [seed] : []); }} className="flex gap-2"><input className={`${field} flex-1`} aria-label="New playlist name" placeholder="Playlist name…" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /><Button type="submit" size="sm"><Plus size={15} />Create playlist</Button></form>
          <div className="mt-4 flex flex-wrap gap-2">{playlists.map(p => <button key={p.id} className={`sw-playlist-card ${selected===p.id?'active':''}`} onClick={() => { setSelected(p.id); setRename(null); setConfirmDelete(false); setQuery(''); }}><Heart size={15} /><span>{p.name}<small>{p.tracks.length} songs</small></span></button>)}</div>
          {list && <div className="mt-4 flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">{list.name}</h3><Button size="sm" variant="secondary" disabled={!list.tracks.length} onClick={() => onAddMany(list.tracks,list.name)}>Queue all</Button><Button size="sm" variant="secondary" onClick={() => setRename(list.name)}>Rename</Button><Button size="sm" variant="secondary" onClick={()=>setConfirmDelete(true)}>Delete</Button><Button size="sm" variant="secondary" onClick={() => { for (const t of tracks) onPlaylistAdd(list.id,t); }}>Add room songs</Button></div>}
          {confirmDelete&&list&&<div role="alert" className="kn-playlist-delete"><p>Delete “{list.name}”? Songs in your library are kept.</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={()=>{emit(EVENTS.PLAYLIST_DELETE,{id:list.id});setSelected('');setConfirmDelete(false);setMessage('Playlist deleted. Your library songs are unchanged.');}}>Delete playlist</Button><Button size="sm" variant="secondary" onClick={()=>setConfirmDelete(false)}>Cancel</Button></div></div>}
          {rename!==null && list && <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); emit(EVENTS.PLAYLIST_RENAME,{id:list.id,name:rename}); setRename(null); }}><input className={`${field} flex-1`} aria-label="Rename playlist" required value={rename} maxLength={80} onChange={e => setRename(e.target.value)} /><Button size="sm">Save name</Button></form>}
          {(!list || !list.tracks.length) && <p className="my-5 text-sm leading-relaxed text-muted">{playlists.length ? 'Choose a playlist above. Use ♡ Save beside songs in Library, search or the queue to add them here.' : 'Create your first playlist, then use ♡ Save beside any song to keep it here forever.'}</p>}
        </>}
        {(section==='songs' || list) && <><label className="relative mt-4 block"><Search className="absolute left-3 top-3 text-muted" size={15} /><input aria-label="Search saved songs" className={`${field} w-full !pl-9`} placeholder="Find a saved song…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="mt-3">{filtered.slice(0,100).map(row)}{filtered.length>100 && <p className="py-3 text-xs text-muted">Showing 100 of {filtered.length}. Search to find any song.</p>}</div></>}
        {section==='songs' && !library.length && <div className="sw-upload-drop mt-4"><Music2 size={30}/><h3 className="mt-3 font-semibold">A little empty, a lot of possibility</h3><p className="my-3 text-xs text-muted">Upload your songs once. They’ll be here whenever you return.</p><Button onClick={() => onSection('upload')}>Upload songs</Button></div>}
      </>}
    </div>
    <div className="border-t border-white/10 px-5 py-3 text-xs text-muted" role="status">{message || (busy ? 'Importing songs…' : 'Stored on your server')} {busy && ' · Import running'}</div>
  </DialogContent></Dialog>;
}
