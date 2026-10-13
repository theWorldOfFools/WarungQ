/* Service Worker UMKM-Scan v1 — app-shell offline dasar untuk mobile.
 * Strategi:
 * - Navigasi (pindah halaman): network-first, jatuh ke cache '/' saat offline.
 * - Aset same-origin (JS/CSS/ikon): cache-first + simpan salinan network.
 * - Lintas-origin (mis. Google Fonts) & API: network-only (tidak di-cache).
 */
const CACHE = 'umkmscan-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Perintah dari halaman: aktifkan SW baru segera (dipakai saat update).
self.addEventListener('message', (event) => {
  if (event.data === 'LEWATI_TUNGGU') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API & lintas-origin: langsung ke network, tanpa cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Navigasi: network-first agar selalu baru, fallback ke app-shell saat offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const salin = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', salin));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Aset same-origin: cache-first.
  event.respondWith(
    caches.match(req).then(
      (cocok) =>
        cocok ||
        fetch(req).then((res) => {
          if (res.ok) {
            const salin = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, salin));
          }
          return res;
        })
    )
  );
});
