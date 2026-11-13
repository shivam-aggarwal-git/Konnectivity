const results = globalThis.__konnectivityGifResults ??= new Map();
const commons = "https://commons.wikimedia.org";
const uploads = "https://upload.wikimedia.org";

function text(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim().slice(0, 160) : "";
}

export function selectedGif(id) {
  return Number.isSafeInteger(id) ? results.get(id) : undefined;
}

export async function searchGifs(term) {
  const url = new URL("/w/api.php", commons);
  url.search = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search",
    gsrnamespace: "6", gsrlimit: "16", gsrsearch: `${term} filemime:image/gif`,
    prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiextmetadatafilter: "Artist|LicenseShortName",
  }).toString();
  const response = await fetch(url, {
    headers: {"User-Agent":"Konnectivity (https://github.com/shivam-aggarwal-git/Konnectivity)"},
    signal: AbortSignal.timeout(6500), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw Error("GIF search is temporarily unavailable.");
  const data = await response.json();
  const matches = [];
  for (const page of data.query?.pages || []) {
    const file = page.imageinfo?.[0];
    const license = text(file?.extmetadata?.LicenseShortName?.value);
    if (!file || file.mime !== "image/gif" || file.size > 8 * 1024 * 1024 ||
        !/^(CC BY(?:-SA)? [\d.]+|CC ?0|Public domain)$/i.test(license)) continue;
    let source, credit;
    try { source = new URL(file.url); credit = new URL(file.descriptionurl); } catch { continue; }
    if (source.origin !== uploads || !source.pathname.startsWith("/wikipedia/commons/") ||
        credit.origin !== commons || !credit.pathname.startsWith("/wiki/File:")) continue;
    const gif = {id:page.pageid, url:source.href, source:credit.href, title:text(page.title?.replace(/^File:/,"")),
      creator:text(file.extmetadata?.Artist?.value), license};
    results.delete(gif.id);
    results.set(gif.id, gif);
    matches.push(gif);
  }
  while (results.size > 300) results.delete(results.keys().next().value);
  return matches;
}
