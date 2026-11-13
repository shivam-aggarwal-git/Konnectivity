// PWA shell only. Live room data, media and Next.js modules stay network-owned.
const CACHE = "konnectivity-private-v9";
const SHELL = ["/", "/konnectivity-icon.png?v=3"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("konnectivity-private-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const {request} = event;
  const url = new URL(request.url);
  if(url.origin !== self.location.origin || request.method !== "GET" || request.headers.has("RSC") ||
    ["/_next/", "/audio/", "/socket.io", "/api/", "/chat-media/", "/chat-video/"].some(prefix => url.pathname.startsWith(prefix))) return;
  if(request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const shell = await caches.match("/").catch(() => undefined);
      return shell || new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Konnectivity offline</title><body><h1>Connection unavailable</h1><p>Reconnect to the server, then reload your room.</p><a href="/">Try again</a></body></html>', {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
    }));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)).catch(() => new Response("Resource unavailable", {status:503,headers:{"Cache-Control":"no-store"}})));
});
