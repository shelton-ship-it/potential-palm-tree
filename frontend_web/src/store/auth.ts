// src/store/auth.ts
'use client';
import { create } from 'zustand';

interface User {
  id: string; username: string; name: string;
  email?: string; role: string; plan_id: string;
}

interface Plan {
  id: string; name: string; price_brl?: number; price_usdt?: number;
  is_active?: boolean; expires_at?: string; duration_days?: number;
}

interface Profile {
  id: string; name: string; avatar?: string | null;
  language?: string; is_kid?: boolean;
}

interface AuthState {
  user:      User | null;
  plan:      Plan | null;
  profiles:  Profile[];
  activeProfileId: string | null;
  token:     string | null;
  hydrated:  boolean;
  loading:   boolean;
  login:     (u: string, p: string) => Promise<void>;
  loginWithDeviceCode: (code: string) => Promise<void>;
  logout:    () => Promise<void>;
  fetchMe:   () => Promise<void>;
  setToken:  (t: string) => void;
  setActiveProfile: (id: string) => void;
  isAdmin:   () => boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function storageSet(key: string, value: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, value);
}

function storageDel(...keys: string[]) {
  if (typeof window !== 'undefined') keys.forEach(k => localStorage.removeItem(k));
}

// ── Cache local de /api/auth/me (Rodada 1 de otimização, set/2026) ─────────────
// Antes: fetchMe() batia sempre no servidor (getUserById + syncPlanExpiry +
// getUserPlan + getProfiles no Turso — até 4 idas à DB) em TODO mount da app,
// mesmo com cookie/token válidos por 365 dias e dados que raramente mudam.
// Agora: user/plan/profiles ficam em cache local com timestamp; só revalida
// no servidor se o cache expirar (30min) OU o token estiver perto de expirar.
// Nunca reduz segurança — qualquer chamada de escrita real continua a validar
// o Bearer/cookie no servidor a cada pedido; isto só evita reconsultar "quem
// sou eu" sem necessidade.
const ME_CACHE_KEY     = 'pixgo_me_cache';
const ME_CACHE_TTL_MS  = 30 * 60 * 1000; // 30 minutos (plano pago)
// Plano free: TTL curto — pode ter acabado de pagar (outro separador/dispositivo,
// webhook a chegar) e o cache longo escondia o plano activo.
const ME_CACHE_FREE_TTL_MS = 60 * 1000;
const TOKEN_MIN_TTL_MS = 5  * 60 * 1000; // não confia em token a <5min de expirar

interface MeCache {
  user: User | null;
  plan: Plan | null;
  profiles: Profile[];
  cachedAt: number;
}

function readMeCache(): MeCache | null {
  const raw = storageGet(ME_CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as MeCache; } catch { return null; }
}

function writeMeCache(data: Omit<MeCache, 'cachedAt'>) {
  storageSet(ME_CACHE_KEY, JSON.stringify({ ...data, cachedAt: Date.now() }));
}

// Decodifica o `exp` do JWT localmente (sem verificar assinatura — só para
// decidir se vale a pena confiar no cache sem ir ao servidor; a validação
// real de assinatura continua a acontecer no backend a cada chamada real).
function decodeJwtExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json    = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data    = JSON.parse(json);
    return typeof data.exp === 'number' ? data.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ── Perfil activo ────────────────────────────────────────────────────────────
// Sem isto o app usava sempre profiles[0] em todo o lado (watch, content,
// mylist, catalog) — não havia forma de usar nenhum perfil além do primeiro.
// Persistido em localStorage (mesmo padrão do token), e sempre revalidado
// contra a lista de perfis real recebida do backend (login/fetchMe) — se o
// id guardado já não existir (perfil apagado noutra sessão, por ex.), cai
// de volta para profiles[0].
const ACTIVE_PROFILE_KEY = 'pixgo_active_profile';

function resolveActiveProfileId(profiles: Profile[]): string | null {
  if (!profiles.length) return null;
  const stored = storageGet(ACTIVE_PROFILE_KEY);
  if (stored && profiles.some(p => p.id === stored)) return stored;
  return profiles[0].id;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

let _refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = storageGet('pixgo_refresh');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'include',
      });

      if (!res.ok) {
        storageDel('pixgo_token', 'pixgo_refresh');
        return null;
      }

      const data = await res.json();

      storageSet('pixgo_token', data.token);
      if (data.refresh_token) storageSet('pixgo_refresh', data.refresh_token);

      return data.token as string;
    } catch {
      return null;
    }
  })();

  const result = await _refreshPromise;
  _refreshPromise = null;
  return result;
}

// ── Fetch autenticado com retry automático após refresh ───────────────────────

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = storageGet('pixgo_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // credentials:'include' — envia o cookie pixgo_session (SSO partilhado
  // com app.pixgo.qzz.io e as demais plataformas *.pixgo.qzz.io). Sem
  // isto, alguém autenticado só via app.pixgo.qzz.io nunca era reconhecido
  // aqui, mesmo com o cookie presente no browser.
  const res = await fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return res;
    
    // Atualiza o store com o novo token
    useAuthStore.setState({ token: newToken });
    
    headers['Authorization'] = `Bearer ${newToken}`;
    return fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
  }

  return res;
}

// ── Store ─────────────────────────────────────────────────────────────────────

// ── Hidratação síncrona a partir do cache local (evita bloquear o primeiro
// render em rede — ver ME_CACHE_KEY acima) ──────────────────────────────────
// FIX pagamentos: quem paga no hub (app.pixgo.qzz.io) volta aqui com ?px_paid=…
// (ver CheckoutStatusPage.tsx do app). Sem isto, o cache local abaixo (30min)
// continuava a mostrar o plano ANTIGO mesmo com a assinatura já activa no
// servidor. Apaga o cache ANTES de hidratar → o fetchMe() vai sempre à rede.
if (typeof window !== 'undefined') {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has('px_paid')) {
      localStorage.removeItem('pixgo_me_cache');
      u.searchParams.delete('px_paid');
      window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    }
  } catch { /* melhor esforço */ }
}
const _cachedMe        = readMeCache();
const _cachedToken     = storageGet('pixgo_token');
const _tokenExpMs      = _cachedToken ? decodeJwtExpMs(_cachedToken) : null;
const _tokenLooksValid = _tokenExpMs !== null && _tokenExpMs > Date.now();
const _canHydrateFromCache = !!(_cachedMe && _cachedToken && _tokenLooksValid);

export const useAuthStore = create<AuthState>((set, get) => ({
  user:     _canHydrateFromCache ? _cachedMe!.user     : null,
  plan:     _canHydrateFromCache ? _cachedMe!.plan     : null,
  profiles: _canHydrateFromCache ? _cachedMe!.profiles : [],
  activeProfileId: _canHydrateFromCache ? resolveActiveProfileId(_cachedMe!.profiles) : null,
  token:    _cachedToken,
  // hydrated=true aqui já deixa a UI renderizar de imediato com dados do
  // cache; fetchMe() continua a ser chamado no mount (Providers.tsx) para
  // revalidar em segundo plano — silenciosamente, sem re-bloquear a UI.
  hydrated: _canHydrateFromCache,
  loading:  false,

  setToken: (t) => {
    storageSet('pixgo_token', t);
    set({ token: t });
  },

  setActiveProfile: (id) => {
    const exists = get().profiles.some(p => p.id === id);
    if (!exists) return;
    storageSet(ACTIVE_PROFILE_KEY, id);
    set({ activeProfileId: id });
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.message || 'Login failed');
        e.status = res.status;
        throw e;
      }

      const data     = await res.json();
      const profiles = data.profiles || [];
      const activeId = resolveActiveProfileId(profiles);
      if (activeId) storageSet(ACTIVE_PROFILE_KEY, activeId);

      storageSet('pixgo_token', data.token);
      if (data.refresh_token) storageSet('pixgo_refresh', data.refresh_token);
      writeMeCache({ user: data.user || null, plan: data.plan || null, profiles });
      set({ token: data.token, user: data.user, plan: data.plan, profiles, activeProfileId: activeId, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  // Login de TV por código (fluxo invertido — ver /auth/tv e
  // lib/api.ts::deviceAuthApi). Mesmo shape de resposta e mesmo caminho de
  // sucesso que login() acima: o backend usa o MESMO helper de token/cookie
  // (365d) — a sessão da TV não é "menos sessão" por ter nascido de um
  // código em vez de utilizador/senha.
  loginWithDeviceCode: async (code) => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/device/activate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // guarda o cookie pixgo_session partilhado, quando o WebView o permite
        body:    JSON.stringify({ code }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.message || 'Activation failed');
        e.status = res.status;
        throw e;
      }

      const data = await res.json();
      writeMeCache({ user: data.user || null, plan: data.plan || null, profiles: [] });
      storageSet('pixgo_token', data.token);
      set({ token: data.token, user: data.user, plan: data.plan, profiles: [], loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  // OTIMIZAÇÃO (produção): antes, isto fazia `await fetch(...)` ao backend
  // e SÓ DEPOIS limpava o estado local — qualquer latência/cold start do
  // endpoint (Worker/EdgeOne) bloqueava o botão de logout inteiro (3-5s
  // reportados). O pedido de invalidação no servidor é "melhor esforço"
  // por definição (catch vazio) — não há razão nenhuma para a UI esperar
  // por ele. Agora: limpa localStorage + estado local IMEDIATAMENTE
  // (o clique reage no mesmo frame), e dispara o fetch em paralelo,
  // sem await, sem bloquear nada.
  logout: async () => {
    const t  = get().token;
    const rt = storageGet('pixgo_refresh');

    storageDel('pixgo_token', 'pixgo_refresh', ACTIVE_PROFILE_KEY, ME_CACHE_KEY);
    set({ user: null, plan: null, profiles: [], activeProfileId: null, token: null, loading: false });

    fetch(`${API_BASE}/api/auth/logout`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ refresh_token: rt }),
      // Sem isto o browser ignora o Set-Cookie de limpeza do pixgo_session
      // (cookie partilhado) devolvido pelo backend — ficava "deslogado"
      // aqui mas ainda autenticado via cookie nas outras plataformas.
      credentials: 'include',
    }).catch(() => { /* melhor esforço — UI já reagiu, não há nada a reverter */ });
  },

  fetchMe: async () => {
    // Rodada 1 (set/2026): antes de ir à rede, decide se o cache local
    // ainda é confiável — token não perto de expirar E cache dentro do TTL.
    // Se sim, confia nele silenciosamente e nem chega a bater na API (que
    // faria getUserById+syncPlanExpiry+getUserPlan+getProfiles no Turso à
    // toa). Isto só afeta ESTA leitura oportunista; login/logout e qualquer
    // chamada de escrita continuam a validar tudo no servidor a cada pedido.
    const cache = readMeCache();
    const token = get().token;
    const tokenExpMs = token ? decodeJwtExpMs(token) : null;
    const tokenFresh = tokenExpMs !== null && (tokenExpMs - Date.now() > TOKEN_MIN_TTL_MS);
    const isFreeCached = !cache?.plan || cache.plan.id === 'free' || cache.plan.is_active === false;
    const cacheTtl   = isFreeCached ? ME_CACHE_FREE_TTL_MS : ME_CACHE_TTL_MS;
    const cacheFresh = !!cache && (Date.now() - cache.cachedAt < cacheTtl);

    if (cache && token && tokenFresh && cacheFresh) {
      set({ hydrated: true }); // já deve estar true (hidratação síncrona), reforça por segurança
      return;
    }

    // Antes: só tentava /api/auth/me se já houvesse token/refresh no
    // localStorage — isso impedia reconhecer alguém autenticado só via
    // cookie partilhado (login feito em app.pixgo.qzz.io). Agora tenta
    // sempre; o cookie pixgo_session sozinho já basta (credentials:include
    // no authedFetch), e a resposta traz um token fresco para guardar.
    try {
      const res = await authedFetch(`${API_BASE}/api/auth/me`);

      if (!res.ok) {
        storageDel('pixgo_token', 'pixgo_refresh', ACTIVE_PROFILE_KEY, ME_CACHE_KEY);
        set({ user: null, plan: null, profiles: [], activeProfileId: null, token: null, hydrated: true });
        return;
      }

      const data        = await res.json();
      const profiles     = data.profiles || [];
      const activeId     = resolveActiveProfileId(profiles);
      if (activeId) storageSet(ACTIVE_PROFILE_KEY, activeId);

      // /api/auth/me agora devolve um token fresco — guarda-o localmente
      // (necessário para URLs de stream de vídeo e chamadas que não podem
      // depender só do cookie). Mantém o local se por algum motivo a
      // resposta não trouxer um (nunca deve acontecer, mas não derruba).
      const latestToken = data.token || storageGet('pixgo_token');
      if (data.token) storageSet('pixgo_token', data.token);

      writeMeCache({ user: data.user || null, plan: data.plan || null, profiles });

      set({
        user:     data.user     || null,
        plan:     data.plan     || null,
        profiles,
        activeProfileId: activeId,
        token:    latestToken,
        hydrated: true,
      });
    } catch {
      // FIX: catch aqui só dispara em falha de REDE (offline, DNS, timeout) —
      // uma resposta real do servidor (mesmo negativa) já foi tratada acima
      // em `if (!res.ok)`. Antes, isto tratava "sem rede" exactamente como
      // "sessão inválida": apagava o token e forçava logout/login mesmo com
      // o utilizador só offline e o token continuando perfeitamente válido.
      // Mantém o token local intacto — necessário para as páginas offline
      // (downloads) continuarem a funcionar sem rede.
      set({ hydrated: true, token: storageGet('pixgo_token') });
    }
  },

  isAdmin: () => get().user?.role === 'admin',
}));

// ── Exports ──────────────────────────────────────────────────────────────────────
export { authedFetch, refreshAccessToken };