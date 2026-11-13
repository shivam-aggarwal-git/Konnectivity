"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

const seenKey = "konnectivity:room-guide:v2";
const steps = [
  ["Find something to play", "Use Search in the room toolbar. Choose a result to play it now or add it to the shared queue. Library shows uploaded songs and saved playlists."],
  ["Listen together", "Use the player at the bottom to play, pause, seek, or skip. Open Queue to see what's coming up. Playback controls affect everyone in the room."],
  ["Save a playlist", "Use Save on a song, then choose a playlist. Open Playlists to create, arrange, or queue a collection. Enable cross-room saving on a playlist to reuse it in another room."],
  ["Chat and call", "Open Chat and tap + to attach photos, GIFs, video, voice notes, or your device location. Use the phone icon for calls and Polls & Plans to make decisions together."],
  ["Name the room and set the mood", "Use Room name to name this group. The host can tap Mood to set the atmosphere, or Buzz to notify one listener or everyone."],
  ["Add your profile picture", "Tap Profile, then Upload photo or GIF. Add a status and tap Save profile. The room can see your picture and status."],
  ["Invite someone", "Use Share to copy the invitation. The host can approve join requests in People. Replay this guide from Settings."],
] as const;

export default function RoomGuide({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem(seenKey)) onOpenChange(true);
    } catch {
      onOpenChange(true);
    }
  }, [onOpenChange]);

  function close() {
    try { localStorage.setItem(seenKey, "1"); } catch {}
    setStep(0);
    onOpenChange(false);
  }

  const [title, description] = steps[step];
  return (
    <Dialog open={open} onOpenChange={value => value ? onOpenChange(true) : close()}>
      <DialogContent className="max-w-md">
        <p className="text-sm text-muted">Room guide · Step {step + 1} of {steps.length}</p>
        <DialogTitle className="pr-8">{title}</DialogTitle>
        <DialogDescription className="leading-relaxed text-muted">{description}</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close}>Skip guide</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button onClick={() => step + 1 === steps.length ? close() : setStep(step + 1)}>
            {step + 1 === steps.length ? "Done" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
