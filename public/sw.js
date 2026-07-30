// Service worker mínimo e defensivo.
// - NUNCA intercepta navegações de página (deixa o navegador lidar com
//   redirecionamentos; interceptar isso causava ERR_FAILED).
// - Só cacheia GET do mesmo domínio. Nunca toca em /api.
// - Dados (gastos) sempre buscados frescos.

const CACHE = 'caderno-gastos-v5';
const SHELL = [
  '/', '/index.html', '/landing.css',
  '/painel.html', '/styles.css', '/app.js',
  '/manifest.json', '/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Deixa o navegador cuidar sozinho de: navegações, outros domínios, não-GET e /api
  if (req.mode === 'navigate') return;
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
