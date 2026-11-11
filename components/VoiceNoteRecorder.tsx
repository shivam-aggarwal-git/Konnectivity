"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

export default function VoiceNoteRecorder({disabled, onRecorded, onError}: {
  disabled: boolean;
  onRecorded: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");
  const recording = useRef<{recorder: MediaRecorder; stream: MediaStream; timer: ReturnType<typeof setTimeout>} | null>(null);
  const disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      const current = recording.current;
      if (!current) return;
      recording.current = null;
      clearTimeout(current.timer);
      current.recorder.onstop = null;
      if (current.recorder.state !== "inactive") current.recorder.stop();
      current.stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function toggle() {
    if (recording.current) {
      if (recording.current.recorder.state !== "inactive") recording.current.recorder.stop();
      return;
    }
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Recording needs microphone support and a secure room link.");
      return;
    }
    setState("requesting");
    onError("");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (disposed.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser has no supported voice-note format.");
      const recorder = new MediaRecorder(stream, {mimeType});
      const chunks: Blob[] = [];
      const finish = () => {
        const current = recording.current;
        recording.current = null;
        if (current) clearTimeout(current.timer);
        stream?.getTracks().forEach(track => track.stop());
        if (!disposed.current) setState("idle");
      };
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        recorder.onstop = null;
        finish();
        if (!disposed.current) onError("Recording failed. Try again.");
      };
      recorder.onstop = () => {
        finish();
        if (disposed.current) return;
        const type = (recorder.mimeType || mimeType).split(";")[0];
        const file = new File(chunks, "Voice note", {type});
        if (!file.size || file.size > 8 * 1024 * 1024) {
          onError("Record a voice note smaller than 8 MB.");
          return;
        }
        onRecorded(file);
      };
      recorder.start();
      const timer = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 180_000);
      recording.current = {recorder, stream, timer};
      setState("recording");
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (disposed.current) return;
      setState("idle");
      onError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Allow microphone access to record a voice note."
        : error instanceof Error ? error.message : "Could not start recording.");
    }
  }

  const label = state === "recording" ? "Stop recording voice note" : "Record voice note";
  return <button type="button" disabled={state === "requesting" || (disabled && state !== "recording")}
    onClick={() => void toggle()} aria-label={label} title={label}
    className={`grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/8 disabled:opacity-40 ${state === "recording" ? "text-red-400" : "text-muted"}`}>
    {state === "recording" ? <Square className="size-4 fill-current"/> : <Mic className="size-4"/>}
  </button>;
}
