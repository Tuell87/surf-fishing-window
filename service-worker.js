const CACHE = "fish-window-v3";
const ASSETS = ["./","index.html","styles.css","app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  // Leave API data AND map tiles alone: don't intercept or cache them here.
  // Map tiles were previously routed through this same cache-everything
  // handler, which piled up hundreds of tile entries and made a failed
  // tile fetch fall back to a cache that never had that exact tile in it
  // (a permanent gray square). Letting the browser fetch tiles directly
  // lets it use its own retry/cache behavior instead.
  if (
    e.request.url.includes("api.weather.gov") ||
    e.request.url.includes("tidesandcurrents.noaa.gov") ||
    e.request.url.includes("basemaps.cartocdn.com")
  ) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request,copy)); return r;
  }).catch(()=>caches.match(e.request)));
});

