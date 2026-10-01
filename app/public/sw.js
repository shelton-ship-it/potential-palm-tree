// public/sw.js — Pixgo Service Worker v5
// Strategy: Cache-first for static, Network-first for API
// FIX v3: Offline auth — /api/auth/me cached so PWA não redireciona para login sem rede
// FIX v4 (BUG): tentativa de intercetar /api/ cross-origin partiu tudo
//         (catálogo incluído) — a v4 nunca devia ter saído assim.
// FIX v5: interceção cross-origin restrita SÓ a /api/auth/me (o único
//         objetivo real). Qualquer outra chamada /api/ (catálogo,
//         conteúdo, etc.) volta a ignorar o SW por completo.

// FIX pagamentos: bump obrigatório — versões anteriores serviam /main/plans/*
// (checkout, success, pending, analysis) em cacheFirst, ficando presas numa
// cópia antiga. Agora essas rotas nunca passam pelo SW (ver NEVER_CACHE_PAGES).
const CACHE_VERSION = 'pixgo-v6';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const AUTH_CACHE    = `${CACHE_VERSION}-auth`;

const STATIC_URLS = [
  '/',
  '/main',
  '/main/downloads',
  '/auth/login',
  '/auth/register',
  '/manifest.json',
];

const NEVER_CACHE = [
  '/api/payments/',
  '/api/progress/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/refresh',
];

// Páginas do fluxo de pagamento — NUNCA cacheadas nem interceptadas pelo SW
// (rede sempre, sem fallback de cache), para o plano/estado mostrado ser o real.
const NEVER_CACHE_PAGES = ['/main/plans'];

const AUTH_CACHE_PATHS = ['/api/auth/me'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isAuthMePath = AUTH_CACHE_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p));

  // FIX v4 (corrigido): a API corre num domínio diferente do frontend
  // (api.pixgo.* vs pixgo.*). A v4 anterior deixava passar QUALQUER path
  // /api/ cross-origin — isso incluía catálogo, conteúdo, tudo — e passou
  // a fazer TODAS as chamadas à API correrem por aqui (networkFirstWithTimeout)
  // pela primeira vez, coisa que nunca tinha sido testada e partiu tudo
  // (404 generalizado). O único objetivo real era cachear /api/auth/me
  // para uso offline — restrito só a esse path. Qualquer outra chamada
  // cross-origin (catálogo, conteúdo, CDN, etc.) volta a ignorar o SW
  // por completo, exatamente como antes da v4.
  if (url.origin !== self.location.origin && !isAuthMePath) return;

  if (NEVER_CACHE.some(p => url.pathname.startsWith(p))) return;
  if (NEVER_CACHE_PAGES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) return;

  if (isAuthMePath) {
    event.respondWith(authMeStrategy(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

// Network-first para /api/auth/me — guarda no cache para uso offline
// Se offline e existe cache → devolve cache (utilizador continua autenticado)
// Se offline sem cache → 503 (frontend redireciona para login, correto)
async function authMeStrategy(request) {
  try {
    const response = await fetch(request.clone(), { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(AUTH_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json().catch(() => ({ title: 'Pixgo', body: '' }));
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pixgo', {
      body: data.body || '', icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png', tag: 'pixgo-notification',
    })
  );
});
