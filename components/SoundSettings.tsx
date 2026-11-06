"use client";
import { Radio, CheckCircle2 } from "lucide-react";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
export const DELAY_MAX_MS=500; // Legacy export for saved-client compatibility.
export default function SoundSettings({open,onOpenChange,rtt,outputLatency,waitingFor}:{open:boolean;onOpenChange:(open:boolean)=>void;rtt:number|null;outputLatency:number|null;waitingFor:string[]}) {
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
  <DialogHeader><DialogTitle className="flex items-center gap-2"><Radio size={18}/>Automatic synchronization</DialogTitle><DialogDescription>No sliders or guesses. Each device continuously adjusts to the shared room clock.</DialogDescription></DialogHeader>
  <div className="flex items-center gap-2 text-sm text-pink-200"><CheckCircle2 size={17}/>{waitingFor.length?`Waiting for ${waitingFor.join(' & ')}`:'Automatic sync is on'}</div>
  <p className="text-sm leading-relaxed text-muted">If either connection needs to buffer, playback waits briefly and resumes together. Returning to the tab or reconnecting automatically recalibrates this device.</p>
  <dl className="grid grid-cols-2 gap-3 text-xs"><dt className="text-muted">Network round trip</dt><dd>{rtt===null?'Measuring…':`${Math.round(rtt)} ms`}</dd><dt className="text-muted">Audio output estimate</dt><dd>{outputLatency===null?'Not reported by this browser':`${Math.round(outputLatency*1000)} ms`}</dd></dl>
  <p className="text-xs leading-relaxed text-muted">A browser may still require one tap to allow audio. Some headphones do not report their full hardware delay, and YouTube ads or restrictions can affect synchronization.</p>
 </DialogContent></Dialog>;
}
