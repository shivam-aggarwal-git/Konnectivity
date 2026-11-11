"use client";
import {acquireMedia,restoreAudioSession} from '@/lib/call-media';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {startRing,stopRing,unlockSounds} from '@/lib/notification-sounds';
import type {CallInvitation,CallMember} from '@/lib/types';
type Peer={pc:RTCPeerConnection;making:boolean;ignore:boolean;settingAnswer:boolean;candidates:RTCIceCandidateInit[];media:MediaStream;pending:Promise<void>;timeout:ReturnType<typeof setTimeout>|null;ready:Promise<void>;attach:()=>Promise<void>};
export function useRoomCall(socket:Socket|null){
 const [provider,setProvider]=useState('direct');
 const [startedAt,setStartedAt]=useState(0),[elapsed,setElapsed]=useState(0);
 useEffect(()=>{if(!startedAt)return;const tick=()=>setElapsed(Math.floor((Date.now()-startedAt)/1000));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[startedAt]);
 const facing=useRef<'user'|'environment'>('user');
 const [usage,setUsage]=useState<{usedGB:number;limitGB:number;checkedAt:number}|null>(null);
 const [previewing,setPreviewing]=useState(false),[incoming,setIncoming]=useState<CallInvitation|null>(null);
 const declined=useRef(new Set<string>());
 const pendingSignals=useRef<any[]>([]),receiveSignal=useRef<(value:any)=>void>(()=>{});
 const [inCall,setInCall]=useState(false),[busy,setBusy]=useState(false),[members,setMembers]=useState<CallMember[]>([]),[local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[error,setError]=useState(''),[mic,setMic]=useState(true),[camera,setCamera]=useState(false),[sharing,setSharing]=useState(false),[relay,setRelay]=useState(false),[connections,setConnections]=useState<Record<string,string>>({});
 const active=useRef(false),mediaAction=useRef(false),joining=useRef(false),generation=useRef(0),peers=useRef(new Map<string,Peer>()),stream=useRef<MediaStream|null>(null),cameraTrack=useRef<MediaStreamTrack|null>(null),screen=useRef<MediaStream|null>(null),config=useRef<RTCConfiguration>({}),known=useRef<CallMember[]>([]);
 const request=useCallback((event:string,data:unknown={})=>new Promise<any>((resolve,reject)=>{if(!socket?.connected)return reject(Error('Room connection lost. Rejoin the room first.'));socket.timeout(event==='call:join'||event==='call:renew'?20000:10000).emit(event,data,(err:Error|null,result:any)=>err?reject(Error('Request timed out. Please try again.')):result?.error?reject(Error(result.error)):resolve(result));}),[socket]);
 const cleanup=useCallback(()=>{active.current=false;joining.current=false;pendingSignals.current=[];generation.current++;for(const p of peers.current.values()){if(p.timeout)clearTimeout(p.timeout);p.pc.close();}peers.current.clear();stream.current?.getTracks().forEach(t=>t.stop());cameraTrack.current?.stop();screen.current?.getTracks().forEach(t=>t.stop());stream.current=null;restoreAudioSession();cameraTrack.current=null;screen.current=null;setInCall(false);setStartedAt(0);setElapsed(0);setPreviewing(false);stopRing();setIncoming(null);setLocal(null);setRemote({});setConnections({});setSharing(false);setCamera(false);setMic(true);setBusy(false);},[]);
 const leave=useCallback(()=>{void request('call:leave').catch(()=>{});cleanup();},[request,cleanup]);
 const signal=useCallback((to:string,value:unknown)=>{void request('call:signal',{to,signal:value}).catch(e=>{if(active.current)setError(e.message);});},[request]);
 const makePeer=useCallback((id:string)=>{
  if(peers.current.has(id))return peers.current.get(id)!;
  const pc=new RTCPeerConnection(config.current),peer:Peer={pc,making:false,ignore:false,settingAnswer:false,candidates:[],media:new MediaStream(),pending:Promise.resolve(),timeout:null,ready:Promise.resolve(),attach:async()=>{}};peers.current.set(id,peer);
  peer.attach=async()=>{const tracks=stream.current?.getTracks()||[];await Promise.all(pc.getTransceivers().map(async t=>{const kind=t.receiver.track.kind;const track=kind==='video'?(screen.current?.getVideoTracks()[0]||cameraTrack.current):tracks.find(x=>x.kind===kind);t.direction='sendrecv';if(track){await t.sender.replaceTrack(track);t.sender.setStreams(stream.current!);const params=t.sender.getParameters();params.encodings=params.encodings?.length?params.encodings:[{}];params.encodings[0].maxBitrate=kind==='audio'?64000:450000;try{await t.sender.setParameters(params);}catch{}}}));};
  // Only the initial offerer creates transceivers. The answerer binds to the
  // offered transceivers after setRemoteDescription; pre-creating its own can
  // leave local tracks on unnegotiated senders and produce a one-way call.
  if(String(socket?.id)<id){pc.addTransceiver('audio',{direction:'sendrecv',streams:stream.current?[stream.current]:[]});pc.addTransceiver('video',{direction:'sendrecv',streams:stream.current?[stream.current]:[]});peer.ready=peer.attach();}
  peer.timeout=setTimeout(()=>{if(pc.connectionState!=='connected'&&pc.connectionState!=='closed'){pc.close();setConnections(v=>({...v,[id]:'failed'}));setError('Unable to establish a network connection. Try rejoining the call. Some networks require a TURN relay.');}},30000);
  pc.onicecandidate=e=>{if(e.candidate&&active.current)signal(id,{candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{if(!peer.media.getTracks().some(t=>t.id===e.track.id))peer.media.addTrack(e.track);const update=()=>{if(active.current&&peers.current.has(id))setRemote(v=>({...v,[id]:new MediaStream(peer.media.getTracks())}));};e.track.onunmute=update;e.track.onmute=update;e.track.onended=update;update();};
  pc.onconnectionstatechange=()=>{if(active.current){setConnections(v=>({...v,[id]:pc.connectionState}));if(pc.connectionState==='connected'&&peer.timeout){clearTimeout(peer.timeout);peer.timeout=null;}if(pc.connectionState==='failed')setError('The peer connection failed. Retry the call or configure a TURN relay for this network.');}};
  pc.onnegotiationneeded=async()=>{try{if(!active.current||String(socket?.id)>id||peer.making||pc.signalingState!=='stable')return;peer.making=true;await peer.ready;await pc.setLocalDescription();if(active.current)signal(id,{description:pc.localDescription});}catch(e){if(active.current)setError('Could not negotiate a connection. Leave and rejoin the call.');}finally{peer.making=false;}};
  return peer;
 },[signal,socket]);
 const reconcile=useCallback((list:CallMember[])=>{known.current=list;setMembers(list);if(!active.current)return;for(const [id,p]of peers.current){if(!list.some(x=>x.id===id)){if(p.timeout)clearTimeout(p.timeout);p.pc.close();peers.current.delete(id);setRemote(v=>{const n={...v};delete n[id];return n;});setConnections(v=>{const n={...v};delete n[id];return n;});}}if(!list.some(x=>x.id===socket?.id)){cleanup();return;}for(const m of list)if(m.id!==socket?.id)makePeer(m.id);},[makePeer,socket,cleanup]);
 useEffect(()=>{if(!socket)return;
  const state=(v:{members:CallMember[];invitation?:CallInvitation|null})=>{reconcile(v.members||[]);const i=v.invitation;if(i&&i.from!==socket.id&&!active.current&&!declined.current.has(i.id)&&i.expiresAt>Date.now())setIncoming(i);else{setIncoming(null);stopRing();}};
  const incoming=async({from,signal:s}:{from:string;signal:{description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit}})=>{
   if(!active.current){if(joining.current&&pendingSignals.current.length<100)pendingSignals.current.push({from,signal:s});return;}if(!known.current.some(m=>m.id===from))return;
   const p=makePeer(from),pc=p.pc,polite=String(socket.id)>from;
   p.pending=p.pending.then(async()=>{await p.ready;try{
    if(s.description){const d=s.description;const ready=!p.making&&(pc.signalingState==='stable'||p.settingAnswer);const collision=d.type==='offer'&&!ready;p.ignore=!polite&&collision;if(p.ignore)return;p.settingAnswer=d.type==='answer';await pc.setRemoteDescription(d);p.settingAnswer=false;for(const c of p.candidates.splice(0))await pc.addIceCandidate(c);if(d.type==='offer'){await p.attach();await pc.setLocalDescription();signal(from,{description:pc.localDescription});}}
    else if(s.candidate&&!p.ignore){if(pc.remoteDescription)await pc.addIceCandidate(s.candidate);else p.candidates.push(s.candidate);}
   }catch{if(active.current&&!p.ignore)setError('A peer connection could not be established. Try rejoining; restrictive networks may need TURN.');}});await p.pending;
  };
  receiveSignal.current=value=>void incoming(value);
  const lost=()=>{cleanup();setMembers([]);setError('Room connection ended. Call media has stopped.');};
  const ended=(v:{message:string})=>{cleanup();setError(v.message);};const rejected=(v:{nick:string})=>setError(`${v.nick} declined the call.`);
  socket.on('call:ended',ended);socket.on('call:declined',rejected);
  socket.on('call:state',state);socket.on('call:signal',incoming);socket.on('disconnect',lost);socket.on('kicked',lost);socket.on('room:ended',lost);
  void request('social:get').then(v=>state(v.call)).catch(()=>{});
  return()=>{if(active.current)socket.emit('call:leave',{});cleanup();socket.off('call:ended',ended);socket.off('call:declined',rejected);socket.off('call:state',state);socket.off('call:signal',incoming);socket.off('disconnect',lost);socket.off('kicked',lost);socket.off('room:ended',lost);};
 },[socket,reconcile,makePeer,signal,request,cleanup]);
 useEffect(()=>{if(!incoming)return;startRing();const timer=setTimeout(()=>{setIncoming(null);stopRing();},Math.max(0,incoming.expiresAt-Date.now()));return()=>{clearTimeout(timer);stopRing();};},[incoming?.id]);
 const decline=()=>{if(incoming){declined.current.add(incoming.id);void request('call:decline',{id:incoming.id}).catch(()=>{});}setIncoming(null);stopRing();};
 const preview=async(video:boolean)=>{if(joining.current||active.current)return;unlockSounds();stopRing();setIncoming(null);joining.current=true;setBusy(true);setError('');const gen=++generation.current;try{if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Calls require HTTPS or localhost.');const media=await acquireMedia({audio:{echoCancellation:true,noiseSuppression:true},video:video?{width:{ideal:640},height:{ideal:360}}:false});if(gen!==generation.current){media.getTracks().forEach(t=>t.stop());return;}stream.current?.getTracks().forEach(t=>t.stop());stream.current=media;cameraTrack.current=media.getVideoTracks()[0]||null;setLocal(media);setPreviewing(true);setCamera(video);setMic(true);}catch(e){setError(e instanceof Error?e.message:'Unable to open camera or microphone.');}finally{joining.current=false;setBusy(false);}};
 useEffect(() => {
  if (!inCall) return;
  const timer = setInterval(() => {
   void request('call:renew').then(value => {
    if (!active.current) return;
    setUsage(value.budget || null);
    config.current = { iceServers: value.iceServers, iceTransportPolicy: value.iceTransportPolicy };
    for (const [id, peer] of peers.current) {
     if (peer.pc.signalingState === 'closed') continue;
     peer.pc.setConfiguration(config.current);
     // The same peer that makes initial offers restarts ICE with fresh relay credentials.
     if (value.relayAvailable && String(socket?.id) < id) peer.pc.restartIce();
    }
   }).catch(error => {
    void request('call:leave').catch(() => {});
    cleanup();
    setError(error.message);
   });
  }, 120000);
  return () => clearInterval(timer);
 }, [inCall, request, cleanup, socket]);
 useEffect(()=>{if(inCall&&members.length===1)startRing();else if(inCall)stopRing();return()=>stopRing();},[inCall,members.length]);
 const join=async(video:boolean)=>{if(joining.current||active.current)return;unlockSounds();setIncoming(null);startRing();joining.current=true;setBusy(true);setError('');const gen=++generation.current;let media:MediaStream|null=null;
  try{if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Open the room over HTTPS or localhost to make calls.');const ringing=request('call:ring',{video});ringing.catch(()=>{});const capture=stream.current?Promise.resolve(stream.current):acquireMedia({audio:{echoCancellation:true,noiseSuppression:true},video:video?{width:{ideal:640},height:{ideal:360},frameRate:{ideal:20,max:24}}:false});capture.catch(()=>{});try{await ringing;}catch(e){void capture.then(s=>s.getTracks().forEach(t=>t.stop())).catch(()=>{});throw e;}media=await capture;if(gen!==generation.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;cameraTrack.current=media.getVideoTracks()[0]||null;setLocal(media);const result=await request('call:join',{video:media.getVideoTracks().some(t=>t.enabled),mic:media.getAudioTracks().some(t=>t.enabled)});if(gen!==generation.current){media.getTracks().forEach(t=>t.stop());void request('call:leave').catch(()=>{});return;}config.current={iceServers:result.iceServers,iceTransportPolicy:result.iceTransportPolicy};setRelay(result.relayAvailable);setProvider(result.provider||'direct');setUsage(result.budget||null);active.current=true;setPreviewing(false);setIncoming(null);stopRing();setInCall(true);setStartedAt(Date.now());setCamera(Boolean(cameraTrack.current?.enabled));setMic(Boolean(media.getAudioTracks()[0]?.enabled));reconcile(result.members);for(const queued of pendingSignals.current.splice(0))receiveSignal.current(queued);
  }catch(e){media?.getTracks().forEach(t=>t.stop());cleanup();void request('call:leave').catch(()=>{});setError(e instanceof Error?e.message:'Camera or microphone could not be opened.');}finally{joining.current=false;setBusy(false);}
 };
 const publishMedia=()=>{if(active.current)void request('call:media',{mic:Boolean(stream.current?.getAudioTracks()[0]?.enabled),camera:Boolean(cameraTrack.current?.enabled),sharing:Boolean(screen.current)}).catch(()=>{});};
 const replaceVideo=async(track:MediaStreamTrack|null)=>{await Promise.all([...peers.current.values()].map(p=>p.pc.getTransceivers().find(t=>t.receiver.track.kind==='video')?.sender.replaceTrack(track)));};
 const stopScreen=async()=>{const old=screen.current;screen.current=null;setSharing(false);try{await replaceVideo(cameraTrack.current?.enabled?cameraTrack.current:null);}finally{old?.getTracks().forEach(t=>t.stop());setLocal(stream.current?new MediaStream(stream.current.getTracks()):null);publishMedia();}};
 const toggleCamera=async()=>{if((!active.current&&!stream.current)||mediaAction.current)return;mediaAction.current=true;setError('');try{if(cameraTrack.current){cameraTrack.current.enabled=!cameraTrack.current.enabled;setCamera(cameraTrack.current.enabled);}else{const gen=generation.current;const s=await acquireMedia({video:{width:{ideal:640},height:{ideal:360}},audio:false});if(!stream.current||generation.current!==gen){s.getTracks().forEach(t=>t.stop());return;}cameraTrack.current=s.getVideoTracks()[0];stream.current?.addTrack(cameraTrack.current);setCamera(true);}if(!screen.current)await replaceVideo(cameraTrack.current.enabled?cameraTrack.current:null);setLocal(stream.current?new MediaStream(stream.current.getTracks()):null);}catch(e){setError('Camera unavailable. Check your browser permissions.');}finally{publishMedia();mediaAction.current=false;}};
 const switchCamera=async()=>{if(!active.current||mediaAction.current)return;mediaAction.current=true;setError('');let replacement:MediaStream|null=null;try{const gen=generation.current;const old=cameraTrack.current;const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const index=devices.findIndex(d=>d.deviceId===old?.getSettings().deviceId);const next=devices.length>1?devices[(index+1)%devices.length]:null;const direction=facing.current==='user'?'environment':'user';replacement=await acquireMedia({audio:false,video:{...(next?{deviceId:{exact:next.deviceId}}:{facingMode:{ideal:direction}}),width:{ideal:640},height:{ideal:360}}});if(!active.current||gen!==generation.current){replacement.getTracks().forEach(t=>t.stop());return;}const track=replacement.getVideoTracks()[0];if(!track)throw Error('No camera available.');if(!screen.current)await replaceVideo(track);if(old)stream.current?.removeTrack(old);stream.current?.addTrack(track);cameraTrack.current=track;facing.current=direction;old?.stop();setCamera(true);if(!screen.current)setLocal(new MediaStream(stream.current!.getTracks()));}catch{replacement?.getTracks().forEach(t=>t.stop());setError('Unable to switch camera. Check camera permissions and available cameras.');}finally{publishMedia();mediaAction.current=false;}};
 const shareScreen=async()=>{if(!active.current||mediaAction.current)return;mediaAction.current=true;try{if(screen.current){await stopScreen();return;}if(!navigator.mediaDevices.getDisplayMedia)throw Error('Screen sharing is not supported in this browser.');const gen=generation.current,s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});if(!active.current||generation.current!==gen){s.getTracks().forEach(t=>t.stop());return;}screen.current=s;const track=s.getVideoTracks()[0];track.onended=()=>{void stopScreen().catch(()=>setError('Screen sharing ended. Rejoin if your camera does not return.'));};await replaceVideo(track);setSharing(true);setLocal(new MediaStream([track,...(stream.current?.getAudioTracks()||[])]));}catch(e){const failed=screen.current;screen.current=null;failed?.getTracks().forEach(t=>t.stop());setSharing(false);setLocal(stream.current?new MediaStream(stream.current.getTracks()):null);setError(e instanceof Error?e.message:'Screen sharing was cancelled.');}finally{publishMedia();mediaAction.current=false;}};
 const toggleMic=()=>{const track=stream.current?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;setMic(track.enabled);publishMedia();}};
 return {elapsed,switchCamera,provider,usage,previewing,incoming,preview,cancelPreview:cleanup,decline,inCall,busy,members,local,remote,error,mic,camera,sharing,relay,connections,join,leave,toggleMic,toggleCamera,shareScreen,request};
}
