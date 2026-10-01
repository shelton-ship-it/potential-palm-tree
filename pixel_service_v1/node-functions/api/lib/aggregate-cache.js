// lib/aggregate-cache.js — TOMBSTONE (v7.0)
// ─────────────────────────────────────────────────────────────────────────────
// Este módulo foi desativado em v7.
//
// PROBLEMA QUE JUSTIFICA A REMOÇÃO:
//   O aggregate usava o KV do EdgeOne como cache de catálogo.
//   Qualquer miss (deploy limpo, KV regional lag, chave expirada) disparava
//   rebuildAggregates() em background — uma operação pesada que:
//     • fazia scan completo do Turso (getContentIdsByType × 5 tipos × N páginas)
//     • escrevia múltiplas chaves KV
//     • podia ser disparada em paralelo por várias instâncias serverless,
//       causando cascata de rebuilds sem estado partilhado
//     • devolvia { items:[], _rebuilding:true } ao cliente — UX quebrada
//
//   O KV do EdgeOne não tem TTL nativo. O lock de rebuild era manual
//   (timestamp) e locks orphaned bloqueavam rebuilds por 5 minutos.
//
// SOLUÇÃO v7:
//   catalog.js, search.js consultam o Turso diretamente via
//   getContentIdsByType / getContentIdsByViews — indexados, paginação nativa,
//   sem consistência eventual nem rebuilds em cascata.
//
//   O KV continua usado APENAS para dados que realmente pertencem lá:
//     • stealth_playlist_{videoId}  → CATALOG_NS  (hot path do player)
//     • session_{token}             → PROGRESS_NS
//     • progress_{profile}_...     → PROGRESS_NS
//     • recent_v2_{profile}        → PROGRESS_NS
//     • rate_{type}_{ip}           → PROGRESS_NS
//     • geo_ip_{ip}                → LANG_NS
//     • refresh_{token}            → USERS_NS
//     • admin_log_...              → USERS_NS
//
// EXPORTS MANTIDOS COMO NO-OP:
//   Para não quebrar imports existentes enquanto se remove gradualmente.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ['pt', 'en'];
export const CONTENT_TYPES       = ['movie', 'series', 'documentary', 'dorama', 'anime', 'video', 'entertainment', 'finance', 'travel', 'education', 'courses'];
export const PAGE_SIZE           = 20;
export const FEATURED_SIZE       = 10;

export async function getAggregate()      { return null; }
export async function setAggregate()      { return; }
export async function injectContent()     { return; }
export async function rebuildAggregates() { return { skipped: true, reason: 'aggregate_cache_disabled' }; }
export async function rebuildForLangs()   { return; }
export function      invalidateMemCache() { return; }