// Minimal service worker — enables PWA install + an offline app shell.
// Network-first for navigations (so the room UI stays fresh), cache fallback.
const CACHE = "konnectivity-private-v6";
const SHELL = ["/", "/konnectivity-icon.png?v=3"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Never cache audio, socket.io, or API traffic.
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/socket.io") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/chat-media/") ||
    url.pathname.startsWith("/chat-video/")
  ) {
    return;
  }
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(request).then((r) => r || fetch(request)));
});
