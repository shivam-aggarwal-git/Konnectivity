import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/launch.mjs','--local','--check','--no-open'],{encoding:'utf8',timeout:300000,env:{...process.env,PORT:'0'}});
assert.equal(result.status,0,result.stderr+'\n'+result.stdout);assert.match(result.stdout,/Required desktop tools are ready/);console.log('PASS: desktop dependency checks, downloader execution and no-open/local check mode');
