import assert from 'node:assert/strict';
import {setup,advance,visibleGameState} from '../lib/mini-games.mjs';
const t=setup();for(const[m,v]of[['X',0],['O',3],['X',1],['O',4],['X',2]])advance(t,m,v);assert.equal(t.winner,'X');
const c=setup('connect');for(const[m,v]of[['X',0],['O',1],['X',0],['O',1],['X',0],['O',1],['X',0]])advance(c,m,v);assert.equal(c.winner,'X');assert.equal(c.winningCells.length,4);
const n=setup('nim');for(let i=0;i<7;i++)advance(n,n.turn,3);assert.equal(n.remaining,0);assert.equal(n.winner,'X');
const r=setup('rps');advance(r,'X','rock');assert.equal(visibleGameState(r,'O').choices.X,'ready');advance(r,'O','scissors');assert.equal(r.winner,'X');
const d=setup('dice');advance(d,'X','roll');advance(d,'O','roll');assert.ok(['X','O','draw'].includes(d.winner));assert.ok(d.rolls.X>=1&&d.rolls.X<=6);
const m=setup('memory');assert.ok(visibleGameState(m,'X').faces.every(x=>x===null));assert.equal(visibleGameState(m,'X').deck,undefined);for(let v=0;v<8;v++){const pair=m.deck.flatMap((face,i)=>face===v?[i]:[]);advance(m,m.turn,pair[0]);advance(m,m.turn,pair[1]);}assert.equal(m.winner,'X');assert.equal(m.scores.X,8);
console.log('PASS six games: wins, valid turns, secret RPS choices, server dice, hidden memory deck and completion');
