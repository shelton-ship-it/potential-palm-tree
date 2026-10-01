// lib/catalog-cache.js — cache em memória (por instância) para queries do catálogo
// ─────────────────────────────────────────────────────────────────────────────
// Por que existe: getContentIdsByType/ByViews/Recommended fazem JOIN duplo com
// content_translation e (no caso "recent") ORDER BY ... RANDOM(), ou seja, leem e
// ordenam TODAS as linhas publicadas do tipo a cada chamada. O conteúdo só muda
// a cada 24–48h, então repetir isso por visitante é desperdício (e linhas lidas
// no Turso são cobradas).
//
// Regras:
//   • FRESH (padrão 10 min): dentro da janela → responde da memória, zero Turso.
//   • Passou do FRESH → 1 só refresh (single-flight: 50 pedidos simultâneos = 1
//     ida ao Turso). Se já existe valor antigo, espera no MÁXIMO REFRESH_WAIT_MS;
//     se demorar ou falhar, serve o valor antigo (stale-if-error, até STALE).
//   • Sem valor nenhum → espera o Turso (que tem timeout próprio). Falhas NUNCA
//     são gravadas em cache.
//   • Limite de entradas (LRU) para não crescer sem limite com chaves variadas.
//
// Por que FRESH curto mesmo com conteúdo a mudar a cada 24–48h: takedowns
// (copyright) e uploads novos aparecem em até FRESH. Como o cache é POR INSTÂNCIA,
// não há invalidação global — o TTL é o mecanismo. Ajustável por env.

// FRESH = 24h: alinhado ao SLA de takedown da plataforma (confirmado pelo
// time — remoções por copyright levam até 24h para sair do ar de qualquer
// forma, então o cache não é o gargalo). Um upload novo também só aparece
// no catálogo, nesta instância, depois de expirar o FRESH.
const FRESH_MS        = (Number(process.env.CATALOG_CACHE_FRESH_S)  || 24 * 3600) * 1000;
const STALE_MS        = (Number(process.env.CATALOG_CACHE_STALE_S)  || 72 * 3600) * 1000;
const REFRESH_WAIT_MS =  Number(process.env.CATALOG_REFRESH_WAIT_MS) || 3000;
const MAX_ENTRIES     =  Number(process.env.CATALOG_CACHE_MAX)      || 300;

const store    = new Map();   // key -> { value, at }   (ordem de inserção = LRU)
const inflight = new Map();   // key -> Promise         (single-flight)
const stats    = { hits: 0, misses: 0, stale: 0, refreshErrors: 0 };

function put(key, value) {
    store.delete(key);
    store.set(key, { value, at: Date.now() });
    while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

function refresh(key, loader) {
    let p = inflight.get(key);
    if (p) return p;
    p = Promise.resolve()
        .then(loader)
        .then(value => { put(key, value); return value; })
        .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

function staleAfter(ms, value) {
    let timer;
    const p = new Promise(resolve => { timer = setTimeout(() => resolve(value), ms); });
    return { p, cancel: () => clearTimeout(timer) };
}

export async function cached(key, loader) {
    const hit = store.get(key);
    const now = Date.now();

    if (hit && now - hit.at < FRESH_MS) {
        stats.hits++;
        store.delete(key); store.set(key, hit);          // toca no LRU
        return hit.value;
    }

    stats.misses++;
    const p = refresh(key, loader);

    // Nada utilizável guardado → tem de esperar (o Turso já tem timeout próprio).
    if (!hit || now - hit.at >= STALE_MS) return p;

    // Há valor antigo: nunca deixar o utilizador pendurado por causa do refresh.
    const safe  = p.catch(err => {
        stats.refreshErrors++;
        console.warn(`[catalog-cache] refresh falhou, a servir valor antigo (${key}): ${err?.message}`);
        return hit.value;
    });
    const timer = staleAfter(REFRESH_WAIT_MS, hit.value);
    const out   = await Promise.race([safe, timer.p]);
    timer.cancel();
    if (out === hit.value) stats.stale++;
    return out;
}

export function clearCatalogCache() { store.clear(); inflight.clear(); }
export function catalogCacheStats() {
    return { entries: store.size, inflight: inflight.size, fresh_s: FRESH_MS / 1000, ...stats };
}
