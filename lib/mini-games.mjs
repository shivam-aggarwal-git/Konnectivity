import {randomInt} from 'node:crypto';
export const GAME_NAMES={ttt:'X & O',connect:'Four in a row',nim:'Last match',dice:'Dice duel',rps:'Rock paper scissors',memory:'Memory pairs'};
export function setup(type='ttt'){
 if(!GAME_NAMES[type])throw Error('Choose a game from the list.');
 const base={type,board:Array(type==='connect'?42:9).fill(null),turn:'X',winner:null,winningCells:[],scores:{X:0,O:0},round:1};
 if(type==='nim')base.remaining=21;
 if(type==='rps')base.choices={};
 if(type==='dice')base.rolls={};
 if(type==='memory'){base.deck=Array.from({length:16},(_,i)=>Math.floor(i/2));for(let i=15;i>0;i--){const j=randomInt(i+1);[base.deck[i],base.deck[j]]=[base.deck[j],base.deck[i]];}base.board=Array(16).fill(null);base.revealed=[];base.matched=[];}
 return base;
}
const other=mark=>mark==='X'?'O':'X';
export function advance(g,mark,value){
 if(g.winner)throw Error('This round has finished. Start over to play again.');
 if(g.type!=='rps'&&g.turn!==mark)throw Error('Wait for your turn.');
 if(g.type==='rps'){
  if(!['rock','paper','scissors'].includes(value)||g.choices[mark])throw Error('Choose once per round.');g.choices[mark]=value;
  if(g.choices.X&&g.choices.O){const a=g.choices.X,b=g.choices.O;g.winner=a===b?'draw':({rock:'scissors',paper:'rock',scissors:'paper'}[a]===b?'X':'O');}return;
 }
 if(g.type==='dice'){if(g.rolls[mark])throw Error('You already rolled.');g.rolls[mark]=randomInt(1,7);if(g.rolls.X&&g.rolls.O)g.winner=g.rolls.X===g.rolls.O?'draw':g.rolls.X>g.rolls.O?'X':'O';g.turn=other(mark);return;}
 if(g.type==='nim'){if(!Number.isInteger(value)||value<1||value>3||value>g.remaining)throw Error('Take one, two or three matches.');g.remaining-=value;if(!g.remaining)g.winner=mark;g.turn=other(mark);return;}
 if(g.type==='memory'){
  if(!Number.isInteger(value)||value<0||value>15||g.matched.includes(value))throw Error('Choose a face-down card.');
  if(g.revealed.length===2)g.revealed=[];if(g.revealed.includes(value))throw Error('Choose a different card.');g.revealed.push(value);
  if(g.revealed.length===2){const[a,b]=g.revealed;if(g.deck[a]===g.deck[b]){g.matched.push(a,b);g.scores[mark]++;if(g.matched.length===16)g.winner=g.scores.X===g.scores.O?'draw':g.scores.X>g.scores.O?'X':'O';}else g.turn=other(mark);}return;
 }
 if(g.type==='connect'){
  if(!Number.isInteger(value)||value<0||value>6)throw Error('Choose a column.');let row=5;while(row>=0&&g.board[row*7+value])row--;if(row<0)throw Error('That column is full.');g.board[row*7+value]=mark;
  for(let r=0;r<6;r++)for(let c=0;c<7;c++)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){const line=Array.from({length:4},(_,i)=>[r+i*dr,c+i*dc]);if(line.every(([y,x])=>y>=0&&y<6&&x>=0&&x<7&&g.board[y*7+x]===mark)){g.winner=mark;g.winningCells=line.map(([y,x])=>y*7+x);}}
 }else{if(!Number.isInteger(value)||value<0||value>8||g.board[value])throw Error('Choose an empty square.');g.board[value]=mark;g.winningCells=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(line=>line.every(i=>g.board[i]===mark))||[];if(g.winningCells.length)g.winner=mark;}
 if(!g.winner&&g.board.every(Boolean))g.winner='draw';g.turn=other(mark);
}
export function visibleGameState(g,mark){const {deck,choices,...rest}=g;return {...rest,...(g.type==='memory'?{faces:g.board.map((_,i)=>g.matched.includes(i)||g.revealed.includes(i)?deck[i]:null)}:{}),...(g.type==='rps'?{choices:g.winner?choices:Object.fromEntries(Object.entries(choices).map(([key,value])=>[key,key===mark?value:'ready']))}:{})};}
