/* Offline: the app shell, all seven decks with their practice files, room paintings, letters and keepsakes are cached on install; everything else (Google Fonts)
   is cached the first time it is fetched. Served from cache first, refreshed in the background.
   Bump VERSION when any file changes so phones pick up the new copy. */
const VERSION = 'he-2026-10-06i';
const PROFS = ['snape', 'mcgonagall', 'lupin', 'moody', 'umbridge', 'dumbledore', 'slughorn'];
const CORE = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/art.js',
  'js/art-plus.js',
  'js/bond.js',
  'js/letters.js',
  'js/myroom.js',
  'js/owl.js',
  'js/welcome.js',
  'js/doors.js',
  'js/post.js',
  'js/hints.js',
  'js/firebase-config.js',
  'js/friends.js',
  'js/decks.js',
  'js/home.js',
  'js/room.js',
  'js/report.js',
  'js/settings.js',
  'js/srs.js',
  'js/bake.js',
  'js/notes.js',
  'js/records.js',
  'js/script.js',
  'js/store.js',
  'js/speech.js',
  'js/ui.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'data/index.json',
  'data/snape.json',
  'data/mcgonagall.json',
  'data/lupin.json',
  'data/moody.json',
  'data/umbridge.json',
  'data/dumbledore.json',
  'data/slughorn.json',
  'practice/snape.json',
  'practice/snape-examples.json',
  'practice/mcgonagall.json',
  'practice/mcgonagall-examples.json',
  'practice/lupin.json',
  'practice/lupin-examples.json',
  'practice/moody.json',
  'practice/moody-examples.json',
  'practice/umbridge.json',
  'practice/umbridge-examples.json',
  'practice/dumbledore.json',
  'practice/dumbledore-examples.json',
  'practice/slughorn.json',
  'practice/slughorn-examples.json',
  'assets/corridor/snape.webp',
  'assets/corridor/mcgonagall.webp',
  'assets/corridor/lupin.webp',
  'assets/corridor/moody.webp',
  'assets/corridor/umbridge.webp',
  'assets/corridor/dumbledore.webp',
  'assets/corridor/slughorn.webp',
  'assets/corridor/end.webp',
  'assets/corridor/me.webp',
  'assets/rooms/me-portrait.webp',
  'assets/rooms/me-wide.webp',
  'assets/ui/velvet.webp',
  'assets/ui/walnut.webp',
  ...['snape', 'mcgonagall', 'lupin', 'moody', 'umbridge', 'slughorn', 'dumbledore'].map(p => 'assets/ui/seal-' + p + '.webp'),
  'assets/ui/snitch.webp',
  ...['lion', 'serpent', 'eagle', 'badger', 'thestral', 'spider'].map(p => 'assets/seals/player-' + p + '.webp'),
  'assets/owl/envelope.webp',
  'assets/owl/card.webp',
  'assets/owl/owl.webm',
  'assets/owl/owl.webp',
  ...['snape', 'mcgonagall', 'lupin', 'moody', 'umbridge', 'slughorn', 'dumbledore'].map(p => 'assets/journal/stain-' + p + '.webp'),
  'assets/rooms/snape-portrait.webp',
  'assets/rooms/snape-wide.webp',
  'assets/rooms/mcgonagall-portrait.webp',
  'assets/rooms/mcgonagall-wide.webp',
  'assets/rooms/lupin-portrait.webp',
  'assets/rooms/lupin-wide.webp',
  'assets/rooms/moody-portrait.webp',
  'assets/rooms/moody-wide.webp',
  'assets/rooms/umbridge-portrait.webp',
  'assets/rooms/umbridge-wide.webp',
  'assets/rooms/dumbledore-portrait.webp',
  'assets/rooms/dumbledore-wide.webp',
  'assets/rooms/slughorn-portrait.webp',
  'assets/rooms/slughorn-wide.webp',
  'assets/ui/book.webp',
  'assets/ui/hourglass.webp',
  'assets/ui/parchment.webp',
  'assets/ui/strip.webp',
  /* the professors' letters and teas, and the thirty keepsakes each (small square photographs) */
  ...PROFS.map(d => `bond/${d}.json`),
  'bond/news.json',
  ...PROFS.flatMap(d => Array.from({length: 30}, (_, i) => `assets/keepsakes/${d}-K${String(i + 1).padStart(2, '0')}.webp`))
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (/.mp4$/i.test(url.pathname)) return;   // videos stream from the network (range requests cannot be cached); the still shows offline
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(key, {ignoreSearch: req.mode === 'navigate'});
    const net = fetch(req).then(res => { if (res && res.status !== 206 && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit){ e.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('offline', {status: 503, statusText: 'offline'});
  }));
});
