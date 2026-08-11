const CACHE = "mallucupid-shell-v2";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

// Network-first: public profile data and paid access decisions must never be
// served stale. The cached shell is only an offline fallback for navigation.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      if (event.request.mode === "navigate") {
        return (await caches.match("/")) || Response.error();
      }
      return (await caches.match(event.request)) || Response.error();
    }),
  );
});
