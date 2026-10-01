// lib/no-store.js — respostas que NUNCA podem ser cacheadas (browser, CDN/EdgeOne, SW)
// ─────────────────────────────────────────────────────────────────────────────
// Motivo: corre em serverless (EdgeOne Node Functions). Depois do webhook de
// pagamento, o plano activo tem de aparecer imediatamente em perfil, rate-limit
// e player — qualquer cópia cacheada dessas respostas mostraria o plano antigo.
// Corre ANTES do rate-limit, por isso os 401/402/403/429 dele também levam os
// headers. Inclui /api/plans e /api/payments/gateway (preço/gateway por país).
// ─────────────────────────────────────────────────────────────────────────────

const NEVER_CACHE_PREFIXES = ["/api/payments", "/api/webhooks", "/api/plans", "/api/auth/me", "/api/auth/refresh", "/api/usage"];

const NO_STORE = {
    'Cache-Control':     'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma':            'no-cache',
    'Expires':           '0',
    'Surrogate-Control': 'no-store',
    'CDN-Cache-Control': 'no-store',
};

// Respostas de bloqueio/limite dependem do plano no instante do pedido.
const ALWAYS_NO_STORE_STATUS = new Set([401, 402, 403, 429]);

export function isNeverCache(path) {
    return NEVER_CACHE_PREFIXES.some(p => path === p || path.startsWith(p.endsWith('/') ? p : p + '/') || path.startsWith(p + '?'));
}

function apply(res) {
    for (const [k, v] of Object.entries(NO_STORE)) res.setHeader(k, v);
    // Impede que um Vary/ETag antigo faça o cliente revalidar com 304 stale.
    res.removeHeader('ETag');
}

export function noStoreMiddleware(req, res, next) {
    if (isNeverCache(req.path)) apply(res);

    const origWriteHead = res.writeHead;
    res.writeHead = function (statusCode, ...rest) {
        if (ALWAYS_NO_STORE_STATUS.has(statusCode) && !res.headersSent) apply(res);
        return origWriteHead.call(this, statusCode, ...rest);
    };
    next();
}
