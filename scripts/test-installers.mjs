import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
if(process.platform==='win32'){console.log('Shell installer checks run on macOS/Linux');process.exit(0);}
const root=mkdtempSync(path.join(tmpdir(),'konnectivity installer-'));
try{
 const existing=path.join(root,'existing app');mkdirSync(existing);writeFileSync(path.join(existing,'start.sh'),'#!/bin/bash\nprintf "%s\\n" "$@" > args.txt\n');writeFileSync(path.join(existing,'keep.txt'),'personal data fixture');
 let r=spawnSync('bash',['install.sh','--check'],{env:{...process.env,KONNECTIVITY_INSTALL_DIR:existing},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(path.join(existing,'args.txt'),'utf8'),'--local\n--check\n');assert.equal(readFileSync(path.join(existing,'keep.txt'),'utf8'),'personal data fixture');
 const blocked=path.join(root,'unrelated');mkdirSync(blocked);r=spawnSync('bash',['install.sh'],{env:{...process.env,KONNECTIVITY_INSTALL_DIR:blocked},encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/not a Konnectivity installation/);
 const source=path.join(root,'source');mkdirSync(path.join(source,'Konnectivity-main'),{recursive:true});writeFileSync(path.join(source,'Konnectivity-main','start.sh'),'#!/bin/bash\nprintf "%s\\n" "$@" > args.txt\n');
 const archive=path.join(root,'source.tar.gz');assert.equal(spawnSync('tar',['-czf',archive,'-C',source,'Konnectivity-main']).status,0);
 const bin=path.join(root,'bin');mkdirSync(bin);writeFileSync(path.join(bin,'curl'),'#!/bin/bash\nfor arg in "$@"; do output="$arg"; done\ncp "$KN_TEST_ARCHIVE" "$output"\n',{mode:0o755});
 const fresh=path.join(root,'fresh app');r=spawnSync('bash',['install.sh','--check'],{env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,KN_TEST_ARCHIVE:archive,KONNECTIVITY_INSTALL_DIR:fresh},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(path.join(fresh,'args.txt'),'utf8'),'--local\n--check\n');
 console.log('PASS: fresh archive extraction, paths with spaces, local-mode launch, existing-data preservation and refusal to overwrite unrelated folders');
}finally{rmSync(root,{recursive:true,force:true});}
