export const SETTINGS_INDEX=[
 ['appearance','Appearance & themes','Settings · Appearance','theme dark light pearl terminal colors background artwork visualizer ambient room lights animation'],
 ['sound','Sound & playback','Settings · Sound','volume audio equalizer voice music'],
 ['sync','Device synchronization','Room management · Synchronization','unsync sync detach local device playback'],
 ['continuous','Continuous play','Settings · Playback','autoplay next recommendation similar songs endless'],
 ['personal-cookies','My YouTube account','Settings · Personal cookies','youtube cookies upload replace remove account video login'],
 ['integrations','Music integrations','Room management · Integrations','host youtube cookie spotify upload delete cookies'],
 ['hosts','Hosts, listeners & requests','Room management · People','cohost co host two hosts permissions approve listener admin'],
 ['permissions','Listener permissions','Room management · Permissions','control access allow restrict manage'],
 ['identity','Group name & avatar','Room management · Identity','rename room group name image picture photo'],
 ['mood','Room mood','Room management · Mood','emoji chill gaming study romantic'],
 ['discovery','Group discovery','Room management · Discovery','public visible random discoverable private'],
 ['switch','Switch room','Settings · Switch room','change party random browse rooms'],
 ['dj','AI DJ','Settings · AI DJ','artificial intelligence provider model ollama lm studio open code'],
 ['notifications','Notification sounds','Settings · Notifications','bell alerts mute buzz'],
 ['saved','Save settings across rooms','Settings · Saved preferences','persistent remember data preferences profile playlists theme'],
 ['reset','Reset appearance & playback','Settings · Reset','default restore clear preferences'],
 ['shortcuts','Keyboard shortcuts','Settings · Shortcuts','keys hotkeys keyboard controls'],
 ['guide','Room guide','Settings · Guide','tour help tutorial onboarding'],
 ['games','Games','Room · Games','tic tac toe x o connect four memory dice rock paper scissors nim']
].map(([id,label,path,keywords])=>({id,label,path,keywords}));
const normalize=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function distance(a,b){const table=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)table[i][0]=i;for(let j=0;j<=b.length;j++)table[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){table[i][j]=Math.min(table[i-1][j]+1,table[i][j-1]+1,table[i-1][j-1]+Number(a[i-1]!==b[j-1]));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])table[i][j]=Math.min(table[i][j],table[i-2][j-2]+1);}return table[a.length][b.length];}
export function searchSettings(query,entries=SETTINGS_INDEX){const tokens=normalize(query).slice(0,120).split(' ').filter(Boolean);if(!tokens.length)return [];return entries.map(entry=>{const words=normalize(entry.label+' '+entry.keywords).split(' ');const costs=tokens.map(token=>Math.min(...words.map(word=>word===token?0:word.startsWith(token)?.2:word.includes(token)?.5:token.length>=3&&distance(token,word)<=Math.max(1,Math.floor(token.length/4))?1:99)));return {entry,score:costs.reduce((a,b)=>a+b,0),match:costs.every(n=>n<99)};}).filter(r=>r.match).sort((a,b)=>a.score-b.score||a.entry.label.localeCompare(b.entry.label)).map(r=>r.entry);}
