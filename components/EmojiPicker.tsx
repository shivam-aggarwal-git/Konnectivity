"use client";

import { useEffect, useRef, useState } from "react";

/** Lazy-loaded, bundled emoji catalog shared by chat and floating reactions. */
export default function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect); select.current = onSelect;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    const root = mount.current;
    void Promise.all([import("emoji-mart"), import("@emoji-mart/data")]).then(([{ Picker }, catalog]) => {
      if (disposed || !root) return;
      const picker = new Picker({ data: catalog.default, set: "native", theme: document.documentElement.dataset.roomTheme === "pearl" ? "light" : "dark",
        dynamicWidth: true, previewPosition: "none", skinTonePosition: "search", autoFocus: false,
        onEmojiSelect: (choice: { native?: string }) => { if (choice.native) select.current(choice.native); },
      });
      root.replaceChildren(picker as unknown as Node);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; root?.replaceChildren(); };
  }, []);
  return <div className="kn-emoji-picker" aria-label="Emoji picker"><div ref={mount}/>{failed && <p role="alert">Emoji picker could not load. Close and open it to retry.</p>}</div>;
}
