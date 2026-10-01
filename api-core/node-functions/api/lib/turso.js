// lib/turso.js — API direta /v2/pipeline (stateless, multi-user safe)
// ─────────────────────────────────────────────────────────────────────────────
// Usa fetch() nativo para comunicar directamente com a API HTTP OFICIAL do
// Turso: POST /v2/pipeline — https://docs.turso.tech/sdk/http/reference
//
// FIX (causa do 500 em login/registo/tudo): a versão anterior chamava
// POST /v3/cursor com um corpo { baton, batch: { steps: [...] } } e esperava
// resposta em NDJSON (step_begin/row/step_end). Esse endpoint e formato NÃO
// existem na API do Turso — daí o "route not found" em qualquer rota que
// tocasse a base de dados. O endpoint real aceita um array `requests`
// (execute + close) e devolve JSON normal em `results[].response.result`.
//
// Cada chamada fecha a conexão no mesmo pipeline (type: "close") — stateless,
// seguro para múltiplos utilizadores simultâneos em ambiente serverless.
//
// ATENÇÃO: null/undefined são convertidos para { type: "null" }.
//          Todos os outros valores são convertidos para string com { type: "text" }.
//          Blobs e números não são suportados directamente.
// ─────────────────────────────────────────────────────────────────────────────

import { getEnv, getEnvInt } from './env.js';

function encodeArg(v) {
    if (v === null || v === undefined) return { type: "null" };
    return { type: "text", value: String(v) };
}

async function tursoFetch(sql, args = []) {
    const url       = (getEnv('TURSO_DATABASE_URL', '')).replace('libsql://', 'https://').replace(/\/+$/, '');
    const token     = getEnv('TURSO_AUTH_TOKEN', '');
    const timeoutMs = getEnvInt('TURSO_TIMEOUT_MS', 8000);

    if (!url)   throw new Error('TURSO_DATABASE_URL não configurada.');
    if (!token) throw new Error('TURSO_AUTH_TOKEN não configurado.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(`${url}/v2/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [
                    { type: 'execute', stmt: { sql, args: args.map(encodeArg) } },
                    { type: 'close' },
                ],
            }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`Turso timeout após ${timeoutMs}ms (TURSO_TIMEOUT_MS) — verifica TURSO_DATABASE_URL/latência de rede.`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const data    = await response.json();
    const results = data.results || [];

    // O pipeline enviado é sempre [execute, close] — o resultado do
    // "execute" é sempre o primeiro item do array `results`.
    const execResult = results[0];
    if (!execResult) return { rows: [], columns: [], rowsAffected: 0 };

    if (execResult.type === 'error') {
        throw new Error(execResult.error?.message || 'Turso query error');
    }

    const result  = execResult.response?.result || {};
    const columns = (result.cols || []).map(c => c.name);
    // Cada valor de célula vem como { type, value } (formato Hrana) — extrai .value.
    const rows    = (result.rows || []).map(row =>
        Object.fromEntries(columns.map((col, i) => [col, row[i]?.value ?? null]))
    );

    return { rows, columns, rowsAffected: result.affected_row_count || 0 };
}

export async function execute(sql, args = []) {
    return tursoFetch(sql, Array.isArray(args) ? args : []);
}

export async function getOne(sql, args)   { const r = await execute(sql, args); return r.rows[0] || null; }
export async function getAll(sql, args)   { const r = await execute(sql, args); return r.rows; }
export async function getScalar(sql, args) { const r = await execute(sql, args); return (r.rows[0] && r.columns[0]) ? (r.rows[0][r.columns[0]] ?? null) : null; }
export async function insert(sql, args)   { return execute(sql, args); }
export async function ping()              { try { await execute('SELECT 1'); return true; } catch { return false; } }

export async function batch(queries) {
    if (!queries || queries.length === 0) return [];
    const results = [];
    for (const q of queries) {
        const sql  = typeof q === 'string' ? q : q.sql;
        const args = typeof q === 'string' ? [] : (q.args || []);
        results.push(await execute(sql, args));
    }
    return results;
}

export function getTursoClient() {
    return { execute: ({ sql, args }) => execute(sql, args || []) };
}

export function resetTursoClient() { /* stateless — nada a fazer */ }

export function bool(v)         { return v ? 1 : 0; }
export function fromBool(v)     { return v === 1 || v === true; }
export function json(v)         { return (v === null || v === undefined) ? null : JSON.stringify(v); }
export function fromJson(v)     { if (!v) return null; try { return JSON.parse(v); } catch { return null; } }
export function escapeLike(s)   { return String(s).replace(/[%_]/g, '\\\\$&'); }
export function toUnixTime(iso) { return iso ? Math.floor(new Date(iso).getTime() / 1000) : null; }
export function fromUnixTime(ts){ return ts ? new Date(ts * 1000).toISOString() : null; }

export default {
    getClient: getTursoClient, execute, getOne, getAll, getScalar, insert, batch, ping,
    escapeLike, bool, fromBool, json, fromJson, toUnixTime, fromUnixTime, reset: resetTursoClient,
};
