// A public tunnel can stay alive independently while the application restarts.
import {spawn} from 'node:child_process';
import {bin} from 'cloudflared';
import {setPublicUrl,clearPublicUrl} from '../lib/publicurl.mjs';
const port=process.env.PORT||'3000';
const child=spawn(bin,['tunnel','--url',`http://localhost:${port}`],{stdio:['ignore','pipe','pipe']});
let registered='';
const scan=async chunk=>{const url=String(chunk).match(/https:\/\/[-\w.]+\.trycloudflare\.com/)?.[0];if(url&&url!==registered){registered=url;await setPublicUrl(url);console.log(`Public URL: ${url}`);}};
child.stdout.on('data',scan);child.stderr.on('data',scan);
child.on('error',async()=>{await clearPublicUrl();console.error('Public tunnel could not start.');process.exitCode=1;});
child.on('exit',async code=>{await clearPublicUrl();process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
