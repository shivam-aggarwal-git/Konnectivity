import { giphyMediaUrl } from "./giphy.mjs";

export const gifUploadOrigin = "https://upload.wikimedia.org";

export function gifUploadPath(path: string) {
  return /^\/wikipedia\/commons\/[a-f0-9]\/[a-f0-9]{2}\/[^/?#\\]+\.gif$/i.test(path) &&
    !/%(?:2f|5c|00|0d|0a)/i.test(path);
}

export function gifPreviewUrl(source: string, id: number | string) {
  if (typeof id === "string" && /^[a-zA-Z0-9]{1,64}$/.test(id)) return giphyMediaUrl(source, id);
  try {
    const url = new URL(source);
    if (url.origin === gifUploadOrigin && gifUploadPath(url.pathname)) {
      return `/api/gifs/image?file=${encodeURIComponent(url.pathname)}`;
    }
  } catch {}
  return "";
}
