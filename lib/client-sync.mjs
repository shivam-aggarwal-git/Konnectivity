// Pure helpers shared by both media renderers and deterministic latency tests.
export function createSyncClock(monotonic = () => performance.now()) {
  let offset = null;
  let samples = [];
  return {
    now: () => (offset ?? Date.now() - monotonic()) + monotonic(),
    calibrated: () => samples.length > 0,
    seed(serverNow) { if (offset === null && Number.isFinite(serverNow)) offset = serverNow - monotonic(); },
    sample(sent, received, serverNow) {
      const rtt = received - sent;
      if (![sent,received,serverNow,rtt].every(Number.isFinite) || rtt < 0 || rtt > 10000) return null;
      samples = samples.filter(s => received - s.at < 45000);
      samples.push({ at: received, rtt, offset: serverNow - (sent + received) / 2 });
      samples = samples.slice(-24);
      const fast = [...samples].sort((a,b) => a.rtt-b.rtt).slice(0,3);
      const target = fast.map(s=>s.offset).sort((a,b)=>a-b)[Math.floor(fast.length/2)];
      offset = offset === null || samples.length <= 3 || Math.abs(target-offset)>250 ? target : offset+(target-offset)*.15;
      return { rtt, samples: samples.length };
    },
  };
}
export function playbackPosition(playback, now) {
  if (!playback.isPlaying || playback.syncHolding || now < (playback.resumeAt || 0)) return Math.max(0, playback.pausedPosition || 0);
  return Math.max(0, (now-playback.startedAt)/1000);
}
export function playbackRunning(playback, now) { return Boolean(playback.isPlaying && !playback.syncHolding && now >= (playback.resumeAt || 0)); }
export function correction(actual,target,playing,force=false) {
  const drift=actual-target;
  if(force || Math.abs(drift)>.75 || (!playing && Math.abs(drift)>.04))return{seek:Math.max(0,target),rate:1};
  return{seek:null,rate:playing&&Math.abs(drift)>.04?1-Math.max(-.04,Math.min(.04,drift)):1};
}
