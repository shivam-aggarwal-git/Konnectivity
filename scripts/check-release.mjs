// Scan the actual release tree before publication. Does not print matched secrets.
import {readdirSync,readFileSync,existsSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),problems=[];
const skip=new Set(['.git','node_modules','.next']);
const forbiddenRoot=['data','cache','.runtime','.env','.env.local','.env.production'];
for(const name of forbiddenRoot)if(existsSync(path.join(root,name)))problems.push(`Remove runtime/private path: ${name}`);
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
 if(skip.has(e.name)||e.name==='check-release.mjs')continue;const p=path.join(dir,e.name),rel=path.relative(root,p);
 if(lstatSync(p).isSymbolicLink()){problems.push(`Remove symlink: ${rel}`);continue;}
 if(e.isDirectory()){walk(p);continue;}
 if(/\.(mp3|flac|wav|m4a|aac|ogg|opus|aiff|alac|wma|pem|key|p12|pfx|zip|gz)$/i.test(e.name))problems.push(`Private or unexpected binary: ${rel}`);
 if(/cookie.*\.(txt|json)$/i.test(e.name)||(/^\.env/.test(e.name)&&e.name!=='.env.example'))problems.push(`Private config: ${rel}`);
 if(/\.(png|jpg|jpeg|webp|ico|woff2?)$/i.test(e.name))continue;
 const text=readFileSync(p,'utf8');
 if(/\/Users\/|\/home\/[^/\s]+\/|https:\/\/[\w-]+\.trycloudflare\.com|# Netscape HTTP Cookie File/.test(text))problems.push(`Personal path, tunnel or session export: ${rel}`);
 if(/(?:AIza[\w-]{30,}|sk-(?:proj-)?[\w-]{24,}|gh[pousr]_[\w]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))problems.push(`Possible credential: ${rel}`);
}}
// Do not scan this scanner's own detection expressions as release content.
walk(root);
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log('PASS: release tree has no runtime data, audio files, cookie exports, personal paths or recognized credential patterns. Review screenshots and git diff before publishing.');
