// lib/zumbopay-client.js — Cliente da API pública do ZumboPay
// ─────────────────────────────────────────────────────────────────────────────
// Usa EXCLUSIVAMENTE os endpoints/parâmetros/headers documentados. Nada
// inventado. Base URL única — sandbox/produção distinguem-se só pelo prefixo
// da API key (zk_test_ vs zk_live_), a doc NÃO documenta uma base URL de
// sandbox separada, por isso não existe aqui nenhuma variável tipo
// ZUMBOPAY_SANDBOX_URL.
//
// Credenciais exclusivamente via env (nunca hardcoded, nunca no frontend):
//   ZUMBOPAY_API_KEY          — zk_live_… ou zk_test_…
//   ZUMBOPAY_MERCHANT_ID      — MCH_XXXXXXXXXX
//   ZUMBOPAY_WALLET_MPESA     — UUID da carteira M-Pesa
//   ZUMBOPAY_WALLET_EMOLA     — UUID da carteira e-Mola
//   ZUMBOPAY_WALLET_CARD      — UUID da carteira Cartão
//   ZUMBOPAY_WEBHOOK_SECRET   — usado só em routes/zumbopay.js p/ validar HMAC
// ─────────────────────────────────────────────────────────────────────────────

import { getEnv } from './env.js';

const BASE_URL = 'https://zumbopay.com/api/public/v1';

function apiKey()     { const v = getEnv('ZUMBOPAY_API_KEY');     if (!v) throw new Error('ZUMBOPAY_API_KEY não configurada'); return v; }
function merchantId() { return getEnv('ZUMBOPAY_MERCHANT_ID', ''); }

export function walletIdFor(method) {
    const map = {
        mpesa: getEnv('ZUMBOPAY_WALLET_MPESA'),
        emola: getEnv('ZUMBOPAY_WALLET_EMOLA'),
        card:  getEnv('ZUMBOPAY_WALLET_CARD'),
    };
    return map[method] || null;
}

async function zumboFetch(path, { method = 'GET', body, idempotencyKey } = {}) {
    const headers = {
        'Authorization': `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
    };
    if (merchantId()) headers['X-Merchant-Id'] = merchantId();
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try { json = await response.json(); } catch { /* corpo vazio/não-JSON */ }

    return { status: response.status, ok: response.ok, data: json?.data ?? null, error: json?.error ?? null };
}

/** POST /charges — STK push directo (M-Pesa 84/85, e-Mola 86/87). Sem
 *  redirecionamento — o cliente recebe o PIN no telemóvel. */
export async function createCharge({ walletId, amount, msisdn, customerName, sourceId }) {
    return zumboFetch('/charges', {
        method: 'POST',
        idempotencyKey: sourceId,
        body: {
            wallet_id: walletId,
            amount,
            msisdn,
            customer_name: customerName,
            source_id: sourceId,
        },
    });
}

/** POST /payments — checkout hospedado (obrigatório para cartão). Devolve
 *  checkout_url — o Pixgo carrega esse URL num <iframe> dentro da própria
 *  página (nunca faz window.location = checkout_url), para não enviar o
 *  utilizador para fora da experiência do Pixgo. A doc não documenta
 *  nenhuma API de tokenização de cartão própria — isto é o único mecanismo
 *  documentado para Visa/Mastercard + 3DS (iframe MPGS embutido na página
 *  do checkout_url). */
export async function createHostedPayment({ title, amount, currency, channels, walletId, description, sourceId }) {
    return zumboFetch('/payments', {
        method: 'POST',
        idempotencyKey: sourceId,
        body: {
            title,
            amount,
            currency,
            channels,
            wallet_id: walletId,
            description,
        },
    });
}

/** GET /payments/:reference — consulta directa ao ZumboPay (não usado para
 *  polling de STK, que não tem endpoint de status documentado — só serve
 *  para reconciliar pagamentos hospedados, se algum dia for preciso). */
export async function getHostedPayment(reference) {
    return zumboFetch(`/payments/${encodeURIComponent(reference)}`);
}

/** GET /merchant/validate — diagnóstico (usar antes de ir para produção). */
export async function validateMerchant() {
    return zumboFetch('/merchant/validate');
}
