import assert from 'node:assert/strict';
import {createSyncClock,playbackPosition,playbackRunning,correction} from '../lib/client-sync.mjs';
let time=1000;const clock=createSyncClock(()=>time),epoch=1900000000000;
clock.seed(epoch+time-500);assert.equal(clock.calibrated(),false);
function sample(rtt,bias=0){const start=time;time+=rtt;clock.sample(start,time,epoch+start+rtt/2+bias);}
sample(40);sample(50);sample(60);assert.equal(clock.calibrated(),true);assert.ok(Math.abs(clock.now()-(epoch+time))<1);
// Slow/asymmetric packets must not move the playback clock by seconds.
sample(5000,2000);assert.ok(Math.abs(clock.now()-(epoch+time))<5);
sample(400,120);assert.ok(Math.abs(clock.now()-(epoch+time))<5);
// Once old samples expire, a changed network/clock anchor can be recalibrated.
time+=46000;sample(40,350);assert.ok(Math.abs(clock.now()-(epoch+time+350))<1);
assert.equal(clock.sample(time,time-1,epoch),null);
const held={isPlaying:true,syncHolding:true,pausedPosition:42,startedAt:epoch,resumeAt:0};assert.equal(playbackPosition(held,epoch+99999),42);assert.equal(playbackRunning(held,epoch+99999),false);
const scheduled={isPlaying:true,syncHolding:false,pausedPosition:42,startedAt:epoch+1000-42000,resumeAt:epoch+1000};
assert.equal(playbackPosition(scheduled,epoch+500),42);assert.equal(playbackRunning(scheduled,epoch+500),false);assert.equal(playbackPosition(scheduled,epoch+1500),42.5);assert.equal(playbackRunning(scheduled,epoch+1500),true);
for(const late of [.4,2,3,5]){const c=correction(20-late,20,true);if(late<=.75){assert.ok(c.rate>1&&c.rate<=1.04);}else{assert.equal(c.seek,20);assert.equal(c.rate,1);}}
assert.equal(correction(20.4,20,true).rate,.96);assert.equal(correction(20.01,20,true).rate,1);assert.equal(correction(20,20,false).rate,1);assert.equal(correction(19.9,20,true,true).seek,20);assert.equal(correction(19.6,20,false).seek,20);
console.log('PASS: jitter-resistant clock calibration, 5-second delayed/asymmetric packets, recalibration, shared hold/deadline clocks, automatic 0.4/2/3/5-second drift correction');
