// lib/env.js
// ─────────────────────────────────────────────────────────────────────────────
// Environment accessor for EdgeOne Pages Node Functions.
// Variáveis definidas no dashboard EdgeOne Pages (Settings → Environment
// Variables) são injectadas em process.env antes da função correr.
// KV bindings NÃO estão em process.env — são globais via globalThis[binding].
// ─────────────────────────────────────────────────────────────────────────────

export function getEnv(key, fallback) {
    const val = process.env[key];
    if (val !== undefined && val !== '') return val;
    return fallback;
}

export function getEnvInt(key, fallback) {
    const v = getEnv(key);
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
}

export function getEnvFloat(key, fallback) {
    const v = getEnv(key);
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
}

export function getEnvBool(key, fallback = false) {
    const v = getEnv(key);
    if (v === undefined) return fallback;
    return ['true', '1', 'yes'].includes(v.toLowerCase());
}

/**
 * Lê uma lista separada por vírgulas do env (ex: origens CORS por plataforma).
 * Usage: getEnvList('ALLOWED_ORIGINS') → ['https://a.com', 'https://b.com']
 */
export function getEnvList(key, fallback = []) {
    const v = getEnv(key);
    if (!v) return fallback;
    return v.split(',').map(s => s.trim()).filter(Boolean);
}

export function isEnvReady() {
    return true;
}
