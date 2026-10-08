/* FORTIS PWA — service worker
   Estratégia: REDE PRIMEIRO para arquivos do próprio site (com tempo-limite), caindo para o cache offline.
   Assim quem está online sempre recebe a versão publicada mais recente, e quem está offline continua usando o app.
   (A v1.1 usava "cache primeiro": o usuário só recebia atualizações quando o nome do cache era trocado à mão.) */
const CACHE = "fortis-v5";
const NET_TIMEOUT_MS = 3500;
const ASSETS = [
  "./", "./index.html", "./instalar.html", "./styles.css", "./app.js", "./core.js", "./foods.js", "./taco.js",
  "./manifest.webmanifest", "./assets/cover.jpg", "./assets/emblema.png", "./assets/simbolo.png", "./assets/qr-install.png",
  "./fonts/oswald-latin.woff2",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fortis-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), NET_TIMEOUT_MS);
    fetch(request).then((res) => { clearTimeout(t); resolve(res); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // o app não usa recursos externos
  const isNav = request.mode === "navigate";

  e.respondWith(
    fromNetwork(request)
      .then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)));
        }
        return res;
      })
      .catch(async () => {
        // navegações ignoram a query (?source=pwa etc.); demais arquivos precisam casar exatamente
        const hit = await caches.match(request, { ignoreSearch: isNav });
        if (hit) return hit;
        if (isNav) {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } });
      })
  );
});
