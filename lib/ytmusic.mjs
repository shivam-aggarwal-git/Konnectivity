import {normalizeMusicTrack} from './music-metadata.mjs';
// YouTube Music search (metadata only) via ytmusic-api. Audio is resolved
// separately by the yt-dlp resolver. Shared by the Next API route and the
// server-side AI DJ. Server-side singleton.
import YTMusicPackage from "ytmusic-api";
const YTMusic = YTMusicPackage.default || YTMusicPackage;

let ytPromise = null;

async function getYT() {
  if (!ytPromise) {
    const yt = new YTMusic();
    ytPromise = yt.initialize().then(() => yt);
  }
  return ytPromise;
}

/**
 * Ask for cover art at a specific size.
 *
 * The API hands back 120x120, which is fine for a list row and looks obviously
 * upscaled in the now-playing panel at 260px (520 on a retina screen). Both
 * hosts that serve this art take a size in the URL, so request what we will
 * actually draw instead of stretching a thumbnail.
 */
function sized(url, px) {
  if (!url) return url;
  // Google usercontent: ...=w120-h120-l90-rj
  if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${px}-h${px}`);
  // i.ytimg.com: /default.jpg, /mqdefault.jpg, /hqdefault.jpg …
  if (/i\.ytimg\.com/.test(url)) {
    const want = px >= 480 ? "maxresdefault" : px >= 320 ? "hqdefault" : "mqdefault";
    return url.replace(/\/(default|mqdefault|hqdefault|sddefault|maxresdefault)\.jpg/, `/${want}.jpg`);
  }
  return url;
}

/** One search result, in the shape the queue and the player already speak. */
function toTrack(song){
 const track=normalizeMusicTrack(song);
 return {...track,art:sized(track.thumbnail,544)};
}

export async function searchSongs(query, limit = 15) {
  const yt = await getYT();
  const songs = await yt.searchSongs(query);
  return songs.slice(0, limit).map(toTrack);
}

/** One song by its video ID, in the same shape as a search result. */
export async function getSong(videoId) {
  const yt = await getYT();
  return toTrack(await yt.getSong(videoId));
}

/**
 * Albums matching a query. These are not playable on their own — picking one
 * opens its track list (see albumTracks), which is where the songs come from.
 */
export async function searchAlbums(query, limit = 12) {
  const yt = await getYT();
  const albums = await yt.searchAlbums(query);
  return albums.slice(0, limit).map((a) => ({
    albumId: a.albumId,
    title: a.name,
    artist: a.artist?.name ?? "Unknown",
    year: a.year ?? null,
    thumbnail: a.thumbnails?.[a.thumbnails.length - 1]?.url,
  }));
}

export async function searchArtists(query, limit = 12) {
  const yt = await getYT();
  const artists = await yt.searchArtists(query);
  return artists.slice(0, limit).map((a) => ({
    artistId: a.artistId,
    name: a.name,
    thumbnail: a.thumbnails?.[a.thumbnails.length - 1]?.url,
  }));
}

/** The tracks on an album, ready to queue. */
export async function albumTracks(albumId) {
  const yt = await getYT();
  const album = await yt.getAlbum(albumId);
  const cover = album.thumbnails?.[album.thumbnails.length - 1]?.url;
  return {
    albumId,
    title: album.name,
    artist: album.artist?.name ?? "Unknown",
    year: album.year ?? null,
    thumbnail: cover,
    // Album tracks carry their own art inconsistently — often none at all —
    // and the sleeve is the right answer for every one of them anyway.
    tracks: (album.songs ?? []).map((s) => {
      const t = toTrack(s);
      return { ...t, thumbnail: t.thumbnail || cover, art: t.art || sized(cover, 544) };
    }),
  };
}

/** YouTube Music's continuation keeps recommendations tied to this recording. */
export async function relatedSongs(videoId,limit=15){
 if(!/^[\w-]{11}$/.test(videoId||''))return [];
 const yt=await getYT();const rows=await yt.getUpNexts(videoId);
 return rows.filter(row=>row.videoId&&row.videoId!==videoId).slice(0,limit).map(toTrack);
}
