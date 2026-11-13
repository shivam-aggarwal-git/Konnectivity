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
  ["Comments and listener tags", "Tap @ below the artwork. Type @ to choose a listener inline. Use the close icon to hide the whole thread and return to your previous lyrics or artwork view."],
  ["Lyrics and reactions", "Tap Lyrics in the player to read along in the room. Use the smile button at the right for reactions, even with artwork hidden. The heart likes the current song."],
  ["Notifications", "The bell opens room notifications. Mark them read or Clear all to remove them from this device. New activity will still appear."],
  ["Polls and plans", "Open Polls & Plans from the bottom tabs. Delete individual poll options, share a meeting location, or expand the panel. Leaving this tab keeps your draft; use Clear draft to discard it."],
  ["Room settings", "Open the menu, then Room management for hosts, listener permissions, device sync, room name, avatar and integrations. Nested settings have a Back button. Your personal profile stays under your avatar."],
  ["Continuous listening", "Enable Continuous play in Settings to get a recommended song when your queue ends. Shuffle changes queue order independently. Select songs in Search, use Select all shown, then save the selection to an existing or new playlist."],
  ["Broadcast and floating reactions", "Broadcast sends a room message over the artwork. Drag the floating smile button to move it, or focus it and use arrow keys. It also works in Focus mode and yields when it overlaps Volume or another open panel."],
  ["Playback readiness", "The timeline shows the media buffered on this device. Ready ahead measures the playable range after your current position, not a guarantee against network, decoding or synchronization waits."],
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
