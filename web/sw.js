/* Figures & Formulas service worker.
 * Network first, cache fallback: online he always gets the newest files, offline the game still loads.
 * Bump CACHE when shipping a change that must invalidate old files (the Pages workflow does this automatically). */
const CACHE = 'ff-__BUILD__';
const SHELL = ['./', 'index.html', 'config.js', 'css/theme.css', 'js/facts.js', 'js/scheduler.js', 'js/store.js', 'js/player.js', 'js/sync.js',
  'shooter/', 'shooter/index.html', 'shooter/game.js', 'slice/', 'slice/index.html', 'slice/slice.js', 'js/kit.js', 'css/kit.css',
  'hop/', 'hop/index.html', 'hop/hop.js', 'elevator/', 'elevator/index.html', 'elevator/elevator.js', 'bubbles/', 'bubbles/index.html', 'bubbles/bubbles.js', 'race/', 'race/index.html', 'race/race.js', 'arrays/', 'arrays/index.html', 'arrays/arrays.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Sheet calls and fonts pass straight through
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
