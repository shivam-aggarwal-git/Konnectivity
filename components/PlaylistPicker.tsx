"use client";
import type { Playlist, Track } from "@/lib/types";
export default function PlaylistPicker({ track, playlists, onAdd, onCreate }: {track: Track; playlists: Playlist[]; onAdd: (id: string, track: Track) => void; onCreate: () => void}) {
  return <select onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="sw-playlist-picker" aria-label={`Add ${track.title} to playlist`} title="Save to playlist" value="" onChange={e => {
    if (e.target.value === "__new") onCreate(); else if(e.target.value) onAdd(e.target.value, track);
  }}><option value="">♡ Save</option>{playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new">+ Create playlist…</option></select>;
}
