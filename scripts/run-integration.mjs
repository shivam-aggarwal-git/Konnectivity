// Every suite gets its own disposable state, never the developer's library.
import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=mkdtempSync(path.join(tmpdir(),'konnectivity-tests-'));
let failed=false;
try {
 for(const suite of ['test-personal-youtube','test-playback-preferences','test-settings-persistence','test-cohosts','test-room-admin','test-admin-permissions','test-browser-playback','test-playback-recovery','test-call-media','test-turn-budget','test-room-social','test-personal-space','test-playlist-arrange','test-lyrica','test-playlist-import','test-image-lyrics','test-appearance','test-security','test-auto-sync','test-media','test-library','test-shared']) {
  const data=path.join(root,suite,'data'),cache=path.join(root,suite,'cache');
  mkdirSync(data,{recursive:true});mkdirSync(cache,{recursive:true});
  const result=spawnSync(process.execPath,[`scripts/${suite}.mjs`],{stdio:'inherit',env:{...process.env,DATA_DIR:data,CACHE_DIR:cache,YTDLP_AUTO_UPDATE:'false'}});
  if(result.status!==0){failed=true;break;}
 }
} finally {rmSync(root,{recursive:true,force:true});}
process.exitCode=failed?1:0;
