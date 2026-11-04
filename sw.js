/* PLANA Brain service worker — network-first with offline cache fallback.
   Network-first keeps testers on the newest committed build; the cache only
   answers when the network can't. Bump CACHE on breaking asset renames. */
const CACHE = "plana-brain-v2";
const ASSETS = [
  "./platform/platform.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const url = new URL(e.request.url);
        const cacheable = (res && res.ok && url.origin === location.origin) ||
                          FONT_HOSTS.includes(url.hostname);   // opaque font responses are fine to keep
        if (cacheable){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(hit => {
          if (hit) return hit;
          if (e.request.mode === "navigate") return caches.match("./platform/platform.html");
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
