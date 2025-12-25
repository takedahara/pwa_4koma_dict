const CACHE_VERSION = "v2";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

// App shell（最低限）
const APP_SHELL = [
  "/",
  "index.html",
  "app.js",
  "sw.js",
  "terms.json",
  "manifest.webmanifest",
  // アイコンを置いたらここに追加してもOK:
  "icons/icon-192.png", 
  "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
  })());
});

// cache-first（オフライン強い）
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const res = await fetch(event.request);
      return res;
    } catch {
      return Response.error();
    }
  })());
});

async function postToAllClients(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const c of clients) c.postMessage(msg);
}

async function cacheUrls(urls, title = "キャッシュ中") {
  const cache = await caches.open(DATA_CACHE);

  // 既にキャッシュ済みのURLはスキップ（再実行で再開できる）
  const existing = await cache.keys();
  const existingSet = new Set(existing.map(r => r.url));

  const normalized = urls.map(u => new URL(u, self.location.origin).toString());
  const todo = normalized.filter(u => !existingSet.has(u));

  const total = normalized.length;
  let done = total - todo.length;

  await postToAllClients({ type: "CACHE_PROGRESS", title, done, total });

  // iOS向けに小さめchunk
  const CHUNK = 40;

  try {
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK);
      for (const url of chunk) {
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res);
        done += 1;

        if (done % 25 === 0) {
          await postToAllClients({ type: "CACHE_PROGRESS", title, done, total });
        }
      }
      await postToAllClients({ type: "CACHE_PROGRESS", title, done, total });
    }
  } catch (e) {
    await postToAllClients({ type: "CACHE_ERROR", detail: String(e) });
    return;
  }

  await postToAllClients({ type: "CACHE_DONE", title: "完了", detail: "オフラインで利用できる" });
}

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await postToAllClients({ type: "CACHE_CLEARED" });
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "CACHE_URLS" && Array.isArray(msg.urls)) {
    event.waitUntil(cacheUrls(msg.urls, msg.title || "キャッシュ中"));
  }
  if (msg.type === "CLEAR_CACHES") {
    event.waitUntil(clearAllCaches());
  }
});
