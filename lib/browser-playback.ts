/** Stop both crossfade slots when the room has no authoritative media. */
export function stopMediaSlots(...slots:(HTMLMediaElement|null|undefined)[]){
 for(const media of slots){if(!media)continue;media.pause();media.playbackRate=1;media.removeAttribute('src');media.load();}
}
