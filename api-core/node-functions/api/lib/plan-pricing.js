// lib/plan-pricing.js — Preços de plano por país (fonte única partilhada)
// ─────────────────────────────────────────────────────────────────────────────
// api-core e pixel_service_v1 partilham o MESMO Turso (mesma tabela `users`/
// `subscription` — ver lib/edgeone.js). Antes desta tabela, cada serviço
// tinha o SEU PRÓPRIO objecto PLANS hardcoded (api-core: env vars, genérico;
// pixel_service_v1: R$ 6/10/30 hardcoded) — duas fontes de verdade que podiam
// divergir. Esta tabela resolve isso: só o api-core ESCREVE aqui (é a
// autoridade de preço, incl. o override por país exigido pela integração
// ZumboPay/MZ); o pixel_service_v1 só LÊ (ver cópia read-only deste ficheiro
// nesse projecto), com fallback para o seu hardcoded existente se a leitura
// falhar — para não mudar comportamento observável em caso de erro.
//
// country_code = '' (string vazia) representa o preço DEFAULT/global (o que
// os PLANS actuais de cada serviço já mostram hoje). Uma linha com
// country_code = 'MZ' é um override específico para Moçambique.
// ─────────────────────────────────────────────────────────────────────────────

import { execute, getOne } from './turso.js';

let _schemaReady = null;

export function ensurePlanPricesTable() {
    if (_schemaReady) return _schemaReady;

    _schemaReady = (async () => {
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

        // Seed único do override MZ (140/290/840 MZN — confirmado pelo
        // utilizador em set/2026, ver /areas/pixgo-zumbopay-integration.md).
        // INSERT OR IGNORE — nunca sobrescreve um valor já ajustado a partir
        // do painel/admin depois deste primeiro seed.
        const seeds = [
            ['monthly',   'MZ', 'MZN', 140, '140 MZN / mês',       'zumbopay'],
            ['quarterly', 'MZ', 'MZN', 290, '290 MZN / trimestre', 'zumbopay'],
            ['annual',    'MZ', 'MZN', 840, '840 MZN / ano',       'zumbopay'],
        ];
        for (const [planId, country, currency, price, label, gateway] of seeds) {
            await execute(
                `INSERT OR IGNORE INTO plan_prices (plan_id, country_code, currency, price, label, gateway, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [planId, country, currency, price, label, gateway, new Date().toISOString()],
            );
        }
    })().catch(err => {
        _schemaReady = null;
        throw err;
    });

    return _schemaReady;
}

/**
 * Devolve o override de preço para (planId, countryCode), ou null se não
 * existir override para esse país (nesse caso o chamador deve usar o preço
 * DEFAULT já existente — env vars no api-core, hardcoded no pixel_service_v1).
 */
export async function getPlanPriceOverride(planId, countryCode) {
    if (!countryCode) return null;
    await ensurePlanPricesTable();
    const row = await getOne(
        `SELECT plan_id, country_code, currency, price, label, gateway
         FROM plan_prices WHERE plan_id = ? AND country_code = ?`,
        [planId, countryCode.toUpperCase()],
    );
    if (!row) return null;
    return {
        planId:   row.plan_id,
        country:  row.country_code,
        currency: row.currency,
        price:    parseFloat(row.price),
        label:    row.label,
        gateway:  row.gateway,
    };
}

/**
 * Resolve o gateway/moeda/preço para um plano + país. Esta é a ÚNICA função
 * que deve decidir "MZ → zumbopay, resto → hotmart" — usada pelas rotas
 * /api/plans, /api/payments/gateway e pelas validações do endpoint de
 * cobrança ZumboPay. Não duplicar esta decisão noutro sítio (requisito
 * "backend como autoridade" — secção 22 do pedido).
 */
export async function resolveGatewayAndPrice(planId, countryCode, defaultPlan) {
    const country = (countryCode || '').toUpperCase();

    if (country === 'MZ') {
        const override = await getPlanPriceOverride(planId, 'MZ');
        if (override) {
            return {
                gateway: 'zumbopay',
                country: 'MZ',
                currency: override.currency,
                amount: override.price,
                label: override.label,
            };
        }
        // Override em falta (tabela vazia/erro) — não inventa preço; cai no
        // default global mas ainda assim marca o gateway como hotmart, para
        // nunca cobrar um utilizador MZ com um preço que não foi confirmado.
        console.error('[plan-pricing] override MZ em falta para plano', planId, '— a usar Hotmart como salvaguarda');
    }

    return {
        gateway: 'hotmart',
        country: country || null,
        currency: defaultPlan?.currency || 'USD',
        amount: defaultPlan?.price ?? null,
        label: defaultPlan?.label || null,
    };
}
