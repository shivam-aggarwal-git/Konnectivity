"use client";
// Native HTTP Range playback starts after the browser's minimum buffer. Never
// download the entire upload or swap a playing stream for a Blob URL.
export function useUploadedBuffer(id:string|undefined,code:string,token:string,enabled:boolean){
 const url=id?.startsWith('local_')&&enabled&&token?`/audio/${id}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`:'';
 return {url,percent:0,error:'',loading:false,retry:()=>{}};
}
