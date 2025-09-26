/* Offline for a static GitHub Pages project (relative paths only)
   - Install: cache the entry HTML via "./"
   - Navigations: network, fallback to cached "./" if offline
   - Media (image/video/audio): network-first with cache fallback
   - Other GETs: cache-first
*/
const SHELL = "shell-v2";
const RUNTIME = "rt-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(["./"])) // cache this folder’s index.html via "./"
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // same-origin only
  if (url.origin !== location.origin) return;

  // Don't try to cache non-GET (HEAD/POST/etc) — just passthrough.
  if (req.method !== "GET") {
    return; // default fetch behavior
  }

  // Navigations: try network, fallback to cached "./"
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./"))
    );
    return;
  }

  const isMedia = /\.(?:jpg|jpeg|png|webp|gif|svg|avif|mp4|webm|ogv|mp3|m4a|aac|wav|oga|ogg)(?:\?.*)?$/i
    .test(url.pathname);

  if (isMedia) {
    // Network-first for media
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // Cache-first for other static same-origin requests
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
  }
});
