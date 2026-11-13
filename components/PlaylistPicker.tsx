"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Heart, Plus } from "lucide-react";
import type { Playlist, Track } from "@/lib/types";

export default function PlaylistPicker({track,playlists,onAdd,onCreate}:{
  track:Track;playlists:Playlist[];onAdd:(id:string,track:Track)=>void;onCreate:()=>void;
}) {
  const saved=playlists.some(playlist=>playlist.tracks.some(item=>item.videoId===track.videoId));
  return <Menu.Root modal={false}>
    <Menu.Trigger type="button" className="kn-playlist-menu-trigger sw-focus"
      aria-label={`Save ${track.title} to playlist`}
      onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>
      {saved?<Check size={14}/>:<Heart size={14}/>}<span>{saved?"Saved":"Save"}</span><ChevronDown size={14}/>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content data-playlist-menu className="kn-playlist-menu sw-glass-strong" align="end" sideOffset={6} collisionPadding={12}
        onClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()}>
        <Menu.Label className="px-2 py-1 text-xs font-semibold text-muted">Save to playlist</Menu.Label>
        {playlists.map(playlist=>{
          const exists=playlist.tracks.some(item=>item.videoId===track.videoId);
          return <Menu.Item key={playlist.id} disabled={exists} className="kn-playlist-menu-item" onSelect={()=>onAdd(playlist.id,track)}>
            <span>{playlist.name}</span>{exists&&<Check size={14} aria-label="Already saved"/>}
          </Menu.Item>;
        })}
        <Menu.Item className="kn-playlist-menu-item" onSelect={onCreate}><Plus size={15}/><span>Create playlist</span></Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
