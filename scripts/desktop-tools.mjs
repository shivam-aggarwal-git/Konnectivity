import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename,chmod,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
export function standaloneAsset(platform=process.platform,arch=process.arch,musl=false){
 if(platform==='darwin'&&['x64','arm64'].includes(arch))return 'yt-dlp_macos';
 if(platform==='win32')return arch==='arm64'?'yt-dlp_arm64.exe':arch==='x64'?'yt-dlp.exe':null;
 if(platform==='linux'&&['x64','arm64'].includes(arch))return `yt-dlp_${musl?'musllinux':'linux'}${arch==='arm64'?'_aarch64':''}`;
 return null;
}
export function checksumFor(manifest,name){const line=String(manifest).split(/\r?\n/).find(line=>line.trim().split(/\s+/).at(-1)?.replace(/^\*/,'')===name);const sum=line?.trim().split(/\s+/)[0];if(!/^[a-f0-9]{64}$/i.test(sum||''))throw Error('Official download checksum missing');return sum.toLowerCase();}
export function executableWorks(binary,args=['--version']){return Boolean(binary)&&spawnSync(binary,args,{stdio:'ignore',timeout:30000,windowsHide:true}).status===0;}
/** Credentials are sent only to GitHub's release metadata API, never asset redirects. */
export function releaseHeaders(token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN){
 return {accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})};
}
export async function ensureDownloader(root,existing){
 if(process.env.YTDLP_BINARY){if(!executableWorks(process.env.YTDLP_BINARY))throw Error('YTDLP_BINARY cannot run');return process.env.YTDLP_BINARY;}
 const target=path.join(root,'.runtime','tools',`yt-dlp${process.platform==='win32'?'.exe':''}`);
 if(executableWorks(target))return target;
 if(executableWorks(existing))return existing;
 const musl=process.platform==='linux'&&!process.report.getReport().header.glibcVersionRuntime;
 const asset=standaloneAsset(process.platform,process.arch,musl);if(!asset)throw Error('No automatic yt-dlp build for this platform');
 console.log('  Installing a standalone downloader (no separate Python installation needed)…');
 const meta=await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',{headers:releaseHeaders(),signal:AbortSignal.timeout(30000)});if(!meta.ok)throw Error('Could not read official yt-dlp release');const release=await meta.json();
 const base=`https://github.com/yt-dlp/yt-dlp/releases/download/${encodeURIComponent(release.tag_name)}/`;
 const sums=await fetch(base+'SHA2-256SUMS',{signal:AbortSignal.timeout(30000)});if(!sums.ok)throw Error('Could not verify downloader');const expected=checksumFor(await sums.text(),asset);
 const response=await fetch(base+asset,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Downloader download failed');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>150*1024*1024)throw Error('Downloader exceeds size limit');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Downloader checksum mismatch');
 await mkdir(path.dirname(target),{recursive:true});const temp=target+'.download';await writeFile(temp,bytes,{mode:0o755});await rename(temp,target);await chmod(target,0o755);
 if(!executableWorks(target)){await rm(target,{force:true});throw Error('Downloaded yt-dlp cannot run on this OS');}
 return target;
}
