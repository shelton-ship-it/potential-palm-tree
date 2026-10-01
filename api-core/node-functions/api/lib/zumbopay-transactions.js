// lib/zumbopay-transactions.js — Transação interna pendente/confirmada do ZumboPay
// ─────────────────────────────────────────────────────────────────────────────
// A Hotmart não precisa disto: o checkout é 100% externo e o webhook activa
// directamente (activateSubscriptionFromHotmart). O ZumboPay embedded/STK
// precisa de um registo PENDING criado ANTES da confirmação (requisitos 9-10
// do pedido) — esta tabela é nova e aditiva, não toca em `users`/`subscription`
// além do que activateSubscriptionFromZumbopay já faz (mesmo padrão do
// Hotmart, ver lib/edgeone.js).
//
// Dedupe de webhook: guardamos o corpo bruto de cada entrega processada,
// indexado por uma chave estável derivada do payload (ver routes/zumbopay.js)
// — nunca confiamos apenas em "já vi este reference" porque um mesmo
// reference pode legitimamente receber mais que um evento (ex.: succeeded
// depois de um failed anterior); o que não pode repetir é o MESMO evento.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import { execute, getOne, json, fromJson } from './turso.js';

let _schemaReady = null;

export function ensureZumbopayTables() {
    if (_schemaReady) return _schemaReady;

    _schemaReady = (async () => {
        await execute(`
            CREATE TABLE IF NOT EXISTS zumbopay_transactions (
                id            TEXT PRIMARY KEY,
                user_id       TEXT NOT NULL,
                plan_id       TEXT NOT NULL,
                country       TEXT,
                currency      TEXT NOT NULL,
                amount        REAL NOT NULL,
                method        TEXT,
                wallet_id     TEXT,
                reference     TEXT UNIQUE,
                checkout_url  TEXT,
                status        TEXT NOT NULL DEFAULT 'pending',
                source_platform TEXT,
                return_to     TEXT,
                raw_request   TEXT,
                raw_response  TEXT,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            )
        `);
        await execute(`CREATE INDEX IF NOT EXISTS idx_zumbopay_tx_user      ON zumbopay_transactions(user_id)`);
        await execute(`CREATE INDEX IF NOT EXISTS idx_zumbopay_tx_reference ON zumbopay_transactions(reference)`);

        // Dedupe de eventos de webhook — event_key é um hash/identificador
        // estável extraído do payload (ver extractEventKey em routes/zumbopay.js).
        await execute(`
            CREATE TABLE IF NOT EXISTS zumbopay_webhook_events (
                event_key   TEXT PRIMARY KEY,
                event_name  TEXT,
                reference   TEXT,
                raw_payload TEXT,
                processed_at TEXT NOT NULL
            )
        `);
    })().catch(err => {
        _schemaReady = null;
        throw err;
    });

    return _schemaReady;
}

export async function createPendingTransaction({ userId, planId, country, currency, amount, method, walletId, sourcePlatform, returnTo, rawRequest }) {
    await ensureZumbopayTables();
    const id  = randomUUID();
    const now = new Date().toISOString();
    await execute(`
        INSERT INTO zumbopay_transactions
            (id, user_id, plan_id, country, currency, amount, method, wallet_id, status, source_platform, return_to, raw_request, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `, [id, userId, planId, country || null, currency, amount, method || null, walletId || null, sourcePlatform || null, returnTo || null, json(rawRequest), now, now]);
    return id;
}

export async function attachReference(id, { reference, checkoutUrl, rawResponse, status }) {
    await ensureZumbopayTables();
    const now = new Date().toISOString();
    await execute(`
        UPDATE zumbopay_transactions
        SET reference = ?, checkout_url = ?, raw_response = ?, status = ?, updated_at = ?
        WHERE id = ?
    `, [reference || null, checkoutUrl || null, json(rawResponse), status || 'pending', now, id]);
}

export async function getTransactionById(id) {
    await ensureZumbopayTables();
    const row = await getOne(`SELECT * FROM zumbopay_transactions WHERE id = ?`, [id]);
    return rowToTx(row);
}

export async function getTransactionByReference(reference) {
    await ensureZumbopayTables();
    const row = await getOne(`SELECT * FROM zumbopay_transactions WHERE reference = ?`, [reference]);
    return rowToTx(row);
}

export async function updateTransactionStatus(id, status) {
    await ensureZumbopayTables();
    await execute(`UPDATE zumbopay_transactions SET status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), id]);
}

function rowToTx(row) {
    if (!row) return null;
    return {
        id: row.id, userId: row.user_id, planId: row.plan_id, country: row.country,
        currency: row.currency, amount: parseFloat(row.amount), method: row.method,
        walletId: row.wallet_id, reference: row.reference, checkoutUrl: row.checkout_url,
        status: row.status, sourcePlatform: row.source_platform, returnTo: row.return_to,
        rawRequest: fromJson(row.raw_request), rawResponse: fromJson(row.raw_response),
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

/** Idempotência de webhook — devolve true se este evento já foi processado. */
export async function hasProcessedEvent(eventKey) {
    await ensureZumbopayTables();
    const row = await getOne(`SELECT event_key FROM zumbopay_webhook_events WHERE event_key = ?`, [eventKey]);
    return !!row;
}

export async function markEventProcessed(eventKey, { eventName, reference, rawPayload }) {
    await ensureZumbopayTables();
    // INSERT OR IGNORE: se duas entregas concorrentes do mesmo evento
    // chegarem ao mesmo tempo, só uma grava — a outra é ignorada aqui e
    // detectada pelo hasProcessedEvent() a montante (ver routes/zumbopay.js).
    await execute(`
        INSERT OR IGNORE INTO zumbopay_webhook_events (event_key, event_name, reference, raw_payload, processed_at)
        VALUES (?, ?, ?, ?, ?)
    `, [eventKey, eventName || null, reference || null, json(rawPayload), new Date().toISOString()]);
}
