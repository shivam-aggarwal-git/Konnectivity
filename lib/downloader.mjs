// Prefer the private standalone downloader installed by the desktop launcher.
import vendor from 'youtube-dl-exec';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const privateBinary=fileURLToPath(new URL(`../.runtime/tools/yt-dlp${process.platform==='win32'?'.exe':''}`,import.meta.url));
const binary=process.env.YTDLP_BINARY||(existsSync(privateBinary)?privateBinary:vendor.constants.YOUTUBE_DL_PATH);
const downloader=vendor.create(binary);
downloader.constants={...vendor.constants,YOUTUBE_DL_PATH:binary};
export default downloader;
