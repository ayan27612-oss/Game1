/* PROTOCOL: WARFORGE service worker — offline-first app shell. */
const VERSION = '2.1.0';
const CACHE = `protocol-warforge-v${VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './src/main.js',
  './src/Game.js',
  './src/engine/AudioSynth.js',
  './src/engine/MathUtils.js',
  './src/engine/Projection.js',
  './src/engine/Quadtree.js',
  './src/entities/Ally.js',
  './src/entities/Enemies.js',
  './src/entities/Player.js',
  './src/systems/Customization.js',
  './src/systems/Doctrines.js',
  './src/systems/Particles.js',
  './src/systems/Upgrades.js',
  './src/systems/Weapons.js',
  './src/ui/Hud.js',
  './src/ui/Input.js',
  './src/ui/Menu.js',
  './src/ui/Touch.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request)
      || await cache.match('./index.html')
      || await cache.match('./');
    if (cached) return cached;
    return new Response('PROTOCOL: WARFORGE is offline and the app shell is not cached.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || network || Promise.reject(new Error('offline'));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
