const CACHE = 'miralink-shell-0.24-ui19';
const ASSETS = [
  './', './index.html', './styles.css', './src/app.js', './src/protocol.js',
  './src/storage.js', './src/i18n.js', './src/dualsense.js', './src/input-mapping.js', './src/emergency-mode.js', './src/hid-transport.js',
  './src/compatibility.js', './src/diagnostics.js', './src/action-guard.js', './src/session-recorder.js',
  './src/health-analysis.js', './src/visual-effects.js', './manifest.webmanifest', './icon.svg',
  './assets/visuals/miralink-hero-cinematic.png', './assets/visuals/miralink-hardware-bridge.png',
  './assets/visuals/miralink-signal-hub.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
