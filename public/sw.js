// Service worker defensivo, network-first.
// - NUNCA intercepta navegações de página (evita ERR_FAILED em redirecionamento).
// - Estáticos do mesmo domínio: tenta a REDE primeiro (sempre pega a versão
//   nova), e só usa o cache se estiver offline. Isso evita servir arquivo velho.
// - Nunca toca em /api. Dados sempre frescos.

const CACHE = 'caderno-gastos-v6';
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
  if (req.mode === 'navigate') return;
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
