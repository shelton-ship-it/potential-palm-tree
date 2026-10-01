// middleware/rate-limit.js — StreamVault v2
//
// IP DETECTION: getClientIP() (lib/geoip.js) resolve o IP real do visitante,
// priorizando req.clientIp (campo nativo das EdgeOne Pages Node Functions) e
// caindo para EO-Connecting-IP / X-Forwarded-For como fallback.
//
// FILOSOFIA (YouTube-like):
//   O endpoint /stream é chamado UMA vez por sessão de visualização — apenas
//   para obter a chave e o manifesto. Não tem rate-limit de requests.
//   O tempo de visualização é medido por heartbeats do player (POST /api/content/:id/heartbeat)
//   a cada 30s, apenas enquanto o vídeo está efectivamente a ser reproduzido.
//   O /stream só verifica se o dispositivo já esgotou a quota — nunca actualiza o contador.
//
// FREE TIER (re-activado — rodada 2):
//   • Streaming com anúncios, limitado a 1h/dia por CONTA (user_id), não por
//     dispositivo. O limite anterior (2h/dia, e antes disso 1h vitalício por
//     dispositivo — ago/2026) tinha uma falha: a chave (`device:${deviceId}`)
//     não incluía o dia, logo era na prática um limite vitalício por
//     dispositivo, não diário — corrigido aqui incluindo o dia na chave
//     (`user:${userId}:${YYYY-MM-DD}`), que também resolve o problema de
//     reset ao trocar de dispositivo (CGNAT já não é relevante, a chave
//     agora é por conta autenticada).
//   • ANTI-FRAUDE — uma sessão activa por conta free: pv_did (cookie
//     httpOnly já existente) identifica o dispositivo. Iniciar /stream num
//     dispositivo novo torna-o o activo para a conta ("last login wins") —
//     o dispositivo anterior é recusado no heartbeat seguinte (409). Planos
//     pagos ficam de fora desta verificação (múltiplos ecrãs, ver plan.features).
//   • Ao esgotar a 1h, a rota devolve 403 com upgrade_url — o frontend deve
//     usar isso para mostrar o modal de "limite diário atingido".
//
// PAID USERS:
//   • plan_id !== 'free' → acesso ilimitado imediato
//   • Fallback: subscription activa no KV (race condition pós-pagamento)
//   • Dispositivo marcado como "pago" — ilimitado para todas as contas nesse dispositivo
//
// RATE LIMITS GERAIS (por IP — não sofrem com CGNAT por serem por-janela, não acumulativos):
//   • /stream, /heartbeat, HLS segments: SEM rate-limit de requests
//   • Utilizadores autenticados: 10 000 req/h
//   • Admin: 5 000 req/h
//   • Auth endpoints: 30 req/h por IP (anti-brute-force)
//   • Anónimo / IP: 2 000 req/h
//
// HEARTBEAT (POST /api/content/:id/heartbeat):
//   Body: { position: number }   — posição actual em segundos
//   Acumula 30s de elapsed_ms por chamada (intervalo fixo do player).
//   Idempotente: chamadas duplicadas dentro de 20s não acumulam.

// FIX: importar getClientIP do geoip.js (lê EO-Client-IP da EdgeOne correctamente)
import { getClientIP } from '../lib/geoip.js';
import { execute, getOne, getAll } from '../lib/turso.js';
import { withTimeout } from '../lib/timeout.js';
import { kvKey } from '../lib/edgeone.js';
import crypto from 'crypto';

// FIX (pareamento TV, pedido do user): cookie pixgo_tv_paired, definido por
// api-core (pixel.pixgo.qzz.io/api/auth/device/activate) no MESMO domínio
// partilhado do pixgo_session. Uma TV emparelhada via código nunca disputa
// o slot único do plano free com o telemóvel que a emparelhou nem é
// expulsa por ele — ver enforceScreenLimit/isScreenStillActive/screenCapForPlan
// abaixo. Sem sincronizar nenhum device_id entre os dois serviços: é só
// este booleano por dispositivo físico.
const TV_PAIRED_COOKIE = 'pixgo_tv_paired';
function isTvPairedRequest(req) { return req.cookies?.[TV_PAIRED_COOKIE] === '1'; }

// ── Timeouts (fail-open) para as duas dependências externas deste ficheiro ──
// KV (contador de 1h/dia, PROGRESS_NS) e Turso (dispositivo activo único)
// já tinham try/catch pra ERROS, mas nenhum limite de tempo pra chamadas
// LENTAS que não chegam a falhar — nesse caso ficavam simplesmente à espera.
// Isto dá um orçamento de tempo explícito a cada uma; ao estourar, segue
// fail-open (não bloqueia streaming por causa de storage lento).
const KV_TIMEOUT_MS    = Number(process.env.RL_KV_TIMEOUT_MS)    || 400;
const TURSO_TIMEOUT_MS = Number(process.env.RL_TURSO_TIMEOUT_MS) || 600;

// FIX: free-time por device-id (cookie), não só por IP.
// Em redes móveis com CGNAT o IP público muda a cada reconexão — isso fazia
// o contador de 1h resetar sozinho (grátis demais) e, pior, colapsava
// visitantes diferentes que caíssem no mesmo IP momentâneo (free-time
// reduzido pra quem acabou de chegar). Um cookie httpOnly persistente
// identifica o MESMO dispositivo mesmo quando o IP troca.
const DEVICE_COOKIE         = 'pv_did';
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // ~400 dias (máx. prático de cookies)
const DEVICE_ID_RE          = /^[a-f0-9-]{36}$/i;

// FIX: recuperação de device-id por fingerprint quando o cookie é limpo.
// FingerprintJS (client-side) gera um visitorId estável por browser mesmo
// sem cookies/localStorage — sozinho tem só ~40-60% de precisão, por isso
// NUNCA é usado como chave principal do contador, só para recuperar um
// device-id já conhecido e evitar dar 1h nova a quem só limpou cookies.
const DEVICE_FP_RE       = /^[a-zA-Z0-9_-]{16,64}$/;
const NEW_DEVICE_CAP_PER_IP_DAY = 5; // limita criação de devices novos por IP/dia

function setDeviceCookie(res, deviceId) {
  try {
    res.cookie(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   DEVICE_COOKIE_MAX_AGE,
    });
  } catch (err) {
    console.error('[rate-limit] Failed to set device cookie:', err.message);
  }
}

async function getDeviceByFingerprint(edgeone, fp) {
  try {
    return await edgeone.get('progress', `fpmap:${fp}`);
  } catch {
    return null;
  }
}

async function setDeviceFingerprint(edgeone, fp, deviceId) {
  try {
    await edgeone.put('progress', `fpmap:${fp}`, deviceId);
  } catch (err) {
    console.error('[rate-limit] Failed to save fingerprint map:', err.message);
  }
}

// Limita quantos devices NOVOS (sem cookie nem fingerprint reconhecido) podem
// ser criados pelo mesmo IP por dia. Não interfere com heartbeats normais
// (que reusam device-id existente) — só desacelera quem cria device+fingerprint
// novos em loop pra ganhar horas grátis extra.
async function checkAndIncrementNewDeviceCap(edgeone, ip, limit = NEW_DEVICE_CAP_PER_IP_DAY) {
  try {
    const key   = `newdevice:${ip}`;
    const now   = Date.now();
    const winMs = 24 * 60 * 60 * 1000;
    const raw   = await edgeone.get('progress', key);
    let data    = raw ? JSON.parse(raw) : null;
    if (!data || (now - data.first_request) > winMs) data = { count: 1, first_request: now };
    else data.count += 1;
    await edgeone.put('progress', key, JSON.stringify(data));
    return { allowed: data.count <= limit, count: data.count };
  } catch {
    return { allowed: true, count: 0 };
  }
}

/**
 * Resolve o device-id do visitante:
 *   1. Cookie válido → caminho normal, sem chamadas extra ao KV.
 *   2. Sem cookie, mas fingerprint reconhecido → recupera o device-id existente
 *      (evita reset trivial por limpeza de cookies) e restaura o cookie.
 *   3. Sem cookie nem fingerprint reconhecido → device genuinamente novo;
 *      aplica o cap de criação por IP/dia e marca fingerprint→device para o futuro.
 * Retorna { deviceId, capExceeded }.
 */
async function resolveDeviceId(req, res, edgeone, ip) {
  const existing = req.cookies?.[DEVICE_COOKIE];
  if (existing && DEVICE_ID_RE.test(existing)) {
    return { deviceId: existing, capExceeded: false };
  }

  const fpHeader = req.headers['x-device-fp'];
  const fp = (typeof fpHeader === 'string' && DEVICE_FP_RE.test(fpHeader)) ? fpHeader : null;

  if (fp) {
    const recovered = await getDeviceByFingerprint(edgeone, fp);
    if (recovered && DEVICE_ID_RE.test(recovered)) {
      setDeviceCookie(res, recovered);
      return { deviceId: recovered, capExceeded: false };
    }
  }

  // Device genuinamente novo
  const deviceId = crypto.randomUUID();
  setDeviceCookie(res, deviceId);
  if (fp) setDeviceFingerprint(edgeone, fp, deviceId).catch(() => {});

  const cap = await checkAndIncrementNewDeviceCap(edgeone, ip);
  return { deviceId, capExceeded: !cap.allowed };
}

const FREE_STREAM_LIMIT_MS  = 1 * 60 * 60 * 1000; // 1 hora/dia (era 2h/dia — ajustado a pedido)
// FIX (CPU-ms / carga em KV): heartbeat passou de 30s pra 120s — 1/4 das
// chamadas de KV por sessão de visualização, sem perder precisão real (o
// contador é "flat accounting": cada heartbeat bem sucedido credita
// exactamente HEARTBEAT_INTERVAL_MS, não um delta medido). O frontend
// (ShakaPlayer.tsx, app/main/channels/page.tsx) TEM de usar o mesmo valor —
// um dessincronizado faria o utilizador free ganhar ou perder tempo real.
const HEARTBEAT_INTERVAL_MS = 120_000;             // 120s — intervalo do player
const HEARTBEAT_DEDUP_MS    = 100_000;             // janela de dedup (evita duplos), sempre < HEARTBEAT_INTERVAL_MS
const RATE_WINDOW_MS        = 60 * 60 * 1000;      // 1 hora

const RATE_LIMITS = {
  anon:   2_000,
  user:  10_000,
  admin:  5_000,
  auth:      30,
};

const PUBLIC_PATHS = ['/health'];

// ── Rotas de catálogo elegíveis a cache de borda (24h, ver lib/turso.js /
// lib/catalog-cache.js e catalog.js) ─────────────────────────────────────────
// Ficam de fora do rate-limit e, principalmente, de resolveDeviceId() —
// que é quem escreve o Set-Cookie do pv_did. Uma resposta cacheada pela
// EdgeOne carrega os headers junto, e o cache é PARTILHADO entre
// visitantes; se o pv_did fosse escrito aqui, o primeiro visitante sem
// cookie "gravaria" o seu pv_did na entrada do cache e TODOS os visitantes
// seguintes que caíssem nela receberiam o MESMO dispositivo — colapsando o
// anti-fraude de sessão única e o cap de devices novos por IP entre
// estranhos. As rotas do player (/stream, /heartbeat, /content) NÃO estão
// nesta lista e continuam com o pipeline completo (cookie, rate-limit,
// auth) exactamente como antes — o player depende disso.
const CATALOG_CACHEABLE_PATHS = [
  '/api/catalog', '/api/catalog/home', '/api/catalog/latest',
  '/api/catalog/featured', '/api/catalog/genres',
];
const AUTH_PATHS   = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/google'];

const STREAM_PATHS = [
  '/api/content/',
  '/api/channels/',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isPaidPlan(planId, expiresAt = null) {
  if (!planId || planId === 'free') return false;
  if (!expiresAt) return true;
  return new Date(expiresAt) > new Date();
}

function isStreamPath(req) {
  return STREAM_PATHS.some(prefix => req.path.startsWith(prefix));
}

function isVODStream(req) {
  return req.path.startsWith('/api/content/') && req.path.endsWith('/stream');
}

// Canais ao vivo passaram a entrar na MESMA quota de 1h/dia do VOD (pedido
// explícito do user: "adicione channel a esse limite"). Só os dois paths de
// reprodução real entram no gate — /categories, /search e /refresh
// continuam livres (são metadados/listagem, não reprodução).
const CHANNEL_NON_ID_SUBPATHS = ['categories', 'search', 'refresh'];

function isChannelPlay(req) {
  if (req.method !== 'GET') return false;
  const m = req.path.match(/^\/api\/channels\/([^/]+)$/);
  return !!m && !CHANNEL_NON_ID_SUBPATHS.includes(m[1]);
}

function isChannelHeartbeat(req) {
  return req.path.startsWith('/api/channels/') && req.path.endsWith('/heartbeat');
}

// Usada nos 429 de limite atingido (heartbeat/stream/canal) para o frontend
// mostrar o modal de upgrade sem preço/features hardcoded — vem sempre de
// app.edgeone.PLANS (fonte única, sem cripto desde a limpeza). Só os 3 ids
// canónicos pagos — 'premium'/'premium_quarterly'/'premium_annual' são
// duplicados internos do mesmo conteúdo (compat com plan_id antigos já
// gravados na tabela users), não devem aparecer aqui.
function buildUpsellPlans(edgeone) {
    return ['monthly', 'quarterly', 'annual'].map(id => {
        const p = edgeone.PLANS[id];
        return {
            id:            p.id,
            name:          p.name,
            price:         p.price,
            label:         p.label,
            billing_cycle: p.billing_cycle,
            features:      p.features,
        };
    });
}

function isHeartbeat(req) {
  return req.path.startsWith('/api/content/') && req.path.endsWith('/heartbeat');
}

async function loadStreamTimeRecord(edgeone, key) {
  try {
    const rec = await withTimeout(edgeone.getStreamTime(key), KV_TIMEOUT_MS, undefined);
    if (rec) return rec;
  } catch { /* non-fatal */ }
  return { started_at: null, elapsed_ms: 0, exhausted: false, paid_user_ids: [] };
}

async function saveStreamTimeRecord(edgeone, key, record) {
  try {
    // Não usamos withTimeout aqui pra devolver cedo: preferimos deixar a
    // escrita terminar em background a arriscar perder o incremento do
    // contador (uma escrita "perdida" por timeout seria pior que uma
    // resposta um pouco mais lenta — é só 1x a cada 120s por viewer).
    await edgeone.setStreamTime(key, record);
  } catch (err) {
    console.error('[rate-limit] Failed to save stream-time record:', err.message);
  }
}

async function hasActiveSubscription(edgeone, userId) {
  try {
    const sub = await edgeone.getSubscription(userId);
    if (!sub) return false;
    if (sub.status !== 'active') return false;
    if (sub.plan_id === 'free') return false;
    const expiry = sub.expires_at || sub.end_date;
    return expiry ? new Date(expiry) > new Date() : false;
  } catch {
    return false;
  }
}

async function markKeyAsPaid(edgeone, key, userId) {
  try {
    const record = await loadStreamTimeRecord(edgeone, key);
    const ids    = record.paid_user_ids || [];
    if (!ids.includes(userId)) {
      ids.push(userId);
      await saveStreamTimeRecord(edgeone, key, { ...record, paid_user_ids: ids });
    }
  } catch (err) {
    console.error('[rate-limit] Failed to mark key as paid:', err.message);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// ── Limite de ecrãs simultâneos — TODOS os planos (free incluído) ──────────
// Unificado (pedido do user): free = 2 ecrãs (antes era 1, single-device);
// planos pagos = o `max_profiles` já definido em PLANS (lib/edgeone.js) —
// 2/4/6 conforme o tier (mensal/trimestral/anual) — reaproveitado como
// "número de telas" em vez de inventar um campo/valor novo. Mesmo padrão
// "last login wins" de sempre, só que com N ecrãs em vez de 1: ao
// ultrapassar o limite, os mais antigos por `last_seen_at` são expulsos.
// Tabela nova (`active_screens`), a antiga `active_devices` (single-row)
// fica só como histórico morto, sem uso — zero migração, zero risco.
function screenCapForPlan(edgeone, planId) {
  if (!planId || planId === 'free') return 2; // pedido explícito do user
  const plan = edgeone?.PLANS?.[planId];
  return (plan && Number(plan.max_profiles) > 0) ? Number(plan.max_profiles) : 2;
}

let _activeScreensTableReady = null;
function ensureActiveScreensTable() {
  if (_activeScreensTableReady) return _activeScreensTableReady;
  _activeScreensTableReady = execute(`
    CREATE TABLE IF NOT EXISTS active_screens (
      user_id      TEXT NOT NULL,
      device_id    TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (user_id, device_id)
    )
  `).catch(err => { _activeScreensTableReady = null; throw err; });
  return _activeScreensTableReady;
}

/** Chamado ao iniciar /stream: regista este ecrã e, se o total da conta
 *  ultrapassar o limite do plano, expulsa os mais antigos. TV emparelhada
 *  (isTvPairedRequest) nunca passa por aqui — ver chamadas abaixo. */
async function enforceScreenLimit(userId, deviceId, cap) {
  try {
    await withTimeout(ensureActiveScreensTable(), TURSO_TIMEOUT_MS, null);
    await withTimeout(
      execute(
        `INSERT INTO active_screens (user_id, device_id, last_seen_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id, device_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
        [userId, deviceId, new Date().toISOString()],
      ),
      TURSO_TIMEOUT_MS,
      null,
    );
    const rows = await withTimeout(
      getAll('SELECT device_id FROM active_screens WHERE user_id = ? ORDER BY last_seen_at DESC', [userId]),
      TURSO_TIMEOUT_MS,
      undefined,
    );
    if (Array.isArray(rows) && rows.length > cap) {
      const evicted = rows.slice(cap).map(r => r.device_id);
      if (evicted.length) {
        const placeholders = evicted.map(() => '?').join(',');
        await execute(
          `DELETE FROM active_screens WHERE user_id = ? AND device_id IN (${placeholders})`,
          [userId, ...evicted],
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[rate-limit] enforceScreenLimit failed:', err.message);
  }
}

/**
 * Heartbeat: confirma que este ecrã ainda está entre os N activos da conta.
 *
 * FIX (incidente de lentidão geral no site, set/2026): esta função corria a
 * cada heartbeat (30s) de CADA visualização activa, incluindo contas pagas
 * que antes tinham ZERO idas ao Turso aqui. Sob uso normal isso multiplicou
 * muito o volume de queries no MESMO Turso partilhado pelo catálogo/preços,
 * e ficou tudo lento em fila atrás — não é código preso em loop, é volume.
 * Cache de ~45s em KV (namespace 'progress', mesmo do resto do heartbeat)
 * corta isto de "todo heartbeat" para ~1x a cada 45s por dispositivo, sem
 * abrir mão do controlo de ecrãs em si.
 */
async function isScreenStillActive(edgeone, userId, deviceId) {
  const cacheKey = kvKey('screenok', userId, deviceId);
  try {
    const cached = await edgeone.get('progress', cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.expires > Date.now()) return parsed.ok;
    }
  } catch { /* cache miss/corrupto — cai para o Turso abaixo */ }

  let result = true;
  try {
    await withTimeout(ensureActiveScreensTable(), TURSO_TIMEOUT_MS, null);
    const row = await withTimeout(
      getOne('SELECT device_id FROM active_screens WHERE user_id = ? AND device_id = ?', [userId, deviceId]),
      TURSO_TIMEOUT_MS,
      undefined,
    );
    result = row === undefined ? true : !!row; // timeout: fail-open, igual ao resto do ficheiro
  } catch {
    result = true;
  }

  edgeone.put('progress', cacheKey, JSON.stringify({ ok: result, expires: Date.now() + 45_000 })).catch(() => {});
  return result;
}

/**
 * Verifica APENAS se o dispositivo pode aceder — sem modificar o contador.
 * O contador só é modificado pelo heartbeat.
 */
async function checkFreeStreamAccess(edgeone, key) {
  const record = await loadStreamTimeRecord(edgeone, key);

  if (record.exhausted) {
    return { allowed: false, remaining_ms: 0, exhausted: true };
  }

  const remaining = FREE_STREAM_LIMIT_MS - (record.elapsed_ms || 0);
  return { allowed: true, remaining_ms: Math.max(0, remaining), exhausted: false };
}

/**
 * Acumula tempo de visualização — chamado apenas pelo heartbeat do player.
 * Dedup: chamadas dentro de HEARTBEAT_DEDUP_MS não acumulam (double-send protection).
 * Retorna { allowed, remaining_ms, exhausted }.
 */
export async function processHeartbeat(edgeone, key, userId = null) {
  const record = await loadStreamTimeRecord(edgeone, key);
  const now    = Date.now();

  // FIX: removido o bypass permanente por `paid_user_ids.length > 0`. Esta
  // função só é chamada quando o `isPaid` (live, com verificação de expiry)
  // já deu false para o request ATUAL — logo o dispositivo deve voltar a
  // ser medido pela hora grátis assim que a assinatura expirar, mesmo que
  // já tenha sido usado por uma conta paga antes. `paid_user_ids` continua
  // a ser gravado por markKeyAsPaid() só como registo histórico/suporte,
  // não como bypass de acesso.
  if (record.exhausted) {
    return { allowed: false, remaining_ms: 0, exhausted: true };
  }

  // Dedup: ignorar heartbeats duplicados dentro de HEARTBEAT_DEDUP_MS
  const lastHb = record.last_heartbeat ? new Date(record.last_heartbeat).getTime() : 0;
  if ((now - lastHb) < HEARTBEAT_DEDUP_MS) {
    const remaining = FREE_STREAM_LIMIT_MS - (record.elapsed_ms || 0);
    return { allowed: true, remaining_ms: Math.max(0, remaining), dedup: true };
  }

  // Acumular exactamente HEARTBEAT_INTERVAL_MS por heartbeat
  const newElapsed = (record.elapsed_ms || 0) + HEARTBEAT_INTERVAL_MS;

  if (newElapsed >= FREE_STREAM_LIMIT_MS) {
    await saveStreamTimeRecord(edgeone, key, {
      ...record,
      elapsed_ms:     FREE_STREAM_LIMIT_MS,
      exhausted:      true,
      exhausted_at:   new Date(now).toISOString(),
      last_heartbeat: new Date(now).toISOString(),
      started_at:     record.started_at || new Date(now).toISOString(),
    });
    return { allowed: false, remaining_ms: 0, exhausted: true };
  }

  await saveStreamTimeRecord(edgeone, key, {
    ...record,
    elapsed_ms:     newElapsed,
    last_heartbeat: new Date(now).toISOString(),
    started_at:     record.started_at || new Date(now).toISOString(),
  });

  return {
    allowed:      true,
    remaining_ms: FREE_STREAM_LIMIT_MS - newElapsed,
    exhausted:    false,
  };
}

// ── General rate-limit ─────────────────────────────────────────────────────────

async function checkAndIncrementRateLimit(edgeone, ip, type, limit) {
  try {
    const key  = `rate:${type}:${ip}`;
    const now  = Date.now();

    const raw  = await edgeone.get('progress', key);
    let data   = raw ? JSON.parse(raw) : null;

    if (!data || (now - data.last_request) > RATE_WINDOW_MS) {
      data = { requests: 1, last_request: now };
      await edgeone.put('progress', key, JSON.stringify(data));
      return { allowed: true, remaining: limit - 1 };
    }

    const remaining = limit - data.requests;
    if (remaining <= 0) {
      return { allowed: false, remaining: 0, reset: data.last_request + RATE_WINDOW_MS };
    }

    data.requests += 1;
    await edgeone.put('progress', key, JSON.stringify(data));
    return { allowed: true, remaining: remaining - 1, reset: data.last_request + RATE_WINDOW_MS };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

// ── Main middleware ─────────────────────────────────────────────────────────────

// FIX (crash em produção — "instância cai sempre que aparece ads"): este
// middleware roda em TODA requisição, mas o ramo mais pesado (quota de 1h,
// "1 dispositivo activo", heartbeat) só é exercido por contas FREE — as
// mesmas que veem anúncio. A função inteira não tinha nenhum try/catch de
// nível superior. A maioria das chamadas internas já é defensiva, mas
// bastava uma excepção escapar (edge case futuro, erro do Turso não
// previsto, etc.) para virar uma unhandled promise rejection — e no
// Node.js/Express 4 isso derruba o PROCESSO INTEIRO, não só esta request
// (Express 4 não captura erros de handlers/middlewares `async`). É por isso
// que a instância "cai e volta sozinha depois de um tempinho": o runtime
// mata o processo e o EdgeOne sobe um novo (cold start).
//
// A partir daqui: fail-open em caso de erro inesperado — deixa a request
// passar (next()) em vez de derrubar a instância. Um rate-limit que falha
// aberto por um instante é infinitamente melhor que o site inteiro cair.
export async function rateLimitMiddleware(req, res, next) {
  try {
    await rateLimitMiddlewareInner(req, res, next);
  } catch (err) {
    console.error('[rate-limit] erro inesperado, a deixar passar (fail-open):', err.message, err.stack);
    if (!res.headersSent) next();
  }
}

async function rateLimitMiddlewareInner(req, res, next) {
  const path = req.path;

  if (PUBLIC_PATHS.some(p => path === p)) return next();
  if (req.method === 'GET' && CATALOG_CACHEABLE_PATHS.includes(path)) return next();
  if (!req.app.edgeone) return next();

  // FIX: usar getClientIP() do geoip.js que lê EO-Connecting-IP (header nativo EdgeOne Pages)
  const ip = getClientIP(req);

  // FIX: chave de free-time por device-id (cookie), não por IP puro — sobrevive
  // à troca de IP em redes móveis com CGNAT. IP continua a ser usado para o
  // rate-limit geral de requests (abaixo) e como limitador de criação de
  // devices novos (não como parte da chave de acumulação).
  // deviceId continua a existir (cookie pv_did/fingerprint) e é usado agora
  // para o anti-fraude de sessão única por conta (ver branches abaixo).
  // capExceeded (cap de devices novos por IP/dia) fica calculado mas sem
  // efeito aqui — a quota de horas grátis passou a ser por conta (user_id +
  // dia), não por device, por isso criar devices novos já não dá horas
  // extra por si só (streaming continua a exigir login em qualquer caso).
  const { deviceId } = await resolveDeviceId(req, res, req.app.edgeone, ip);

  // DEBUG (remover em produção se não for necessário):
  // console.log(`[rate-limit] IP: ${ip} | device: ${deviceId} | path: ${path}`);

  // ── STREAM PATHS — sem rate-limit de requests ──────────────────────────────
  if (isStreamPath(req)) {

    // Heartbeat — requer auth. Confirma reprodução e acumula tempo (free);
    // utilizadores pagos continuam sem anúncios e sem limite de tempo.
    // Unificado: VOD (/api/content/:id/heartbeat) e canal ao vivo
    // (/api/channels/:id/heartbeat) alimentam a MESMA quota de 1h/dia por
    // conta — pedido explícito do user ("adicione channel a esse limite").
    if (isHeartbeat(req) || isChannelHeartbeat(req)) {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const dailyKey = `user:${req.user.id}:${todayStr()}`;

      const isPaid = isPaidPlan(req.user.plan_id, req.user.plan_expires_at) ||
                     await hasActiveSubscription(req.app.edgeone, req.user.id);

      if (isPaid) {
        markKeyAsPaid(req.app.edgeone, dailyKey, req.user.id).catch(() => {});
      }

      // Ecrãs simultâneos — unificado para free e pago (cap por plano, ver
      // screenCapForPlan). TV emparelhada (pixgo_tv_paired) fica de fora
      // desta disputa — nunca é expulsa nem expulsa ninguém.
      const cap = screenCapForPlan(req.app.edgeone, req.user.plan_id);
      const stillActive = isTvPairedRequest(req) || await isScreenStillActive(req.app.edgeone, req.user.id, deviceId);
      if (!stillActive) {
        return res.status(409).json({
          allowed: false,
          error:   'Session Replaced',
          message: `Limite de ${cap} ecrã(s) simultâneo(s) do seu plano foi excedido. A sessão foi encerrada aqui.`,
          kicked:  true,
        });
      }
      if (isPaid) return res.json({ allowed: true, paid: true });

      const result = await processHeartbeat(req.app.edgeone, dailyKey, req.user.id);

      if (!result.allowed) {
        // 429 (não 403): o frontend (ShakaPlayer.tsx) já espera este código
        // desde a versão anterior da feature — mantém o contrato existente
        // em vez de inventar um novo.
        return res.status(429).json({
          allowed:      false,
          exhausted:    true,
          remaining_ms: 0,
          error:        'Daily Limit Reached',
          message:      'Limite diário de 1 hora atingido no plano gratuito.',
          upgrade_url:  'https://app.pixgo.qzz.io/main/plans',
          plans:        buildUpsellPlans(req.app.edgeone),
        });
      }

      res.set('X-Free-Time-Remaining-Seconds', String(Math.floor(result.remaining_ms / 1000)));
      return res.json({ allowed: true, paid: false, has_ads: true, remaining_ms: result.remaining_ms });
    }

    // VOD /stream ou abrir canal ao vivo — início de sessão de visualização.
    // Mesma lógica para os dois: mesma quota (user:${id}:${day}), mesmo
    // anti-fraude de dispositivo único.
    if (!isVODStream(req) && !isChannelPlay(req)) return next();

    if (!req.user) {
      return res.status(401).json({
        error:   'Unauthorized',
        message: 'Faça login para assistir',
      });
    }

    const dailyKey = `user:${req.user.id}:${todayStr()}`;

    const isPaid = isPaidPlan(req.user.plan_id, req.user.plan_expires_at) ||
                   await hasActiveSubscription(req.app.edgeone, req.user.id);

    // Ecrãs simultâneos — unificado para free e pago (cap por plano). TV
    // emparelhada nunca reclama slot (nem é ela própria expulsa depois).
    if (!isTvPairedRequest(req)) {
      const cap = screenCapForPlan(req.app.edgeone, req.user.plan_id);
      await enforceScreenLimit(req.user.id, deviceId, cap);
    }

    if (isPaid) {
      markKeyAsPaid(req.app.edgeone, dailyKey, req.user.id).catch(() => {});
      res.set('X-Access-Type', 'paid');
      return next();
    }

    // Free: bloqueia ANTES de iniciar o stream se a 1h de hoje já acabou.
    const access = await checkFreeStreamAccess(req.app.edgeone, dailyKey);
    if (!access.allowed) {
      return res.status(429).json({
        error:       'Daily Limit Reached',
        message:     'Limite diário de 1 hora atingido no plano gratuito.',
        upgrade_url: 'https://app.pixgo.qzz.io/main/plans',
        plans:       buildUpsellPlans(req.app.edgeone),
        exhausted:   true,
      });
    }

    res.set('X-Access-Type', 'free');
    return next();
  }

  // ── GENERAL API RATE LIMITING ──────────────────────────────────────────────

  if (AUTH_PATHS.some(p => path.startsWith(p))) {
    const result = await checkAndIncrementRateLimit(req.app.edgeone, ip, `auth:${ip}`, RATE_LIMITS.auth);
    res.set('X-RateLimit-Limit',     String(RATE_LIMITS.auth));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining || 0)));
    if (!result.allowed) {
      const resetSec = result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : 3600;
      res.set('Retry-After', String(resetSec));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Demasiadas tentativas. Aguarde ${Math.ceil(resetSec / 60)} minutos.`,
      });
    }
    return next();
  }

  if (path.startsWith('/api/admin')) {
    const result = await checkAndIncrementRateLimit(req.app.edgeone, ip, `admin:${req.user?.id || ip}`, RATE_LIMITS.admin);
    res.set('X-RateLimit-Limit',     String(RATE_LIMITS.admin));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining || 0)));
    if (!result.allowed) {
      const resetSec = result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : 3600;
      res.set('Retry-After', String(resetSec));
      return res.status(429).json({ error: 'Too Many Requests', message: `Limite admin atingido.` });
    }
    return next();
  }

  if (req.user) {
    const result = await checkAndIncrementRateLimit(req.app.edgeone, ip, `user:${req.user.id}`, RATE_LIMITS.user);
    res.set('X-RateLimit-Limit',     String(RATE_LIMITS.user));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining || 0)));
    if (!result.allowed) {
      const resetSec = result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : 3600;
      res.set('Retry-After', String(resetSec));
      return res.status(429).json({ error: 'Too Many Requests', message: `Limite de pedidos atingido.` });
    }
    return next();
  }

  const result = await checkAndIncrementRateLimit(req.app.edgeone, ip, `ip:${ip}`, RATE_LIMITS.anon);
  res.set('X-RateLimit-Limit',     String(RATE_LIMITS.anon));
  res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining || 0)));
  if (!result.allowed) {
    const resetSec = result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : 3600;
    res.set('Retry-After', String(resetSec));
    return res.status(429).json({ error: 'Too Many Requests', message: `Muitos pedidos.` });
  }

  next();
}