// Instance-wide, opt-in personal space. Runtime data never belongs in a release.
import {loadSync,saveDebounced} from './store.mjs';
import {DEFAULT_APPEARANCE,appearancePatch} from './appearance.mjs';
const state=globalThis.__KN_PERSONAL_SPACE??=loadSync('personal-space',{enabled:false,appearance:{...DEFAULT_APPEARANCE},settings:{},playlists:[],backgroundRoom:null});
state.playlists??=[];state.members??={};
export function memberSpace(identity){return identity?state.members[identity]:null;}
export function roomSpace(room){return room?.roomScoped?(room.personalIdentity?state.members[room.personalIdentity]:null):state;}
export function saveMemberSpace(room,member,enabled){if(!member?.mediaIdentity)return false;room.personalIdentity=member.mediaIdentity;const space=state.members[member.mediaIdentity]??={};Object.assign(space,{enabled,appearance:structuredClone(room.appearance),settings:{volume:room.volume,shuffle:room.shuffle,continuousPlay:room.continuousPlay!==false,repeat:room.repeat,moodOverride:room.moodOverride,roomAvatarImageId:room.roomAvatarImageId||null},playlists:room.playlists.map(playlistReference),library:structuredClone(room.library||[]),profile:member.profile||null,backgroundRoom:room.code});savePersonalSpace();return true;}
export function rememberProfile(room,member){const space=memberSpace(member?.mediaIdentity);if(space?.enabled){space.profile=member.profile;space.profileRoom=room.code;savePersonalSpace();}}
export const personalSpace=state;
export function savePersonalSpace(){saveDebounced('personal-space',state);}
export function playlistReference(list){return {id:list.id,name:list.name,persistent:true,tracks:list.tracks.map(t=>({videoId:t.videoId,title:t.title,artist:t.artist,duration:t.duration,thumbnail:t.thumbnail,art:t.art}))};}
export function savedPlaylists(){return structuredClone(state.playlists);}
export function rememberSettings(room,keys=["volume","shuffle","continuousPlay","repeat","inviteOnly","moodOverride","roomAvatarImageId"]){for(const space of new Set([roomSpace(room),memberSpace(room.personalIdentity)])){if(!space?.enabled)continue;space.settings??={};for(const key of keys)space.settings[key]=room[key];}savePersonalSpace();}
export function rememberAppearance(room){for(const space of new Set([roomSpace(room),memberSpace(room.personalIdentity)])){if(!space?.enabled)continue;space.appearance={...DEFAULT_APPEARANCE,...appearancePatch(room.appearance)};space.backgroundRoom=room.code;}savePersonalSpace();}
export function rememberPlaylist(list){const index=state.playlists.findIndex(p=>p.id===list.id);if(list.persistent){const reference=playlistReference(list);if(index<0)state.playlists.push(reference);else state.playlists[index]=reference;}else if(index>=0)state.playlists.splice(index,1);savePersonalSpace();}
