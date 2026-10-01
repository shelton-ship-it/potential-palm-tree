// lib/env.js
// ─────────────────────────────────────────────────────────────────────────────
// Environment accessor for EdgeOne Pages Node Functions.
//
// In Node Functions, environment variables are available via process.env —
// the same as any standard Node.js application. Variables defined in the
// EdgeOne Pages dashboard (Settings → Environment Variables) are injected
// into process.env before the function runs.
//
// KV bindings are NOT on process.env — they are global variables accessible
// via globalThis[bindingName]. See edgeone.js for KV access patterns.
//
// Usage:
//   import { getEnv } from './lib/env.js';
//   const secret = getEnv('JWT_SECRET');
//   const port   = getEnvInt('PORT', 3000);
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a configuration value from process.env.
 * @param {string} key        - The environment variable name.
 * @param {string} [fallback] - Default value if not set or empty.
 * @returns {string|undefined}
 */
export function getEnv(key, fallback) {
    const val = process.env[key];
    if (val !== undefined && val !== '') return val;
    return fallback;
}

/**
 * Read a numeric integer value from process.env.
 */
export function getEnvInt(key, fallback) {
    const v = getEnv(key);
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
}

/**
 * Read a float value from process.env.
 */
export function getEnvFloat(key, fallback) {
    const v = getEnv(key);
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
}

/**
 * Read a boolean from process.env.
 * "true", "1", "yes" → true; anything else → false.
 */
export function getEnvBool(key, fallback = false) {
    const v = getEnv(key);
    if (v === undefined) return fallback;
    return ['true', '1', 'yes'].includes(v.toLowerCase());
}

/**
 * setEnv and getKVBinding kept for import compatibility with other modules
 * that may reference them. They are no-ops in the Node Functions runtime.
 *
 * KV bindings are accessed via globalThis[bindingName] in edgeone.js —
 * not via this module.
 */
export function setEnv(_env) {
    // No-op in Node Functions. process.env is populated by the platform.
}

export function getKVBinding(_bindingName) {
    // No-op shim. Use globalThis[bindingName] directly in edgeone.js.
    return null;
}

export function isEnvReady() {
    return true; // process.env is always available in Node.js
}