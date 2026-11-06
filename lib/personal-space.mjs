// Instance-wide, opt-in personal space. Runtime data never belongs in a release.
import {loadSync,saveDebounced} from './store.mjs';
import {DEFAULT_APPEARANCE,appearancePatch} from './appearance.mjs';
const state=globalThis.__KN_PERSONAL_SPACE??=loadSync('personal-space',{enabled:false,appearance:{...DEFAULT_APPEARANCE},settings:{},playlists:[],backgroundRoom:null});
state.playlists??=[];
export const personalSpace=state;
export function savePersonalSpace(){saveDebounced('personal-space',state);}
export function playlistReference(list){return {id:list.id,name:list.name,persistent:true,tracks:list.tracks.map(t=>({videoId:t.videoId,title:t.title,artist:t.artist,duration:t.duration,thumbnail:t.thumbnail,art:t.art}))};}
export function savedPlaylists(){return structuredClone(state.playlists);}
export function rememberSettings(room,keys=["volume","shuffle","repeat","inviteOnly"]){if(!state.enabled)return;state.settings??={};for(const key of keys)state.settings[key]=room[key];savePersonalSpace();}
export function rememberAppearance(room){if(!state.enabled)return;state.appearance={...DEFAULT_APPEARANCE,...appearancePatch(room.appearance)};state.backgroundRoom=room.code;savePersonalSpace();}
export function rememberPlaylist(list){const index=state.playlists.findIndex(p=>p.id===list.id);if(list.persistent){const reference=playlistReference(list);if(index<0)state.playlists.push(reference);else state.playlists[index]=reference;}else if(index>=0)state.playlists.splice(index,1);savePersonalSpace();}
