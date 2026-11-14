"use client";
import { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, Heart, Upload, Music2, ListMusic, Search, Plus, Play, X, FolderUp,Image as ImageIcon, Video } from "lucide-react";
import type { Playlist, Track, ChatMsg, RoomPhoto } from "@/lib/types";
import {notify} from "./FeedbackToast";
import { EVENTS } from "@/lib/protocol.mjs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MoveTrack from "./MoveTrack";
import {useReorder} from "@/hooks/useReorder";
import {Cover, DragHandle} from "./ui/track-row";
import PlaylistPicker from "./PlaylistPicker";
export type LibrarySection = "liked" | "songs" | "playlists" | "upload" | "videos" | "photos";
type Props = {photos?:RoomPhoto[];mediaQuery?:string;onUploadPhoto?:(file:File)=>Promise<NonNullable<ChatMsg["image"]>>; open: boolean; section: LibrarySection; onSection: (s: LibrarySection) => void; onClose: () => void;
  code: string; uploadToken: string; playlists: Playlist[]; library: Track[]; tracks: Track[]; seed?: Track;
  onAdd: (t: Track) => void; onAddMany: (t: Track[], from?: string) => void; onPlayNow: (t: Track) => void;
  onPlaylistAdd: (id: string, track: Track) => void;
  emit: (event: string, payload?: unknown, ack?: (result: any) => void) => unknown };
export default function LibraryPanel({ open, section, onSection, onClose, code, uploadToken, playlists, library, tracks, seed, onAdd, onAddMany, onPlayNow, onPlaylistAdd, emit, photos=[],mediaQuery="",onUploadPhoto }: Props) {
  const [liked,setLiked]=useState<Track[]>([]),[likedChosen,setLikedChosen]=useState<string[]>([]);
  useEffect(()=>{if(open)emit("library:liked-get",{},(tracks:Track[])=>setLiked(tracks||[]));},[open,section,emit]);
  const [collectionOpen,setCollectionOpen]=useState(true),[expanded,setExpanded]=useState(false),[chosen,setChosen]=useState<string[]>([]),[limit,setLimit]=useState(100);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [uploadedPhotos,setUploadedPhotos]=useState<NonNullable<ChatMsg["image"]>[]>([]);
  const [playlistUrl,setPlaylistUrl]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [name, setName] = useState(""), [selected, setSelected] = useState("");
  useEffect(()=>{if(message&&!message.includes("Reading"))notify(message);},[message]);
  const [query, setQuery] = useState(""), [rename, setRename] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const filesRef = useRef<HTMLInputElement>(null), folderRef = useRef<HTMLInputElement>(null);
  const list = playlists.find(p => p.id === selected);
  const field = "sw-library-field";
  const songs = section === "liked" ? liked : section === "playlists" ? list?.tracks || [] : section==="videos"?library.filter(t=>t.mediaType==="video"):library.filter(t=>t.mediaType!=="video");
  const filtered = songs.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase()));
  function request(event:string,payload:unknown):Promise<any>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Request timed out. Reconnect and check before retrying.')),10000);emit(event,payload,(result:any)=>{clearTimeout(timer);result?.error?reject(Error(result.error)):resolve(result);});});}
  async function queuePlaylists(ids:string[]){if(busy)return;setBusy(true);try{const result=await request(EVENTS.PLAYLIST_QUEUE,{ids});setMessage(`Added ${result.count} songs from ${result.playlists} playlist${result.playlists===1?'':'s'} to the end of your queue. Playback continues automatically.`);}catch(error){setMessage(error instanceof Error?error.message:'Could not queue playlists');}finally{setBusy(false);}}
  function reorder(from:number,to:number){if(!list||from===to)return;const track=list.tracks[from];void request(EVENTS.PLAYLIST_REORDER,{id:list.id,fromIndex:from,toIndex:to,expectedVideoId:track.videoId,expectedTitle:track.title}).then(()=>setMessage(`Moved song ${from+1} to position ${to+1}.`)).catch(error=>setMessage(error.message));}
  const drag=useReorder((key,to)=>reorder(Number(key),to));
  async function upload(files: FileList | File[] | null) {
    if (!files?.length || busy) return;
    const imageFiles=Array.from(files).filter(f=>/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
    if(imageFiles.length&&onUploadPhoto){setBusy(true);try{for(const file of imageFiles){const image=await onUploadPhoto(file);setUploadedPhotos(p=>[...p,image]);}onSection("photos");setMessage("Photos uploaded. View them in Photos.");}catch(error){setMessage(error instanceof Error?error.message:"Photo upload failed.");}finally{setBusy(false);}}
    const audio = Array.from(files).filter(f => /\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|aiff|aif|wma|mp4|mov|mkv|m4v)$/i.test(f.name));
    if (!audio.length&&imageFiles.length)return;
    if (!audio.length) { setMessage("Choose audio or video files such as MP3, WAV or MP4."); return; }
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
    setMessage(`${audio.length - failed} media files imported into your saved library.${failed ? ` ${failed} failed; select those files again to retry. Duplicates are skipped.` : " Ready for your next listening session."}`);
    setBusy(false);if(!failed)onSection(audio.some(f=>/\.(mp4|mov|mkv|m4v|webm)$/i.test(f.name))?"videos":"songs");
  }
  async function importPlaylist(){
    if(busy||!playlistUrl.trim())return;
    setBusy(true);setMessage('Reading YouTube playlist…');
    try{
      const response=await fetch(`/api/link?playlist=1&room=${encodeURIComponent(code)}&url=${encodeURIComponent(playlistUrl.trim())}`,{signal:AbortSignal.timeout(75000)});
      const data=await response.json();if(!response.ok)throw Error(data.message||data.error||'Could not read this playlist');
      const imported=data.list;if(data.kind!=='list'||!Array.isArray(imported?.tracks)||!imported.tracks.length)throw Error('No available songs were found in this playlist.');
      const result:any=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Saving timed out. Reconnect and check your playlists before retrying.')),12000);emit(EVENTS.PLAYLIST_SAVE,{name:name.trim()||imported.title||'YouTube playlist',tracks:imported.tracks},(reply:any)=>{clearTimeout(timer);reply?.error?reject(Error(reply.error)):resolve(reply);});});
      setSelected(result.id);setRename(null);setName('');setPlaylistUrl('');setConfirmDelete(false);setMessage(`${imported.tracks.length} songs saved as a new playlist.${imported.total>imported.tracks.length?` Source has ${imported.total} entries; this import includes up to 100 available songs.`:''} Rename or delete it below.`);onSection("playlists");
    }catch(error){setMessage(error instanceof Error?error.message:'Playlist import failed.');}finally{setBusy(false);}
  }
  async function save(tracksToSave:Track[]){
    if(!name.trim()||busy)return;setBusy(true);
    try{const result=await request(EVENTS.PLAYLIST_SAVE,{name,tracks:tracksToSave});setSelected(result.id);setName('');setMessage('Playlist added. Choose songs below, then Play or Queue all.');onSection('playlists');}catch(error){setMessage(error instanceof Error?error.message:'Could not save playlist');}finally{setBusy(false);}
  }
  function row(t:Track,i:number){const index=songs.indexOf(t),canReorder=section==='playlists'&&Boolean(list)&&!query;return <li key={`${t.videoId}-${index}`} className="sw-library-song kn-saved-song" style={drag.state.activeKey===String(index)?{background:'var(--accent-soft)',transform:`translateY(${drag.state.offsetY}px)`,zIndex:2}:{transform:`translateY(${drag.shiftFor(index)}px)`}}>
    {canReorder&&<DragHandle onPointerDown={e=>drag.start(e,String(index),index,songs.length)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onKeyDown={e=>{if(e.key==='ArrowUp'&&index>0){e.preventDefault();reorder(index,index-1);}if(e.key==='ArrowDown'&&index<songs.length-1){e.preventDefault();reorder(index,index+1);}}}/>}
    <span className="kn-saved-index">{index+1}</span><Cover src={t.thumbnail} size="sm" className="kn-library-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.title}</p><p className="truncate text-xs text-muted">{t.artist}</p></div>
    <div className="kn-saved-actions"><button className="sw-library-icon" aria-label={`Play ${t.title} now`} onClick={()=>onPlayNow(t)}><Play size={16}/></button><button className="sw-library-icon" aria-label={`Queue ${t.title}`} onClick={()=>onAdd(t)}><Plus size={17}/></button>
    {section==='liked'&&<input type="checkbox" aria-label={`Select ${t.title}`} checked={likedChosen.includes(t.videoId)} onChange={e=>setLikedChosen(old=>e.target.checked?[...old,t.videoId]:old.filter(id=>id!==t.videoId))}/>}
    {section==='playlists'&&list?<><MoveTrack title={t.title} index={index} total={songs.length} onMove={to=>reorder(index,to)}/><button className="sw-library-icon" aria-label={`Remove ${t.title} from playlist`} onClick={()=>emit(EVENTS.PLAYLIST_REMOVE_TRACK,{id:list.id,videoId:t.videoId})}><X size={15}/></button></>:<PlaylistPicker track={t} playlists={playlists} onAdd={onPlaylistAdd} onCreate={()=>{onSection('playlists');setSelected('');setMessage('Create a playlist, then use Save to add this song.');}}/>}</div>
  </li>;}
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent fullscreen={expanded} className={`studio-collection sw-love-library sw-library-dialog !flex !max-w-3xl !flex-col !gap-0 !overflow-hidden !p-0 ${expanded?"kn-library-expanded":""}`}>
    <div className="studio-collection-header px-5 pt-5 pb-4">
      <div className="mt-2 flex flex-wrap items-center gap-2 pr-10"><DialogTitle className="mr-auto font-display text-xl font-bold">{expanded&&section==='playlists'&&list?list.name:"Your library"}</DialogTitle><button type="button" aria-label={expanded?"Restore library window":"Expand library"} title={expanded?"Restore library window":"Expand library"} className="kn-move-track" onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button></div>
      <DialogDescription className="mt-1 text-xs text-muted">Upload songs to your server, save playlists, and listen together.</DialogDescription></div>
    <nav className="flex gap-1 border-y border-white/10 px-4 py-2" aria-label="Music collection">
      {([['liked',Heart,'Liked'],['songs',Music2,'Library'],['playlists',ListMusic,'Playlists'],['videos',Video,'Videos'],['photos',ImageIcon,'Photos'],['upload',Upload,'Upload']] as const).map(([id,Icon,label]) => <button key={id} onClick={() => { onSection(id); setQuery(""); }} className={`sw-library-tab ${section===id?'active':''}`}><Icon size={15} />{label}{id==='songs' && <span>{library.filter(t=>t.mediaType!=="video").length}</span>}</button>)}
    </nav>
    <div className="sw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" data-reorder-scroll>
      {section==='photos'?<div className="kn-library-photos">{Array.from(new Map([...uploadedPhotos,...photos.map(photo=>photo.image)].map(image=>[image.id,image])).values()).map(image=><figure key={image.id}><img src={image.url+mediaQuery} alt={image.name||"Shared photo"}/></figure>)}{!uploadedPhotos.length&&!photos.length&&<p>Choose photos from Upload to see them here.</p>}</div>:section === 'upload' ? <>
        <div className="sw-upload-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
          <span className="sw-upload-heart"><Upload size={28} /></span><h3 className="mt-3 font-display text-lg font-semibold">Music, video & photos.</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted">Select all 400 songs at once or choose a folder. MP3, FLAC, WAV, MP4, MOV, MKV, WEBM and photos · up to 100 MB per file. No need to keep the originals open.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2"><Button disabled={busy || !uploadToken} onClick={() => filesRef.current?.click()}><Upload size={15} />Choose media</Button><Button variant="secondary" disabled={busy || !uploadToken} onClick={() => folderRef.current?.click()}><FolderUp size={15} />Choose folder</Button></div>
          <input ref={filesRef} aria-label="Upload media files" type="file" multiple className="sr-only" accept=".mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.webm,.aiff,.aif,.wma,.mp4,.mov,.mkv,.m4v,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif" onChange={e => { void upload(e.target.files); e.target.value=''; }} />
          <input ref={el => { folderRef.current=el; el?.setAttribute('webkitdirectory',''); }} aria-label="Upload music folder" type="file" multiple className="sr-only" onChange={e => { void upload(e.target.files); e.target.value=''; }} />
        </div>
        {progress.total>0 && <div className="mt-4"><progress className="w-full accent-pink-400" max={progress.total} value={progress.done} /><p className="mt-1 text-xs text-muted">{progress.done} / {progress.total} songs · {progress.failed} failed</p></div>}
        <p className="mt-4 text-xs leading-relaxed text-muted">Imports continue while this dialog is closed. Keep this browser tab open until the batch completes. Already-imported files are detected automatically.</p>
      </> : <>
        {section==='playlists' && <>
          <details className="kn-playlist-tools"><summary>Import or create a playlist</summary><form className="kn-playlist-import" onSubmit={event=>{event.preventDefault();void importPlaylist();}}><label className="flex min-w-0 flex-1 flex-col gap-2"><strong className="text-sm">Import YouTube playlist</strong><span className="kn-playlist-link-field"><input type="url" className={field} aria-label="YouTube playlist link" placeholder="Paste a YouTube playlist link…" required value={playlistUrl} maxLength={2048} onChange={event=>setPlaylistUrl(event.target.value)}/>{playlistUrl&&<button type="button" aria-label="Clear playlist link" onClick={()=>setPlaylistUrl("")}>×</button>}</span><small className="text-xs text-muted">Save up to 100 available songs as a new playlist. This does not start playback.</small></label><Button type="submit" disabled={busy||!playlistUrl.trim()}>{busy?'Importing…':'Import playlist'}</Button></form>
          <form onSubmit={e => { e.preventDefault(); void save(seed ? [seed] : []); }} className="flex gap-2"><input className={`${field} flex-1`} aria-label="New playlist name" placeholder="Playlist name…" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /><Button type="submit" size="sm" disabled={busy}><Plus size={15} />Playlist</Button></form></details>
          <button type="button" className="kn-move-track mt-3" aria-expanded={collectionOpen} onClick={()=>setCollectionOpen(value=>!value)}>{collectionOpen?"Hide playlist choices":"Choose playlists · change selection"}</button>{collectionOpen&&<div className="kn-playlist-collection">{playlists.map(p=><div key={p.id} className={`kn-playlist-selection ${selected===p.id?'active':''}`}><input type="checkbox" aria-label={`Select playlist ${p.name} for queue`} checked={chosen.includes(p.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/><button type="button" onClick={()=>{setSelected(p.id);setCollectionOpen(false);setRename(null);setConfirmDelete(false);setQuery('');}}><strong>{p.name}</strong><small>{p.tracks.length} {p.tracks.length===1?"song":"songs"} · Open & arrange</small></button></div>)}</div>}
          {chosen.length>0&&<div className="kn-playlist-batch"><span>{chosen.length} selected · {chosen.reduce((sum,id)=>sum+(playlists.find(p=>p.id===id)?.tracks.length||0),0)} songs</span><Button disabled={busy} onClick={()=>void queuePlaylists(chosen)}>Queue selected</Button><button className="kn-move-track" onClick={()=>setChosen([])}>Clear selection</button></div>}
          {list && <div className="kn-list-actions mt-4 flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">{list.name}</h3><Button size="sm" variant="secondary" disabled={!list.tracks.length} onClick={() => void queuePlaylists([list.id])}>Queue all</Button><Button size="sm" variant="secondary" onClick={() => setRename(list.name)}>Rename</Button><Button size="sm" variant="secondary" onClick={()=>setConfirmDelete(true)}>Delete</Button><Button size="sm" variant="secondary" onClick={() => { for (const t of tracks) onPlaylistAdd(list.id,t); }}>Add room songs</Button></div>}
          {list&&<label className="kn-persistence-option"><input type="checkbox" checked={Boolean(list.persistent)} onChange={e=>{const enabled=e.target.checked;void request(EVENTS.PLAYLIST_PERSIST,{id:list.id,enabled}).then(()=>setMessage(enabled?'Playlist references saved across rooms.':'Playlist kept in this room only.')).catch(error=>setMessage(error.message));}}/><span><strong>Keep this playlist across rooms</strong><small>Save song references on this server. Reuse them with a new room code or tunnel link.</small></span></label>}
          {confirmDelete&&list&&<div role="alert" className="kn-playlist-delete"><p>Delete “{list.name}”{list.persistent?" from all rooms":""}? Songs in your library are kept.</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={()=>{emit(EVENTS.PLAYLIST_DELETE,{id:list.id});setSelected('');setConfirmDelete(false);setMessage('Playlist deleted. Your library songs are unchanged.');}}>Delete playlist</Button><Button size="sm" variant="secondary" onClick={()=>setConfirmDelete(false)}>Cancel</Button></div></div>}
          {rename!==null && list && <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); emit(EVENTS.PLAYLIST_RENAME,{id:list.id,name:rename}); setRename(null); }}><input className={`${field} flex-1`} aria-label="Rename playlist" required value={rename} maxLength={80} onChange={e => setRename(e.target.value)} /><Button size="sm">Save name</Button></form>}
          {(!list || !list.tracks.length) && <p className="my-5 text-sm leading-relaxed text-muted">{playlists.length ? 'Choose a playlist above. Use ♡ Save beside songs in Library, search or the queue to add them here.' : 'Create your first playlist, then use ♡ Save beside any song to keep it here forever.'}</p>}
        </>}
        {section==='liked'&&<div className="flex flex-wrap gap-2 mt-4"><Button variant="secondary" onClick={()=>setLikedChosen(likedChosen.length===liked.length?[]:liked.map(t=>t.videoId))}>{likedChosen.length===liked.length?'Clear selection':'Select all'}</Button><select aria-label="Add selected liked songs to playlist" defaultValue="" onChange={e=>{if(e.target.value){liked.filter(t=>likedChosen.includes(t.videoId)).forEach(t=>onPlaylistAdd(e.target.value,t));setMessage('Selected songs added to playlist');e.target.value='';}}}><option value="">Add selected to playlist</option>{playlists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{!playlists.length&&<Button onClick={()=>onSection('playlists')}>Create playlist</Button>}</div>}{(section==='liked'||section==='songs' || list) && <><label className="relative mt-4 block"><Search className="absolute left-3 top-3 text-muted" size={15} /><input aria-label="Search saved songs" className={`${field} w-full !pl-9`} placeholder="Find a saved song…" value={query} onChange={e => setQuery(e.target.value)} /></label><ul className="mt-3" data-reorder-scroll>{(section==='playlists'?filtered:filtered.slice(0,limit)).map(row)}</ul>{section==='songs'&&filtered.length>limit&&<button className="kn-background-upload mt-3" onClick={()=>setLimit(value=>value+100)}>Show 100 more · {filtered.length} total</button>}</>}
        {section==='songs' && !library.length && <div className="sw-upload-drop mt-4"><Music2 size={30}/><h3 className="mt-3 font-semibold">A little empty, a lot of possibility</h3><p className="my-3 text-xs text-muted">Upload your songs once. They’ll be here whenever you return.</p><Button onClick={() => onSection('upload')}>Upload songs</Button></div>}
      </>}
    </div>
    <div className="border-t border-white/10 px-5 py-3 text-xs text-muted" role="status">{message || (busy ? 'Working…' : 'Stored on your server')} {busy && ' · Import running'}</div>
  </DialogContent></Dialog>;
}
