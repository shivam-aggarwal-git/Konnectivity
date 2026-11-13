"use client";
import { Radio, CheckCircle2 } from "lucide-react";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
export const DELAY_MAX_MS=500; // Legacy export for saved-client compatibility.
export default function SoundSettings({open,onOpenChange,rtt,nativeVolumeOnly,waitingFor}:{open:boolean;onOpenChange:(open:boolean)=>void;rtt:number|null;nativeVolumeOnly:boolean;waitingFor:string[]}) {
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
  <button type="button" className="settings-back" onClick={()=>onOpenChange(false)}>← Back to Settings</button><DialogHeader><DialogTitle className="flex items-center gap-2"><Radio size={18}/>Automatic synchronization</DialogTitle><DialogDescription>No sliders or guesses. Each device continuously adjusts to the shared room clock.</DialogDescription></DialogHeader>
  <div className="flex items-center gap-2 text-sm text-pink-200"><CheckCircle2 size={17}/>{waitingFor.length?`Catching up: ${waitingFor.join(' & ')}`:'Automatic sync is on'}</div>
  <p className="text-sm leading-relaxed text-muted">Each device buffers on its own. Returning to the tab or reconnecting catches this device up to the room.</p>
  <dl className="grid grid-cols-2 gap-3 text-xs"><dt className="text-muted">Network round trip</dt><dd>{rtt===null?'Measuring…':`${Math.round(rtt)} ms`}</dd></dl>
  {nativeVolumeOnly&&<p className="text-xs text-muted">Use your iPhone or iPad volume buttons during background playback.</p>}
  <p className="text-xs leading-relaxed text-muted">A browser may still require one tap to allow audio. Some headphones do not report their full hardware delay, and YouTube ads or restrictions can affect synchronization.</p>
 <button className="kn-background-upload" onClick={()=>onOpenChange(false)}>✓ Done · automatic sync is active</button>
 </DialogContent></Dialog>;
}
