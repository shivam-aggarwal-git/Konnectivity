import crypto from 'node:crypto';
import {loadSync,saveDebounced} from './store.mjs';
import {notifyRoom} from './social.mjs';
import {setup,advance,visibleGameState,GAME_NAMES} from './mini-games.mjs';
const games=new Map(Object.entries(loadSync('games',{})));
const persist=()=>saveDebounced('games',Object.fromEntries(games));
const identity=p=>p?.mediaIdentity||p?.socialId||p?.id;
const fresh=(type='ttt')=>({id:crypto.randomUUID(),started:false,...setup(type),players:{},revision:0});
export function moveGame(game,key,name,cell){const mark=Object.keys(game.players).find(mark=>game.players[mark].id===key);if(!mark)throw Error('Join the game before playing.');if(!game.players.X||!game.players.O)throw Error('Wait for your partner to accept.');advance(game,mark,cell);game.started=true;game.revision=(game.revision||0)+1;return game;}
function publicGame(game,p,room){const mark=Object.keys(game.players).find(mark=>game.players[mark].id===identity(p))||null;const{invited,...state}=visibleGameState(game,mark);return {...state,players:Object.fromEntries(Object.entries(game.players).map(([key,player])=>[key,{name:player.name}])),you:mark,invited:Boolean(invited?.includes(identity(p))),members:[...room.participants.values()].filter(member=>member.id!==p.id&&identity(member)!==identity(p)&&member.status!=='reconnecting').map(member=>({id:member.id,name:member.nick}))};}
function broadcast(io,room,game){for(const p of room.participants.values())io.to(p.id).emit('game:state',publicGame(game,p,room));persist();}
function alert(io,room,g,actor,invited){const turn=g.type==='rps'&&!g.winner?(g.choices?.X?'O':'X'):g.turn;const target=[...room.participants.values()].find(p=>identity(p)===g.players[turn]?.id);const recipients=invited?[invited]:g.winner?[...room.participants.values()].filter(p=>p.id!==actor.id):target&&target.id!==actor.id?[target]:[];if(!recipients.length)return;const name=GAME_NAMES[g.type]||'X & O';notifyRoom(io,room,{kind:'game',text:invited?`${actor.nick} invited you to ${name}`:g.winner==='draw'?`${name}: it’s a draw`:g.winner?`${g.players[g.winner].name} won ${name}`:`${target.nick}, it’s your turn`,detail:invited?'Accept invitation to join and open the game.':`Open ${name} · keep listening while you play`,gameId:g.id,invitation:Boolean(invited)},recipients);}
export function registerGame(io,socket,inRoom){
 const context=()=>{const room=inRoom(),p=room?.participants.get(socket.id);return p&&p.status!=='reconnecting'?{room,p}:null;};
 socket.on('game:get',(_,ack)=>{const c=context();if(c)ack?.(publicGame(games.get(c.room.code)||fresh(),c.p,c.room));});
 for(const event of ['start','invite','join','accept','decline','move','reset','leave'])socket.on(`game:${event}`,(data={},ack)=>{const c=context();if(!c)return ack?.({error:'Join the room first.'});const{room,p}=c;try{
 let g=games.get(room.code),key=identity(p);
 if(event==='start'){
  if(g?.started&&!g.winner)return ack?.({error:'Finish or restart the current game before changing games.'});
  g=fresh(data.type||'ttt');g.started=true;g.players.X={id:key,name:p.nick};games.set(room.code,g);
 }else{
  if(!g?.started)throw Error('Start a game first.');if(data.gameId&&data.gameId!==g.id)throw Error('This invitation has expired.');
  const mark=Object.keys(g.players).find(mark=>g.players[mark].id===key);
  if(event==='invite'){
   if(!mark||g.players.X&&g.players.O)throw Error('Only a seated player with an open seat can invite.');const target=room.participants.get(data.memberId);if(!target||identity(target)===key||target.status==='reconnecting')throw Error('Choose an active listener.');g.invited=[...new Set([...(g.invited||[]),identity(target)])];alert(io,room,g,p,target);
  }else if(event==='decline'){g.invited=(g.invited||[]).filter(id=>id!==key);
  }else if(event==='join'||event==='accept'){
   if(!mark){if(event==='accept'&&!g.invited?.includes(key))throw Error('This invitation is no longer available.');const seat=!g.players.X?'X':!g.players.O?'O':null;if(!seat)throw Error('Both seats are taken.');g.players[seat]={id:key,name:p.nick};g.invited=[];alert(io,room,g,p);}
  }else if(event==='leave'){
   if(!mark)throw Error('You are not a player in this game.');const partner=mark==='X'?'O':'X';g.winner=g.players[partner]?partner:null;delete g.players[mark];g.invited=[];g.revision++;if(!Object.keys(g.players).length){g=fresh(g.type||'ttt');games.set(room.code,g);}notifyRoom(io,room,{kind:'game',text:`${p.nick} left the game`,detail:'Open Games to choose another round.',gameId:g.id},[...room.participants.values()].filter(member=>member.id!==p.id));
  }else if(event==='reset'){
   if(!mark)throw Error('Only a player can restart.');const previous=g;g=fresh(data.type||previous.type||'ttt');g.started=true;g.players=previous.players;games.set(room.code,g);alert(io,room,g,p);
  }else if(event==='move'){
   if(data.revision!==undefined&&data.revision!==(g.revision||0))throw Error('The board changed. Try again.');moveGame(g,key,p.nick,data.value??data.cell);alert(io,room,g,p);
  }
 }
 broadcast(io,room,g);ack?.({ok:true,game:publicGame(g,p,room)});
 }catch(error){ack?.({error:error.message});}});
}
