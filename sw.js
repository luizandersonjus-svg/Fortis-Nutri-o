/* FORTIS PWA — service worker (app shell offline) */
const CACHE = "fortis-v2";
const ASSETS = [
  "./", "./index.html", "./instalar.html", "./styles.css", "./app.js", "./foods.js",
  "./manifest.webmanifest", "./assets/cover.jpg", "./assets/logo.svg", "./assets/qr-install.png",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res && res.ok && new URL(request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => {
        if (request.mode === "navigate") return caches.match("./index.html");
        throw new Error("offline");
      });
    })
  );
});
