// Permission prompts cannot be programmatically dismissed. If one resolves
// after our deadline, immediately stop the late stream instead of leaking capture.
export function mediaPermissionError(error:unknown){
 const e=error as {name?:string;message?:string};
 if(e?.name==='NotAllowedError'||e?.name==='PermissionDeniedError')return Object.assign(Error('Microphone or camera access is blocked on this device. Allow access in your browser and iPhone privacy settings, then retry.'),{name:'NotAllowedError'});
 if(e?.name==='NotReadableError')return Error('Microphone or camera is busy. Close other apps using it, then retry.');
 if(e?.name==='NotFoundError')return Error('No microphone or camera was found. Check the device and try voice only.');
 return error instanceof Error?error:Error('Could not access your microphone or camera.');
}
export function restoreAudioSession(){try{const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;if(session)session.type='auto';}catch{}}
export async function acquireMedia(constraints:MediaStreamConstraints,timeout=20000){
 if(constraints.audio){try{const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;if(session)session.type='play-and-record';}catch{}}
 return new Promise<MediaStream>((resolve,reject)=>{
  let finished=false;const timer=setTimeout(()=>{finished=true;restoreAudioSession();reject(Error('Media permission timed out. Allow microphone/camera access in your browser, then try again.'));},timeout);
  navigator.mediaDevices.getUserMedia(constraints).then(media=>{if(finished){media.getTracks().forEach(t=>t.stop());return;}finished=true;clearTimeout(timer);resolve(media);},error=>{if(finished)return;finished=true;clearTimeout(timer);restoreAudioSession();reject(mediaPermissionError(error));});
 });
}
