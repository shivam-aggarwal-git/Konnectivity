export const PERMISSIONS={chat:'Send text messages',photos:'Send photos',videos:'Send chat videos',location:'Share locations',comments:'Comment on songs',reactions:'Send reactions',messages:'Show player messages',vote:'Vote in polls and skip votes',polls:'Create and manage own polls',plans:'Create and respond to plans',queue:'Add and arrange media',playlists:'Manage playlists',upload:'Upload audio and video',playback:'Control shared playback',appearance:'Change shared appearance',calls:'Join voice and video calls',sync:'Synchronize listener playback'};
export const defaultPermissions=()=>Object.fromEntries(Object.keys(PERMISSIONS).map(k=>[k,true]));
export function permissionState(room){return {...defaultPermissions(),...room?.permissions};}
export function allowed(room,member,key){return Boolean(member&&(member.isHost||permissionState(room)[key]!==false));}
export function permissionFor(event,data={}){
 if(event==='chat:send')return data.imageId?'photos':data.videoId?'videos':data.location?'location':'chat';
 if(event==='poll:vote'||event==='vote:skip'||event==='queue:vote')return 'vote';
 if(event.startsWith('poll:'))return 'polls';if(event.startsWith('plan:'))return 'plans';
 if(['call:ring','call:media','call:join','call:renew','call:signal'].includes(event))return 'calls';
 if(event==='comment:add')return 'comments';if(event==='reaction')return 'reactions';if(event==='player:message')return 'messages';
 if(event==='appearance:set')return 'appearance';if(event.startsWith('playlist:'))return 'playlists';
 if(event.startsWith('queue:'))return 'queue';if(event.startsWith('control:'))return 'playback';
 return null;
}
