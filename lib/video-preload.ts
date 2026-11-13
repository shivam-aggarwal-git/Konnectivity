// At most two small uploaded videos are retained: current and next.
const videos=new Map<string,string>();
export const preparedVideo=(source:string)=>videos.get(source);
export async function prepareVideo(source:string,signal:AbortSignal){
 if(videos.has(source))return;
 const response=await fetch(source,{signal});const limit=24*1024*1024;
 if(!response.ok||Number(response.headers.get('content-length'))>limit||!response.body){await response.body?.cancel();return;}
 const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();return;}chunks.push(new Uint8Array(value));}
 if(signal.aborted)return;
 const url=URL.createObjectURL(new Blob(chunks,{type:response.headers.get('content-type')||'video/mp4'}));videos.set(source,url);
 while(videos.size>2){const first=videos.keys().next().value;if(!first)break;URL.revokeObjectURL(videos.get(first)!);videos.delete(first);}
 window.dispatchEvent(new Event('konnectivity:video-preloaded'));
}
