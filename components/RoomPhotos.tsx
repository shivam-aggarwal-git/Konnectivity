"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import MediaRecipients from "./MediaRecipients";
import type { Participant, RoomPhoto } from "@/lib/types";

export const ROOM_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/svg+xml,.svg,.heic,.heif";

export default function RoomPhotos({ photos, selectedId, onSelect, onClose, returnFocus,
  mediaQuery, onUpload, uploading, error, members, canSharePrivately }: {
  photos: RoomPhoto[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  returnFocus: HTMLElement | null;
  mediaQuery: string;
  onUpload?: (file: File, recipients?: string[]) => void;
  members: Participant[];
  canSharePrivately: boolean;
  uploading: boolean;
  error: string;
}) {
  const [recipients, setRecipients] = useState<string[]>();
  const upload = useRef<HTMLInputElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = photos.findIndex(photo => photo.id === selectedId);
  const current = photos[index];

  function move(direction: -1 | 1) {
    const next = photos[index + direction];
    if (next) onSelect(next.id);
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent fullscreen className="sw-couple !bg-[var(--bg)] px-4 pt-5 pb-4 sm:px-7"
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocus?.focus();
        }}
        onKeyDown={event => {
          if (!current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          event.stopPropagation();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }}>
        <header className="mb-4 shrink-0 pr-14">
          <DialogTitle>Room photos</DialogTitle>
          <DialogDescription className="mt-1">
            {current ? `Photo ${index + 1} of ${photos.length}` : `${photos.length} shared photos`}
          </DialogDescription>
        </header>
        {current ? (
          <>
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/10 touch-pan-y"
              onTouchStart={event => {
                const first = event.touches[0];
                touch.current = event.touches.length === 1 ? { x: first.clientX, y: first.clientY } : null;
              }}
              onTouchCancel={() => { touch.current = null; }}
              onTouchEnd={event => {
                const start = touch.current;
                touch.current = null;
                const end = event.changedTouches[0];
                if (!start || !end || event.touches.length) return;
                const dx = end.clientX - start.x;
                const dy = end.clientY - start.y;
                if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
              }}>
              <img key={current.id} src={current.image.url + mediaQuery}
                alt={current.image.name || "Shared image"} draggable={false}
                className="h-full w-full select-none object-contain" />
            </div>
            <div className="mt-3 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="Previous photo"
                disabled={index === 0} onClick={() => move(-1)}><ChevronLeft /></Button>
              <div className="min-w-0 text-center" aria-live="polite">
                <p className="truncate text-sm font-semibold">{current.text || current.image.name || "Shared image"}</p>
                <p className="truncate text-xs text-muted">{[current.privateMedia && "Private", current.nick, new Date(current.ts).toLocaleDateString()].filter(Boolean).join(" · ")}</p>
              </div>
              <Button type="button" variant="outline" size="icon" aria-label="Next photo"
                disabled={index === photos.length - 1} onClick={() => move(1)}><ChevronRight /></Button>
            </div>
            <Button type="button" variant="outline" className="mx-auto mt-3 shrink-0" onClick={() => onSelect("")}>
              <Images size={16} /> All photos
            </Button>
          </>
        ) : (
          <>
            {onUpload && <div className="mb-4 shrink-0">
              {canSharePrivately && <details className="mb-2"><summary className="cursor-pointer text-sm">Choose who can see the upload</summary><MediaRecipients members={members} value={recipients} onChange={setRecipients} disabled={uploading} /></details>}
              <input type="file" hidden ref={upload} accept={ROOM_IMAGE_TYPES} onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(file, recipients);
              }} />
              <Button type="button" variant="primary" disabled={uploading || (recipients !== undefined && (!canSharePrivately || !recipients.length))} onClick={() => upload.current?.click()}>
                <ImagePlus size={16} /> {uploading ? "Uploading…" : "Upload image"}
              </Button>
              {error && <p role="alert" className="mt-2 text-sm text-ink">{error}</p>}
            </div>}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!photos.length && <p className="py-10 text-center text-muted">Images shared in chat appear here.</p>}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[...photos].reverse().map(photo => (
                  <li key={photo.id}>
                    <button type="button" onClick={() => onSelect(photo.id)}
                      className="sw-focus block aspect-square w-full overflow-hidden rounded-xl border border-current/15">
                      <img src={photo.image.url + mediaQuery} alt={photo.text || photo.image.name || "Shared image"}
                        className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
