// lib/timeout.js
// ── Utilitários de resiliência para chamadas de rede/KV que NUNCA devem
// bloquear o caminho principal (servir conteúdo) por causa de anúncios ────
//
// Regra de ouro deste arquivo: tudo aqui tem "fail open" — se estourar o
// tempo ou der erro, devolve o fallback e segue a vida. Um anúncio que não
// carrega nunca pode ser motivo pra atrasar ou quebrar o conteúdo.

/**
 * Corre `fetch(url, opts)` com um limite de tempo real (aborta a request de
 * verdade via AbortController, não só ignora o resultado depois).
 */
export async function fetchWithTimeout(url, ms, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Corre qualquer promise com um orçamento de tempo. Se estourar, devolve
 * `fallback` imediatamente — a promise original continua rodando em
 * background (não cancela sozinha, a não ser que já use AbortController por
 * dentro), mas o caller não fica mais esperando por ela.
 */
export function withTimeout(promise, ms, fallback) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
}
