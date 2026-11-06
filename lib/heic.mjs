import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let active=false;
export function isHeic(buffer){return buffer.length>=12&&buffer.subarray(4,8).toString()==='ftyp'&&['heic','heix','hevc','hevx','mif1','msf1'].includes(buffer.subarray(8,12).toString());}
export function convertHeic(buffer){
 if(active)return Promise.reject(Error('Another HEIC image is processing. Try again shortly.'));
 active=true;
 return new Promise((resolve,reject)=>{
  const child=fork(fileURLToPath(new URL('./heic-worker.mjs',import.meta.url)),[],{stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced',execArgv:['--max-old-space-size=256']});let done=false;
  const finish=(error,data)=>{if(done)return;done=true;active=false;clearTimeout(timer);child.kill('SIGKILL');if(error)reject(error);else resolve(Buffer.from(data));};
  const timer=setTimeout(()=>finish(Error('HEIC conversion timed out. Try a smaller image.')),25000);
  child.once('message',message=>message?.ok?finish(null,message.data):finish(Error('Could not convert this HEIC image. Try another photo.')));
  child.once('error',()=>finish(Error('HEIC conversion failed')));child.once('exit',()=>{if(!done)finish(Error('HEIC conversion failed'));});child.send(buffer);
 });
}
