// lib/plan-pricing-read.js — Leitura (SÓ leitura) da tabela `plan_prices`
// ─────────────────────────────────────────────────────────────────────────────
// Espelho read-only de api-core/lib/plan-pricing.js. A ÚNICA fonte de verdade
// dos VALORES é a tabela `plan_prices` no Turso partilhado, escrita apenas
// pelo api-core (é lá que existe o override MZ/ZumboPay). Este ficheiro
// existe só porque pixel_service_v1 é um deployment EdgeOne Pages separado
// (bundle próprio) — não há como importar literalmente o módulo do outro
// projecto — mas não define nem escreve nenhum preço, só lê.
//
// PLANS.premium/premium_quarterly/premium_annual (lib/edgeone.js deste
// projecto) continuam a ser o fallback se a leitura falhar ou não existir
// override — nenhum comportamento actual muda em caso de erro.
// ─────────────────────────────────────────────────────────────────────────────

import { execute, getOne } from './turso.js';

let _ensured = false;

async function ensureTableExists() {
    // Não recria a tabela aqui (isso é responsabilidade do api-core) — só
    // confirma que existe, para não rebentar se este serviço arrancar antes
    // do api-core alguma vez ter corrido. CREATE TABLE IF NOT EXISTS é
    // idempotente e inofensivo mesmo que já exista com dados.
    if (_ensured) return;
    await execute(`
        CREATE TABLE IF NOT EXISTS plan_prices (
            plan_id      TEXT NOT NULL,
            country_code TEXT NOT NULL DEFAULT '',
            currency     TEXT NOT NULL,
            price        REAL NOT NULL,
            label        TEXT,
            gateway      TEXT NOT NULL DEFAULT 'hotmart',
            updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (plan_id, country_code)
        )
    `);
    _ensured = true;
}

/**
 * Devolve { currency, price, label, gateway } se existir override para
 * (planId, countryCode), ou null (o chamador deve manter o preço hardcoded
 * actual nesse caso — nunca lançar, nunca bloquear a resposta por causa
 * disto).
 */
export async function getPlanPriceOverride(planId, countryCode) {
    if (!countryCode) return null;
    try {
        await ensureTableExists();
        const row = await getOne(
            `SELECT currency, price, label, gateway FROM plan_prices WHERE plan_id = ? AND country_code = ?`,
            [planId, countryCode.toUpperCase()],
        );
        if (!row) return null;
        return { currency: row.currency, price: parseFloat(row.price), label: row.label, gateway: row.gateway };
    } catch (err) {
        console.error('[plan-pricing-read] falha ao ler override (não bloqueante, mantém preço actual):', err.message);
        return null;
    }
}
