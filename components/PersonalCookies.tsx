"use client";
import {useEffect,useRef,useState} from 'react';
import {Upload,Trash2} from 'lucide-react';
import {notify} from './FeedbackToast';
import CookieExportHelp from './CookieExportHelp';
import {Button} from './ui/button';
export default function PersonalCookies({code,token,onChanged}:{code:string;token:string;onChanged:()=>void}) {
 const [present,setPresent]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const input=useRef<HTMLInputElement>(null);
 async function request(method:string,file?:File){const response=await fetch(`/api/member-cookies?room=${encodeURIComponent(code)}`,{method,body:file,headers:{'x-upload-token':token}});const result=await response.json();if(!response.ok)throw Error(result.error);setPresent(result.present);return result;}
 useEffect(()=>{void request('GET').catch(error=>setStatus(error.message));},[code,token]);
 async function change(method:string,file?:File){setBusy(true);setStatus('');try {if(file&&file.size>262144)throw Error('Choose a cookies.txt file up to 256 KB.');await request(method,file);setStatus(method==='DELETE'?'Using host cookies.':'Personal cookies saved for your server-resolved media.');notify(method==='DELETE'?'Personal YouTube cookies removed. Using host cookies.':'YouTube cookies added. Retry the paused track to use them.');onChanged();}catch(error){setStatus(error instanceof Error?error.message:'Cookie update failed.');}finally{setBusy(false);}}
 return <details className="kn-personal-cookies"><summary>My YouTube account · optional</summary><div className="space-y-3 py-4"><p>{present?'Using your personal cookies for media resolved by this server.':'Using host cookies. Upload your own only if you want a separate resolver account.'}</p><p className="text-sm text-muted">Other listeners cannot read your cookie file. Embedded YouTube video uses the app or browser’s YouTube sign-in; uploading cookies does not log the iframe in.</p><input ref={input} type="file" accept=".txt,text/plain" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void change('POST',file);}}/><Button type="button" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{busy?'Working…':present?'Replace my cookies':'Upload my cookies.txt'}</Button>{present&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void change('DELETE')}><Trash2 size={16}/>Remove mine · use host cookies</Button>}<CookieExportHelp/>{status&&<p role="status" className="text-sm">{status}</p>}</div></details>;
}
