// Permission prompts cannot be programmatically dismissed. If one resolves
// after our deadline, immediately stop the late stream instead of leaking capture.
export async function acquireMedia(constraints:MediaStreamConstraints,timeout=20000){
 return new Promise<MediaStream>((resolve,reject)=>{
  let finished=false;const timer=setTimeout(()=>{finished=true;reject(Error('Media permission timed out. Allow microphone/camera access in your browser, then try again.'));},timeout);
  navigator.mediaDevices.getUserMedia(constraints).then(media=>{if(finished){media.getTracks().forEach(t=>t.stop());return;}finished=true;clearTimeout(timer);resolve(media);},error=>{if(finished)return;finished=true;clearTimeout(timer);reject(error);});
 });
}
