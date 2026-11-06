"use client";
import type { Playlist, Track } from "@/lib/types";
export default function PlaylistPicker({ track, playlists, onAdd, onCreate }: {track: Track; playlists: Playlist[]; onAdd: (id: string, track: Track) => void; onCreate: () => void}) {
 const saved=playlists.some(p=>p.tracks.some(t=>t.videoId===track.videoId));
 return <select onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} className="sw-playlist-picker" aria-label={`Save ${track.title} to playlist`} title={saved?'Saved — choose another playlist':'Save to playlist'} value="" onChange={e=>{const id=e.currentTarget.value;e.currentTarget.value='';if(id==='__new')onCreate();else if(id)onAdd(id,track);}}>
  <option value="">{saved?'✓ Saved':'♡ Save'}</option>{playlists.map(p=>{const exists=p.tracks.some(t=>t.videoId===track.videoId);return <option key={p.id} value={p.id} disabled={exists}>{p.name}{exists?' — saved':''}</option>;})}<option value="__new">+ Create playlist…</option>
 </select>;
}
