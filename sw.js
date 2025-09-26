/* Basic offline support for GitHub Pages static site
   - Caches the shell (index.html) on install
   - Runtime caches any media you view (image/video/audio)
   Strategy:
     • Navigate requests: cache-first (serve cached index if offline)
     • Media files: network-first with cache fallback
     • Other static assets: cache-first
*/
const SHELL = "shell-v1";
const RUNTIME = "rt-v1";
const SHELL_ASSETS = [ "./", "/index.html" ];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // same-origin only
  if (url.origin !== location.origin) return;

  // Navigations -> cache-first (for offline)
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("/index.html").then((cached) => {
        return cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/index.html", copy));
          return res;
        });
      })
    );
    return;
  }

  const isMedia = /\.(?:jpg|jpeg|png|webp|gif|svg|avif|mp4|webm|ogv|mp3|m4a|aac|wav|oga|ogg)(?:\?.*)?$/i.test(url.pathname);

  if (isMedia) {
    // network-first for media
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // cache-first for other same-origin requests
    e.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
  }
});

