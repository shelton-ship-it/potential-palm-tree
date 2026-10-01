// lib/api.ts
// ── HTTP client central — usa authedFetch para refresh automático de token ───
//
// PROBLEMA CORRIGIDO: o req() anterior usava fetch() directo com
// localStorage.getItem() inline. Se o token não estivesse ainda disponível
// no boot (race condition com fetchMe), o pedido ia sem Authorization e o
// backend respondia 401. Agora usa authedFetch (do store/auth) que:
//   1. Lê o token mais recente do localStorage no momento do pedido
//   2. Se receber 401, faz refresh automático e repete o pedido uma vez
//   3. Actualiza o localStorage com o novo token (rotation)

import { authedFetch } from '@/store/auth';
import i18n            from '@/i18n';

// ── Idioma do conteúdo do catálogo ────────────────────────────────────────
// O backend só serve conteúdo em pt/en (SUPPORTED_LANGUAGES em lib/geoip.js)
// — a UI tem também 'es' (i18n/index.ts), então 'es' cai em 'en' aqui até o
// catálogo suportar espanhol. Antes, nenhuma chamada de catálogo mandava
// `lang`, e o backend decidia por: cookie preferred_language (nunca setado
// por este frontend) → preferência da conta → GeoIP do pedido. Ou seja, a
// MESMA URL podia devolver corpos diferentes consoante o país/sessão de
// quem pedia — o que impede um cache de borda correto (ele cacheia por URL).
// Ao mandar sempre o idioma que a própria UI já está a mostrar (i18next,
// que o utilizador escolhe em LanguageModal e fica em localStorage), a
// mesma URL passa a significar sempre o mesmo conteúdo.
const CONTENT_LANGS = ['pt', 'en'] as const;
function contentLang(): string {
  const code = (i18n.language || 'pt').slice(0, 2);
  return (CONTENT_LANGS as readonly string[]).includes(code) ? code : 'en';
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';

async function req<T = any>(method: string, path: string, data?: any): Promise<T> {
  const res = await authedFetch(API_BASE + '/api' + path, {
    method,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e: any = new Error(err.message || 'Request failed');
    e.status = res.status;
    e.data   = err;
    throw e;
  }

  return res.json();
}

const get  = <T>(p: string)            => req<T>('GET',    p);
const post = <T>(p: string, d?: any)   => req<T>('POST',   p, d);
const put  = <T>(p: string, d?: any)   => req<T>('PUT',    p, d);
const del  = <T>(p: string)            => req<T>('DELETE', p);

// ── Auth — matches routes/auth.js ─────────────────────────────────────────
export const authApi = {
  register:       (d: any)       => post('/auth/register', d),
  me:             ()             => get('/auth/me'),
  update:         (d: any)       => put('/auth/me', d),
  changePassword: (d: any)       => post('/auth/change-password', d),
  setLanguage:    (lang: string) => post('/auth/language', { lang }),
};

// ── Pareamento de TV (QR/código) — routes/device.js no api-core ───────────
// requestCode/status são chamados SEM sessão (a TV ainda não tem uma);
// authedFetch envia o Bearer se por acaso já existir, mas o backend não
// exige (ver device.js: /code e /status não checam req.user).
// Login de TV por código — fluxo invertido (sem QR/polling/WebSocket): o
// código é pedido no hub (mobile, já autenticado, ver /main/connect-tv em
// app.rar); aqui a TV só envia o que a pessoa digitou, numa única
// requisição, e já recebe a sessão completa se o código for válido.
export const deviceAuthApi = {
  activate: (code: string) => post<{ user: any; plan: any; token: string }>('/auth/device/activate', { code }),
};

// ── Profiles — matches routes/auth.js (POST/PUT/DELETE /auth/profiles) ───
// Limite de perfis por assinatura é aplicado no backend (edgeone.js createProfile),
// que devolve 403 com mensagem contendo "máximo" quando o limite do plano é atingido.
export const profilesApi = {
  create: (d: { name: string; avatar?: string; language?: string; is_kid?: boolean }) =>
    post('/auth/profiles', d),
  update: (id: string, d: Partial<{ name: string; avatar?: string; language?: string; is_kid?: boolean }>) =>
    put(`/auth/profiles/${id}`, d),
  delete: (id: string) => del(`/auth/profiles/${id}`),
};

// ── Catalog — matches routes/catalog.js ──────────────────────────────────
export const catalogApi = {
  list:     (p: Record<string, any> = {}) => get(`/catalog?${new URLSearchParams({ lang: contentLang(), ...p } as any)}`),
  featured: (limit = 6, profileId?: string | null) =>
    get(`/catalog/featured?${new URLSearchParams({ lang: contentLang(), limit: String(limit), ...(profileId ? { profile_id: profileId } : {}) })}`),
  latest:   (type: string, limit = 12, profileId?: string | null) =>
    get(`/catalog/latest?${new URLSearchParams({ lang: contentLang(), type, limit: String(limit), ...(profileId ? { profile_id: profileId } : {}) })}`),
  // Rodada 2 (set/2026): funde featured+popular+latest(movie/series/anime)
  // numa só chamada — usado só pela home (/main), que antes fazia 5
  // pedidos separados para exatamente estes dados.
  home: (opts: { limit?: number; featuredLimit?: number; profileId?: string | null } = {}) =>
    get(`/catalog/home?${new URLSearchParams({
      lang: contentLang(),
      ...(opts.limit ? { limit: String(opts.limit) } : {}),
      ...(opts.featuredLimit ? { featured_limit: String(opts.featuredLimit) } : {}),
      ...(opts.profileId ? { profile_id: opts.profileId } : {}),
    })}`),
  genres:   ()                            => get('/catalog/genres'),
};

// ── Content — matches routes/content.js ──────────────────────────────────
import { readContentCache, writeContentCache, invalidateContentCache } from './contentCache';

// ── Content — matches routes/content.js ──────────────────────────────────
export const contentApi = {
  // Rodada 3 (set/2026): cache curto (sessionStorage, 3min) partilhado entre
  // /main/content/[id] e /main/watch/[id] — ver src/lib/contentCache.ts.
  // Rodada extra (set/2026): likes ("Amei") desativados por completo —
  // gerava requests/escritas desnecessárias a cada like/unlike, contra o
  // objetivo destas rodadas. `contentApi.like`/`unlike` foram removidos
  // daqui de propósito — os endpoints correspondentes na API agora
  // respondem 410 Gone, então nem faria sentido manter uma chamada morta.
  get: async (id: string, lang = 'en', profileId?: string | null) => {
    const cached = readContentCache(id, lang, profileId);
    if (cached) return cached;
    const qs = new URLSearchParams({ lang, ...(profileId ? { profile_id: profileId } : {}) });
    const data = await get(`/content/${id}?${qs}`);
    writeContentCache(id, lang, profileId, data);
    return data;
  },
  getStream: (id: string, p: Record<string, any> = {})    => get(`/content/${id}/stream?${new URLSearchParams(p as any)}`),
  heartbeat: (id: string, position = 0)                   => post(`/content/${id}/heartbeat`, { position }),
};

// ── PixGo Creative — matches routes/creator.js ────────────────────────────
export const creatorApi = {
  me:             ()                       => get('/creator/me'),
  contents:       (page = 1, limit = 20)   => get(`/creator/contents?page=${page}&limit=${limit}`),
  analytics:      ()                       => get('/creator/analytics'),
  monetization:   ()                       => get('/creator/monetization'),
  paymentMethods: ()                       => get('/creator/payment-methods'),
  addPaymentMethod: (d: any)               => post('/creator/payment-methods', d),
};

// ── Search — matches routes/search.js ────────────────────────────────────
export const searchApi = {
  search:  (q: string, p: Record<string, any> = {}) => get(`/search?${new URLSearchParams({ q, ...p })}`),
  suggest: (q: string)                               => get(`/search/suggest?q=${encodeURIComponent(q)}`),
  popular: ()                                        => get('/search/popular'),
};

// ── Channels — matches routes/channels.js ────────────────────────────────
// Lista/categorias/pesquisa dos canais deixaram de vir daqui — são 100%
// client-side agora (ver lib/channels-source.ts, que busca o playlist.m3u
// directamente do jsDelivr). O que resta aqui é só o "gate" de anti-abuso:
// GET /channels/:id não devolve dados do canal nenhum, só valida limite de
// ecrãs/quota diária ANTES de reproduzir (mesma lógica do content /stream) —
// o handler nem sabe qual canal é, só confirma { ok: true }. heartbeat()
// alimenta o MESMO balde de tempo do VOD (pedido do user).
export const channelsApi = {
  get:       (id: string) => get(`/channels/${id}`),
  heartbeat: (id: string) => post(`/channels/${id}/heartbeat`, {}),
};

// ── Payments — matches routes/payments.js (v3.0, só Hotmart, sem cripto) ──
// GET /api/payments/plans        → Object.values(PLANS) — preço/features reais
// GET /api/payments/subscription → subscrição activa do user (ou {status:'free'})
// GET /api/payments/history      → histórico real (tabela `subscription`, Turso)
// POST /api/payments/cancel      → desliga auto_renew (acesso continua até expirar)
export const paymentsApi = {
  plans:        ()  => get('/payments/plans'),
  subscription: ()  => get('/payments/subscription'),
  history:      ()  => get('/payments/history'),
  cancel:       ()  => post('/payments/cancel', {}),
};

// ── Progress — matches routes/progress.js ────────────────────────────────
export const progressApi = {
  update: (d: {
    profileId: string;
    contentId: string;
    episodeId?: string;
    lang?: string;
    progress: number;
    duration?: number;
  }) => post('/progress/update', {
    // Backend (progress.js) lê req.body.profileId / req.body.contentId (camelCase).
    // Não usar snake_case aqui — sanitizeContentId(req.body.contentId) ficaria undefined.
    profileId: d.profileId,
    contentId: d.contentId,
    episodeId: d.episodeId,
    lang:      d.lang || 'en',
    progress:  d.progress,
    duration:  d.duration,
  }),
  continue: (p: Record<string, any> = {}) => get(`/progress/continue?${new URLSearchParams(p as any)}`),
  get:      (contentId: string, p: Record<string, any> = {}) => get(`/progress/${contentId}?${new URLSearchParams(p as any)}`),
};

// ── MyList — matches routes/mylist.js ────────────────────────────────────
export const myListApi = {
  list:   (p: Record<string, any> = {})                  => get(`/mylist?${new URLSearchParams(p as any)}`),
  // Rodada 3: invalida o cache curto de contentApi.get (que agora pode
  // trazer in_list embutido) — sem isto, uma navegação dentro do TTL logo
  // após adicionar/remover poderia mostrar o estado antigo.
  add:    (profileId: string, contentId: string)         => { invalidateContentCache(contentId); return post('/mylist/add',    { profileId, contentId }); },
  remove: (profileId: string, contentId: string)         => { invalidateContentCache(contentId); return post('/mylist/remove', { profileId, contentId }); },
  check:  (contentId: string, profileId?: string)        =>
    get(`/mylist/check/${contentId}${profileId ? `?profileId=${profileId}` : ''}`),
};

// ── Upload — Worker de moderação separado (copyright-worker.js), próprio
// domínio (upload.pixgo.qzz.io), fora da API principal. Faz a triagem de
// direitos autorais e fila de aprovação manual antes de entrar no
// pipeline de ingestão já existente.
const UPLOAD_BASE = process.env.NEXT_PUBLIC_UPLOAD_URL || 'https://copyright.pixgo.qzz.io';

async function uploadReq<T = any>(path: string, method: string, data?: any): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pixgo_token') : null;
  const res = await fetch(UPLOAD_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e: any = new Error(body.error || 'Upload request failed');
    e.status = res.status;
    throw e;
  }
  return body;
}

export const uploadApi = {
  precheck: (payload: any) => uploadReq('/precheck', 'POST', payload),
  status:   (id: string)   => uploadReq(`/precheck-status/${id}`, 'GET'),
};

// ── Denúncias e suporte — mesmo Worker, endpoints públicos ───────────────
export const contactApi = {
  reportAbuse: (contentTitle: string, reason: string) =>
    uploadReq('/report-abuse', 'POST', { contentTitle, reason }),
  support: (email: string, message: string) =>
    uploadReq('/support', 'POST', { email, message }),
};

// ── Pixel — chatbot da plataforma, mesmo Worker ───────────────────────────
export const chatApi = {
  send: (message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) =>
    uploadReq('/chat', 'POST', { message, history }),
};

