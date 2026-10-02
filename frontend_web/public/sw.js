// public/sw.js — Pixgo Service Worker v8
// Strategy: Cache-first for static, Network-first for API
// FIX v3: Offline auth — /api/auth/me cached so PWA não redireciona para login sem rede
// FIX v4 (BUG): tentativa de intercetar /api/ cross-origin partiu tudo
//         (catálogo incluído) — a v4 nunca devia ter saído assim.
// FIX v5: interceção cross-origin restrita SÓ a /api/auth/me (o único
//         objetivo real). Qualquer outra chamada /api/ (catálogo,
//         conteúdo, etc.) volta a ignorar o SW por completo.
// FIX v6: fallback offline deixa de ser texto plano sem estilo para
//         QUALQUER página não cacheada — agora só navegações reais falham
//         para /offline (página estilizada com atalho para Downloads);
//         assets/API mantêm o comportamento anterior sem alteração.
// FIX v7: /main/watch/[id]?offline=1 nunca funcionava 100% offline (rota
//         dinâmica do App Router — o payload da rota para um [id] nunca
//         visitado antes precisa de rede na 1ª vez, mesmo sendo Client
//         Component). Downloads agora abrem em /offline-player (rota fixa,
//         sem segmento dinâmico, id por query string) — pré-cacheada aqui,
//         100% IndexedDB, nunca chama nenhuma API.
// FIX v8: cacheFirst em navigateWithOfflineFallback fazia qualquer página
//         visitada uma vez (ex: /main/channels) ficar presa nessa cópia
//         PARA SEMPRE — nenhum deploy seguinte era visto por quem já a
//         tinha aberto antes, porque o SW só reinstala/limpa a cache
//         quando ESTE ficheiro muda, e um deploy normal da app (EdgeOne)
//         não toca no sw.js. Isto escondeu, entre outras coisas, o fix da
//         pesquisa de canais (mountedRef em channels/page.tsx) de quem já
//         tinha a página em cache. Subir CACHE_VERSION é o próprio gatilho:
//         obriga o browser a ver este ficheiro como "novo", instalar o SW
//         v8, e no activate() apagar toda a cache da v7 (linha ~57) — só
//         depois disso é que os deploys seguintes voltam a aparecer sem
//         precisar de limpar cache manualmente. A partir de agora: sempre
//         que uma correção depender de uma página que já pode estar em
//         cache de alguém, subir este número faz parte do fix.

// FIX v9: /main (hero rotativo + fileiras por tipo removidos, grelha única
//         por recência) e /main/catalog (removido o videoFirst() que
//         quebrava a ordenação) mudaram de lógica — bump obrigatório,
//         como já documentado no FIX v8 acima, para quem já tinha estas
//         páginas em cache não ficar preso na versão antiga.

// FIX pagamentos: bump obrigatório — versões anteriores serviam /main/plans/*
// (checkout, success, pending, analysis) em cacheFirst, ficando presas numa
// cópia antiga. Agora essas rotas nunca passam pelo SW (ver NEVER_CACHE_PAGES).
//
// FIX denúncias de direitos autorais: bump obrigatório, as páginas /copyright,
// /copyright/response e /copyright/portal mostram o estado atual das denúncias e
// nunca passam pelo SW (ver NEVER_CACHE_PAGES).
const CACHE_VERSION = 'pixgo-v11';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const AUTH_CACHE    = `${CACHE_VERSION}-auth`;

const STATIC_URLS = [
  '/',
  '/main',
  '/main/downloads',
  '/offline-player',
  '/auth/login',
  '/auth/register',
  '/offline',
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

// Páginas do fluxo de pagamento e do fluxo de denúncias: NUNCA cacheadas nem
// interceptadas pelo SW (rede sempre, sem fallback de cache), para o plano ou
// estado mostrado ser o real.
const NEVER_CACHE_PAGES = ['/main/plans', '/copyright'];

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

  // Navegação de página (abrir/actualizar um URL) — se falhar sem rede e
  // não houver cache dessa página exacta, cai no /offline em vez do texto
  // plano sem estilo de antes. Páginas já em cache (ex.: /main/downloads,
  // ou uma /main/watch/[id] visitada online antes) continuam servidas
  // normalmente por cacheFirst, como sempre — isto só cobre o "não faço
  // ideia do que é isto e não está em cache nenhum".
  if (request.mode === 'navigate') {
    event.respondWith(navigateWithOfflineFallback(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function navigateWithOfflineFallback(request) {
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
    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;
    return new Response('Offline', { status: 503 }); // /offline não chegou a ficar em cache — último recurso
  }
}

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
