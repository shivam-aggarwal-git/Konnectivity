import assert from 'node:assert/strict';
import {normalizeMusicTrack} from '../lib/music-metadata.mjs';
import {recommendationSeed,keepQueueTrack,matchingRecommendations,artistAffinity} from '../lib/recommendation-match.mjs';
// This is the package's actual Up Next response shape, not its TypeScript schema.
const song=normalizeMusicTrack({type:'SONG',videoId:'abcdefghijk',title:'Safar',artists:'Juss',duration:'3:18',thumbnail:'https://i.ytimg.com/vi/abcdefghijk/default.jpg'});
assert.equal(song.artist,'Juss');assert.equal(song.duration,198);assert.ok(song.thumbnail);
assert.equal(normalizeMusicTrack({duration:'1:02:03'}).duration,3723);
const chosen={videoId:'seed',title:'Suniyan Suniyan',artist:'Juss',duration:198,addedBy:'Listener'};
const old={videoId:'old',title:'中文',artist:'Unknown',duration:0,addedBy:'Autoplay'};
assert.equal(recommendationSeed({current:old,history:[chosen,old]}).videoId,'seed');
assert.equal(keepQueueTrack(old,chosen),false);assert.equal(keepQueueTrack({...old,addedBy:'Listener'},chosen),true);
assert.equal(matchingRecommendations([old,song],chosen).length,1);
assert.equal(matchingRecommendations([{...song,title:'한국어'}],chosen).length,0);
console.log('PASS: real Up Next string fields, duration conversion, artist and artwork, stable original seed, stale autoplay cleanup and manual queue preservation');

assert.ok(artistAffinity({artist:'Juss'},chosen)>0);assert.equal(artistAffinity({artist:'Kenny Rogers'},chosen),0);assert.equal(artistAffinity({artist:'Unknown'},chosen),0);
