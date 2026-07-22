const CACHE = "fish-window-v12";
const ASSETS = ["./","index.html","styles.css","app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  // Leave API data AND map tiles alone: don't intercept or cache them here.
  // v0.3.0: primary map tiles now come from tiles.openfreemap.org
  // (MapLibre GL vector style/tiles/sprites/fonts). CARTO stays excluded
  // too since it's still used as the raster fallback style if OpenFreeMap
  // ever fails to load. Windy Webcams is excluded since results are
  // location-dependent and its image URLs are short-lived tokens that
  // shouldn't be cached anyway.
  if (
    e.request.url.includes("api.weather.gov") ||
    e.request.url.includes("tidesandcurrents.noaa.gov") ||
    e.request.url.includes("tiles.openfreemap.org") ||
    e.request.url.includes("basemaps.cartocdn.com") ||
    e.request.url.includes("api.windy.com") ||
    e.request.url.includes("swfd.org")
  ) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request,copy)); return r;
  }).catch(()=>caches.match(e.request)));
});

