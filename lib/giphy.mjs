// Store only metadata for the selected GIPHY image. The server never fetches a
// URL from the chat payload, and clients load media only from GIPHY's CDN.
export function giphyMediaUrl(value, id) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && /^media\d*\.giphy\.com$/.test(url.host) &&
        !url.username && !url.password && !url.hash &&
        new RegExp(`^/media/(?:v1[.][A-Za-z0-9_-]+/)?${id}/[a-z0-9_]+\\.(?:gif|webp)$`, "i").test(url.pathname)) return url.href;
  } catch {}
  return "";
}

export function selectedGiphy(gif) {
  const id = gif?.id;
  if (typeof id !== "string" || !/^[a-zA-Z0-9]{1,64}$/.test(id)) return null;
  const url = giphyMediaUrl(gif.url, id);
  if (!url) return null;
  const title = typeof gif.title === "string" ? gif.title.trim().slice(0, 160) : "";
  const creator = typeof gif.creator === "string" ? gif.creator.trim().slice(0, 80) : "";
  return { id, url, source: `https://giphy.com/gifs/${id}`, title: title || "GIPHY GIF", creator, license: "GIPHY" };
}
