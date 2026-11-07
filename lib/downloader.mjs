// Apply the same verified trust roots to metadata, audio and update processes.
import vendor from 'youtube-dl-exec';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {downloaderTrust} from './downloader-trust.mjs';
const privateBinary=fileURLToPath(new URL(`../.runtime/tools/yt-dlp${process.platform==='win32'?'.exe':''}`,import.meta.url));
const binary=process.env.YTDLP_BINARY||(existsSync(privateBinary)?privateBinary:vendor.constants.YOUTUBE_DL_PATH);
const base=vendor.create(binary);
const downloader=(url,flags,options)=>{const trusted=downloaderTrust(flags,options);return base(url,trusted.flags,trusted.options);};
downloader.exec=(url,flags,options)=>{const trusted=downloaderTrust(flags,options);return base.exec(url,trusted.flags,trusted.options);};
downloader.constants={...vendor.constants,YOUTUBE_DL_PATH:binary};
export default downloader;
