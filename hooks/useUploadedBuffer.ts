"use client";
import {useEffect,useRef,useState} from 'react';
// Private in-memory buffering, never written to shared HTTP or service-worker cache.
// A complete Blob is used so seeking cannot trigger a second network download.
export function useUploadedBuffer(id:string|undefined,code:string,token:string,enabled:boolean){
 const [result,setResult]=useState<{key:string;url:string;percent:number;error:string}>({key:'',url:'',percent:0,error:''}),[attempt,setAttempt]=useState(0);
 const key=id?.startsWith('local_')&&enabled&&token?`${id}:${token}`:'';
 const urlRef=useRef('');
 useEffect(()=>{if(!key||!id)return;const abort=new AbortController();let disposed=false;
  setResult({key,url:'',percent:0,error:''});
  const load=async()=>{try{
   const r=await fetch(`/audio/${id}?room=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`,{cache:'no-store',signal:abort.signal});if(!r.ok||!r.body)throw Error('Unable to buffer this upload. Rejoin the room or retry.');
   const size=Number(r.headers.get('Content-Length'));if(!size||size>105*1024*1024)throw Error('This file is too large to buffer on this device.');
   const parts:BlobPart[]=[],reader=r.body.getReader();let received=0;
   for(;;){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>105*1024*1024)throw Error('Upload exceeded the buffer limit.');parts.push(new Uint8Array(value).buffer);if(!disposed)setResult({key,url:'',percent:Math.min(99,Math.floor(received/size*100)),error:''});}
   if(received!==size)throw Error('The audio download was interrupted. Please retry.');if(disposed)return;
   const url=URL.createObjectURL(new Blob(parts,{type:r.headers.get('Content-Type')||'audio/mp4'}));urlRef.current=url;setResult({key,url,percent:100,error:''});
  }catch(e){if(!disposed&&!abort.signal.aborted)setResult({key,url:'',percent:0,error:e instanceof Error?e.message:'Buffering failed.'});}};
  void load();return()=>{disposed=true;abort.abort();if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current='';}};
 },[key,id,code,token,attempt]);
 return {url:result.key===key?result.url:'',percent:result.key===key?result.percent:0,error:result.key===key?result.error:'',loading:Boolean(key&&!(result.key===key&&result.url)),retry:()=>setAttempt(a=>a+1)};
}
