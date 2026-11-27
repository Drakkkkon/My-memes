// Мое_мемы — service worker: кеш сайта и картинок мемов на устройстве
const APP = 'mm-app-0.3.0';
const IMG = 'mm-img-v1';
const MAX_IMG = 3000;
const SHELL = ['./', 'index.html', 'css/style.css', 'js/db.js', 'js/sources.js', 'js/feed.js', 'js/editor.js', 'js/app.js', 'js/android.js', 'data/catalog.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mm-app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let puts = 0;
async function trim() {
  const c = await caches.open(IMG);
  const keys = await c.keys();
  if (keys.length > MAX_IMG) await Promise.all(keys.slice(0, keys.length - MAX_IMG).map(k => c.delete(k)));
}
function isImage(req, url) {
  return req.destination === 'image' || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url.pathname)
    || url.hostname === 'images.weserv.nl' || url.pathname.includes('/pictrs/image/') || url.hostname.endsWith('redd.it');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // картинки: сначала кеш, потом сеть (и кладём в кеш)
  if (url.origin !== location.origin && isImage(req, url)) {
    e.respondWith((async () => {
      const c = await caches.open(IMG);
      const hit = await c.match(req.url);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // кешируем только нормальные (CORS) ответы — «непрозрачные» браузер считает очень тяжёлыми
        if (res.ok && res.type !== 'opaque') {
          c.put(req.url, res.clone()).catch(() => {});
          if (++puts % 60 === 0) trim();
        }
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  // файлы сайта: сначала сеть, без сети — из кеша
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(APP).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  }
});
