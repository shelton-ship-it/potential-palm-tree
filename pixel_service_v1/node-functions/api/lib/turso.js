// lib/turso.js
// ─────────────────────────────────────────────────────────────────────────────
// Turso HTTP — SQL over HTTP v3/pipeline
//
// Objetivos:
//   - Uma única chamada HTTP por execute()
//   - batch() verdadeiro: várias queries em UM pipeline HTTP
//   - Limite de concorrência para evitar tempestade de sockets
//   - Timeout cobrindo request + headers + corpo + parse
//   - Retry SOMENTE para falhas transitórias de transporte/servidor
//   - Não repetir automaticamente SQL potencialmente não-idempotente
//   - Respeitar base_url devolvido pelo Turso
//   - Manter a API pública anterior
//
// O /v3/pipeline é o endpoint recomendado para novos clientes.
// /v3/cursor fica reservado para resultados grandes que precisem de
// streaming incremental.
// ─────────────────────────────────────────────────────────────────────────────

import { getEnv } from './env.js';

const TURSO_TIMEOUT_MS =
    Number(process.env.TURSO_FETCH_TIMEOUT_MS) || 5000;

const TURSO_MAX_CONCURRENCY =
    Math.max(1, Number(process.env.TURSO_MAX_CONCURRENCY) || 20);

const TURSO_MAX_RETRIES =
    Math.max(0, Number(process.env.TURSO_MAX_RETRIES) || 1);

const TURSO_RETRY_BASE_MS =
    Math.max(25, Number(process.env.TURSO_RETRY_BASE_MS) || 150);

const TURSO_RETRY_MAX_MS =
    Math.max(100, Number(process.env.TURSO_RETRY_MAX_MS) || 1000);


// ─────────────────────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────────────────────

function getTursoConfig() {
    const configuredUrl = getEnv('TURSO_DATABASE_URL', '');
    const token = getEnv('TURSO_AUTH_TOKEN', '');

    if (!configuredUrl) {
        throw new Error('TURSO_DATABASE_URL não configurada.');
    }

    if (!token) {
        throw new Error('TURSO_AUTH_TOKEN não configurado.');
    }

    const url = configuredUrl
        .replace(/^libsql:\/\//, 'https://')
        .replace(/\/$/, '');

    return { url, token };
}


// ─────────────────────────────────────────────────────────────────────────────
// Argumentos
// ─────────────────────────────────────────────────────────────────────────────
//
// Mantido compatível com a implementação anterior.
// ─────────────────────────────────────────────────────────────────────────────

function encodeArg(v) {
    if (v === null || v === undefined) {
        return { type: 'null' };
    }

    if (typeof v === 'boolean') {
        return {
            type: 'integer',
            value: v ? '1' : '0',
        };
    }

    if (typeof v === 'number') {
        if (!Number.isFinite(v)) {
            throw new Error('Turso: número não-finito nos argumentos.');
        }

        if (Number.isInteger(v)) {
            return {
                type: 'integer',
                value: String(v),
            };
        }

        return {
            type: 'float',
            value: String(v),
        };
    }

    if (typeof v === 'bigint') {
        return {
            type: 'integer',
            value: v.toString(),
        };
    }

    if (v instanceof Uint8Array) {
        let binary = '';

        for (const byte of v) {
            binary += String.fromCharCode(byte);
        }

        return {
            type: 'blob',
            base64: btoa(binary),
        };
    }

    return {
        type: 'text',
        value: String(v),
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// Decodificação de valores
// ─────────────────────────────────────────────────────────────────────────────

function decodeValue(value) {
    if (value == null) {
        return null;
    }

    switch (value.type) {
        case 'null':
            return null;

        case 'integer': {
            const raw = String(value.value);

            // Mantém números pequenos como Number para preservar
            // compatibilidade com o código existente.
            const n = Number(raw);

            if (
                Number.isSafeInteger(n) &&
                String(n) === raw
            ) {
                return n;
            }

            // Inteiros fora da faixa segura não devem perder precisão.
            return raw;
        }

        case 'float':
            return value.value === null
                ? NaN
                : Number(value.value);

        case 'text':
            return value.value ?? '';

        case 'blob':
            return value.base64 ?? '';

        default:
            return value.value ?? null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Resultado de statement
// ─────────────────────────────────────────────────────────────────────────────

function decodeStatementResult(result) {
    const columns = (result?.cols || []).map(
        c => c?.name ?? ''
    );

    const namedRows = (result?.rows || []).map(row => {
        const obj = {};

        for (let i = 0; i < columns.length; i++) {
            obj[columns[i]] = decodeValue(row?.[i]);
        }

        return obj;
    });

    return {
        rows: namedRows,
        columns,
        rowsAffected: result?.affected_row_count || 0,
        lastInsertRowid: result?.last_insert_rowid ?? null,
        rowsRead: result?.rows_read || 0,
        rowsWritten: result?.rows_written || 0,
        queryDurationMs: result?.query_duration_ms ?? null,
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// Concorrência
// ─────────────────────────────────────────────────────────────────────────────
//
// O cliente oficial do libSQL adicionou um limite de concorrência justamente
// para reduzir socket hangup. Aqui fazemos a mesma proteção no nível HTTP.
// ─────────────────────────────────────────────────────────────────────────────

let activeRequests = 0;
const waitQueue = [];

function acquireSlot() {
    if (activeRequests < TURSO_MAX_CONCURRENCY) {
        activeRequests++;
        return Promise.resolve();
    }

    return new Promise(resolve => {
        waitQueue.push(resolve);
    });
}

function releaseSlot() {
    const next = waitQueue.shift();

    if (next) {
        next();
        return;
    }

    activeRequests--;
}

async function withConcurrencyLimit(fn) {
    await acquireSlot();

    try {
        return await fn();
    } finally {
        releaseSlot();
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Retry
// ─────────────────────────────────────────────────────────────────────────────

function isRetryableStatus(status) {
    return (
        status === 408 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}

function isRetryableError(err) {
    const name = err?.name || '';
    const code = err?.code || '';

    return (
        name === 'AbortError' ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE' ||
        code === 'UND_ERR_SOCKET' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'FETCH_ERROR'
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
    const exponential =
        Math.min(
            TURSO_RETRY_MAX_MS,
            TURSO_RETRY_BASE_MS * (2 ** attempt)
        );

    // Pequeno jitter para impedir várias requests concorrentes
    // de serem repetidas simultaneamente.
    return Math.floor(
        exponential * (0.75 + Math.random() * 0.5)
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// HTTP pipeline
// ─────────────────────────────────────────────────────────────────────────────

async function sendPipeline({
    url,
    token,
    requests,
}) {
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        TURSO_TIMEOUT_MS
    );

    try {
        const response = await fetch(`${url}/v3/pipeline`, {
            method: 'POST',
            signal: controller.signal,

            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },

            body: JSON.stringify({
                baton: null,
                requests,
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');

            const error = new Error(
                `Turso HTTP ${response.status}: ${text.slice(0, 300)}`
            );

            error.status = response.status;

            throw error;
        }

        return await response.json();

    } catch (err) {
        if (
            err?.name === 'AbortError' ||
            controller.signal.aborted
        ) {
            const timeoutError = new Error(
                `Turso timeout após ${TURSO_TIMEOUT_MS}ms`
            );

            timeoutError.code = 'TURSO_TIMEOUT';
            timeoutError.retryable = true;

            throw timeoutError;
        }

        throw err;

    } finally {
        clearTimeout(timer);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Execução de pipeline com retry seguro
// ─────────────────────────────────────────────────────────────────────────────

async function executePipeline(requests, {
    retry = true,
} = {}) {
    const { url: configuredUrl, token } = getTursoConfig();

    let url = configuredUrl;
    let lastError;

    const attempts = retry
        ? TURSO_MAX_RETRIES + 1
        : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const data = await sendPipeline({
                url,
                token,
                requests,
            });

            // O servidor pode indicar outro base_url para o stream.
            // Como este pipeline é fechado no próprio request, isso não
            // precisa ser persistido globalmente.
            //
            // Se no futuro houver transações interativas, o baton e o
            // base_url deverão ser mantidos juntos nessa sessão.

            if (!data || !Array.isArray(data.results)) {
                throw new Error(
                    'Turso: resposta sem results.'
                );
            }

            return data;

        } catch (err) {
            lastError = err;

            const retryable =
                isRetryableError(err) ||
                isRetryableStatus(err?.status);

            if (
                !retry ||
                !retryable ||
                attempt >= attempts - 1
            ) {
                throw err;
            }

            await sleep(retryDelay(attempt));
        }
    }

    throw lastError;
}


// ─────────────────────────────────────────────────────────────────────────────
// Execute individual
// ─────────────────────────────────────────────────────────────────────────────

async function tursoFetch(sql, args = []) {
    if (!sql || typeof sql !== 'string') {
        throw new Error('Turso: SQL inválido.');
    }

    const requests = [
        {
            type: 'execute',

            stmt: {
                sql,
                args: Array.isArray(args)
                    ? args.map(encodeArg)
                    : [],

                want_rows: true,
            },
        },

        // Obrigatório ser o último request quando utilizado.
        { type: 'close' },
    ];

    return withConcurrencyLimit(async () => {
        let data;

        try {
            data = await executePipeline(requests, {
                // IMPORTANTE:
                // execute() pode conter INSERT/UPDATE/DELETE.
                // Não repetimos automaticamente SQL mutável.
                retry: false,
            });

        } catch (err) {
            throw err;
        }

        const first = data.results[0];

        if (!first) {
            throw new Error(
                'Turso: resposta sem resultado do execute.'
            );
        }

        if (first.type === 'error') {
            throw new Error(
                `Turso SQL error: ${
                    first.error?.message || 'desconhecido'
                }`
            );
        }

        if (
            first.type !== 'ok' ||
            first.response?.type !== 'execute'
        ) {
            throw new Error(
                'Turso: resposta inválida para execute.'
            );
        }

        return decodeStatementResult(
            first.response.result
        );
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

export async function execute(sql, args = []) {
    return tursoFetch(
        sql,
        Array.isArray(args) ? args : []
    );
}

export async function getOne(sql, args) {
    const r = await execute(sql, args);
    return r.rows[0] || null;
}

export async function getAll(sql, args) {
    const r = await execute(sql, args);
    return r.rows;
}

export async function getScalar(sql, args) {
    const r = await execute(sql, args);

    return (
        r.rows[0] &&
        r.columns[0]
    )
        ? (
            r.rows[0][r.columns[0]] ?? null
        )
        : null;
}

export async function insert(sql, args) {
    return execute(sql, args);
}

export async function ping() {
    try {
        await execute('SELECT 1');
        return true;
    } catch {
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// BATCH REAL
// ─────────────────────────────────────────────────────────────────────────────
//
// Antes:
//   N queries = N requests HTTP
//
// Agora:
//   N queries = 1 request HTTP
//
// Cada query continua independente em termos de resultado.
// Não adicionamos BEGIN/COMMIT porque isso mudaria a semântica atual.
// ─────────────────────────────────────────────────────────────────────────────

export async function batch(queries) {
    if (!Array.isArray(queries) || queries.length === 0) {
        return [];
    }

    const requests = queries.map(q => {
        const sql =
            typeof q === 'string'
                ? q
                : q?.sql;

        const args =
            typeof q === 'string'
                ? []
                : (q?.args || []);

        if (!sql || typeof sql !== 'string') {
            throw new Error(
                'Turso batch: query inválida.'
            );
        }

        return {
            type: 'execute',

            stmt: {
                sql,
                args: Array.isArray(args)
                    ? args.map(encodeArg)
                    : [],

                want_rows: true,
            },
        };
    });

    // Fecha explicitamente o stream.
    requests.push({
        type: 'close',
    });

    return withConcurrencyLimit(async () => {
        // Não fazemos retry automático:
        // um batch pode conter INSERT/UPDATE/DELETE.
        const data = await executePipeline(
            requests,
            { retry: false }
        );

        const output = [];

        for (let i = 0; i < queries.length; i++) {
            const item = data.results[i];

            if (!item) {
                throw new Error(
                    `Turso batch: resultado ausente no índice ${i}.`
                );
            }

            if (item.type === 'error') {
                throw new Error(
                    `Turso SQL error no batch [${i}]: ${
                        item.error?.message || 'desconhecido'
                    }`
                );
            }

            if (
                item.type !== 'ok' ||
                item.response?.type !== 'execute'
            ) {
                throw new Error(
                    `Turso batch: resposta inválida no índice ${i}.`
                );
            }

            output.push(
                decodeStatementResult(
                    item.response.result
                )
            );
        }

        return output;
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// Cliente compatível com a aplicação existente
// ─────────────────────────────────────────────────────────────────────────────

export function getTursoClient() {
    return {
        execute: ({ sql, args }) =>
            execute(sql, args || []),

        batch: queries =>
            batch(queries),
    };
}

export function resetTursoClient() {
    // Stateless.
}


// ─────────────────────────────────────────────────────────────────────────────
// Helpers existentes
// ─────────────────────────────────────────────────────────────────────────────

export function bool(v) {
    return v ? 1 : 0;
}

export function fromBool(v) {
    return v === 1 || v === true;
}

export function json(v) {
    return (
        v === null ||
        v === undefined
    )
        ? null
        : JSON.stringify(v);
}

export function fromJson(v) {
    if (!v) return null;

    try {
        return JSON.parse(v);
    } catch {
        return null;
    }
}

export function escapeLike(s) {
    return String(s).replace(
        /[%_]/g,
        '\\$&'
    );
}

export function toUnixTime(iso) {
    return iso
        ? Math.floor(
            new Date(iso).getTime() / 1000
        )
        : null;
}

export function fromUnixTime(ts) {
    return ts
        ? new Date(
            ts * 1000
        ).toISOString()
        : null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Default
// ─────────────────────────────────────────────────────────────────────────────

export default {
    getClient: getTursoClient,

    execute,
    getOne,
    getAll,
    getScalar,
    insert,
    batch,
    ping,

    escapeLike,
    bool,
    fromBool,
    json,
    fromJson,
    toUnixTime,
    fromUnixTime,

    reset: resetTursoClient,
};