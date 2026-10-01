// routes/zumbopay.js — Integração ZumboPay (MZ) — aditiva, isolada da Hotmart
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints:
//   GET  /api/payments/gateway?plan=<id>         — resolve gateway/preço p/ o país actual (público)
//   POST /api/payments/zumbopay/charge           — inicia cobrança (autenticado)
//   GET  /api/payments/zumbopay/status/:id       — estado da transação interna (autenticado)
//   POST /api/webhooks/zumbopay                  — confirmação oficial (público, validado por HMAC)
//
// REGRA ABSOLUTA (secção 22 do pedido): o backend é a única autoridade sobre
// país/gateway/preço/moeda. O frontend nunca envia amount/currency/gateway —
// só o plan_id e (para STK) o msisdn ou (para cartão) method:'card'.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { PLANS }         from '../lib/edgeone.js';
import { getEnv }        from '../lib/env.js';
import { getCountry }    from '../lib/geo-country.js';
import { resolveGatewayAndPrice } from '../lib/plan-pricing.js';
import { createCharge, createHostedPayment, walletIdFor } from '../lib/zumbopay-client.js';
import {
    createPendingTransaction, attachReference, getTransactionById,
    getTransactionByReference, updateTransactionStatus,
    hasProcessedEvent, markEventProcessed,
} from '../lib/zumbopay-transactions.js';

function planDurationDays(planId) {
    return PLANS[planId]?.duration_days || 30;
}

// ── Normalização do número (correcção duplicação 258/+258) ─────────────────
// O ZumboPay só aceita o formato 258XXXXXXXXX (sem "+"). O utilizador pode
// escrever o número de várias formas — só o local (844322435), com "+258"
// à frente, ou já com "258" — e a lógica anterior só descascava o prefixo
// UMA vez: se o utilizador escrevesse ele próprio "258" ou "+258" à frente
// de um número que, por algum motivo (copy/paste, campo pré-preenchido),
// já viesse com o indicativo, o resultado ficava duplicado
// (258258844322435), que o ZumboPay rejeita. `localMsisdn` descasca TODOS
// os "258" a mais até sobrar só o número local de 9 dígitos, e só depois é
// que se recoloca um único "258" à frente — nunca há duplicação,
// independentemente de o utilizador escrever 844322435, 258844322435 ou
// +258844322435.
function localMsisdn(msisdnRaw) {
    let digits = String(msisdnRaw || '').replace(/\D/g, ''); // remove "+", espaços, traços, parênteses…
    while (digits.length > 9 && digits.startsWith('258')) {
        digits = digits.slice(3);
    }
    return digits;
}

function normalizeMsisdn(msisdnRaw) {
    return `258${localMsisdn(msisdnRaw)}`;
}

// Formato final exacto aceite (258 + 9 dígitos locais, 84/85 M-Pesa ou 86/87
// e-Mola) — validado ANTES de chamar o ZumboPay, para devolver um erro claro
// em vez de deixar a API deles rejeitar com uma mensagem genérica.
function isValidMzMsisdn(normalized) {
    return /^258(8[4-7]\d{7})$/.test(normalized);
}

// M-Pesa: 84/85 · e-Mola: 86/87 (prefixos documentados). Aceita com ou sem
// código de país (258), incluindo variantes com "+" ou "258" duplicado (ver
// localMsisdn acima). Não infere nenhum outro operador — se não bater
// nestes prefixos, devolve null e a rota rejeita com erro claro.
function channelFromMsisdn(msisdnRaw) {
    const local = localMsisdn(msisdnRaw);
    if (/^8[45]\d{7}$/.test(local)) return 'mpesa';
    if (/^8[67]\d{7}$/.test(local)) return 'emola';
    return null;
}

// ── Verificação HMAC do webhook (exactamente como documentado) ─────────────
function verifySignature(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    try {
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const a = Buffer.from(signature, 'hex');
        const b = Buffer.from(expected, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// ── Extração do corpo do webhook ────────────────────────────────────────────
// Forma CONFIRMADA por teste real (evt_plzerm1wad, 15/set/2026):
//   { id: "evt_...", type: "payment.succeeded", created_at, merchant_id,
//     data: { payment_id, reference, amount, currency, channel, status } }
// Mantemos ainda alguns fallbacks (payment/charge aninhados) para o caso de
// outros tipos de evento (ex.: payout.*) virem numa forma ligeiramente
// diferente — nunca testados ainda, por isso não removidos por precaução.
function extractEventInfo(body) {
    const d = body?.data ?? body ?? {};
    const eventId   = body?.id ?? null; // identificador único do evento — confirmado real
    const eventName = body?.type ?? body?.event ?? d?.event ?? null;
    const reference =
        d?.reference ?? d?.payment?.reference ?? d?.charge?.reference ?? body?.reference ?? null;
    const status =
        d?.status ?? d?.payment?.status ?? d?.charge?.status ?? null;
    return { eventId, eventName, reference, status, raw: body };
}

function eventKeyFor({ eventId, eventName, reference }, rawBody) {
    // Prioridade 1: o `id` do próprio evento (confirmado real, único por
    // entrega) — é a chave de idempotência correta, mais forte que compor
    // nome+reference (dois eventos distintos podiam legitimamente partilhar
    // o mesmo par eventName+reference, ex. duas subscrições cobradas no
    // mesmo dia com o mesmo reference reutilizado).
    if (eventId) return `id:${eventId}`;
    if (eventName && reference) return `${eventName}:${reference}`;
    return `raw:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
}

const SUCCESS_STATUSES = ['success', 'succeeded', 'completed', 'paid', 'active'];
const FAILED_STATUSES  = ['failed', 'declined', 'psp_declined', 'cancelled', 'canceled'];

export default function (app) {

    // ── GET /api/payments/gateway — resolução pública (mostra preço certo
    //     na página de planos ANTES de o utilizador estar autenticado) ──────
    app.get('/api/payments/gateway', async (req, res) => {
        try {
            const planId = req.query.plan;
            if (!planId || !PLANS[planId] || planId === 'free') {
                return res.status(400).json({ error: 'Bad Request', message: 'plan inválido' });
            }
            const country  = getCountry(req);
            const resolved = await resolveGatewayAndPrice(planId, country, PLANS[planId]);
            res.json({ plan_id: planId, ...resolved });
        } catch (err) {
            console.error('[payments/gateway]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── POST /api/payments/zumbopay/charge — inicia STK (mpesa/emola) ou
    //     checkout hospedado embutido em iframe (cartão) ─────────────────────
    app.post('/api/payments/zumbopay/charge', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const { plan: planId, msisdn, method: methodInput, returnTo, sourcePlatform } = req.body || {};

            if (!planId || !PLANS[planId] || planId === 'free') {
                return res.status(400).json({ error: 'Bad Request', message: 'plan inválido' });
            }

            // Backend é a autoridade: nunca aceita amount/currency/gateway do
            // frontend (teste 12/13/14 do pedido). Recalcula tudo aqui.
            const country = getCountry(req);
            if (country !== 'MZ') {
                return res.status(403).json({ error: 'Forbidden', message: 'gateway_not_eligible', detail: 'ZumboPay só está disponível para Moçambique — usa o fluxo Hotmart existente.' });
            }
            const resolved = await resolveGatewayAndPrice(planId, country, PLANS[planId]);
            if (resolved.gateway !== 'zumbopay') {
                return res.status(403).json({ error: 'Forbidden', message: 'gateway_not_eligible' });
            }

            let method = methodInput;
            if (!method) {
                if (msisdn) method = channelFromMsisdn(msisdn);
                else return res.status(400).json({ error: 'Bad Request', message: 'Indica msisdn (M-Pesa/e-Mola) ou method:"card"' });
            }
            if (!['mpesa', 'emola', 'card'].includes(method)) {
                return res.status(400).json({ error: 'Bad Request', message: 'method/msisdn não reconhecido — só M-Pesa (84/85), e-Mola (86/87) ou cartão' });
            }

            // Normaliza e valida o número ANTES de gastar uma transação
            // pendente ou chamar o ZumboPay — o utilizador pode ter escrito
            // +258/258 à frente por conta própria (ver normalizeMsisdn).
            let normalizedMsisdn = null;
            if (method !== 'card') {
                normalizedMsisdn = normalizeMsisdn(msisdn);
                if (!isValidMzMsisdn(normalizedMsisdn)) {
                    return res.status(400).json({ error: 'Bad Request', message: 'Número inválido — usa um número M-Pesa (84 ou 85) ou e-Mola (86 ou 87) com 9 dígitos, com ou sem +258.' });
                }
            }

            const walletId = walletIdFor(method);
            if (!walletId) {
                console.error(`[zumbopay/charge] wallet não configurada para method=${method}`);
                return res.status(500).json({ error: 'Internal Server Error', message: 'Método de pagamento não configurado' });
            }

            const txId = await createPendingTransaction({
                userId: req.user.id, planId, country, currency: resolved.currency, amount: resolved.amount,
                method, walletId, sourcePlatform: sourcePlatform || null, returnTo: returnTo || null,
                rawRequest: { plan: planId, method, msisdn: normalizedMsisdn },
            });

            if (method === 'card') {
                // Cartão: SEM alternativa de tokenização documentada — só o
                // checkout hospedado. Não redirecionamos a página inteira:
                // o frontend carrega checkout_url dentro de um <iframe>
                // (ver app/checkout — evita "sair" do Pixgo, mantendo a
                // regra "sem redirect para site externo" no sentido em que
                // a doc realmente permite).
                const result = await createHostedPayment({
                    title: PLANS[planId].name,
                    amount: resolved.amount,
                    currency: resolved.currency,
                    channels: ['card'],
                    walletId,
                    description: `Pixgo — plano ${PLANS[planId].name} (MZ)`,
                    sourceId: txId,
                });
                if (!result.ok) {
                    await updateTransactionStatus(txId, 'failed');
                    return res.status(result.status || 502).json({ error: 'ZumboPay Error', message: result.error?.message || 'Falha ao criar checkout' });
                }
                await attachReference(txId, {
                    reference: result.data?.reference, checkoutUrl: result.data?.checkout_url,
                    rawResponse: result.data, status: 'pending',
                });
                return res.status(201).json({
                    transaction_id: txId, status: 'pending', method: 'card',
                    checkout_url: result.data?.checkout_url, reference: result.data?.reference,
                });
            }

            // M-Pesa / e-Mola — STK push directo, sem redirect nenhum.
            const result = await createCharge({
                walletId, amount: resolved.amount, msisdn: normalizedMsisdn,
                customerName: req.user.username, sourceId: txId,
            });
            if (!result.ok) {
                await updateTransactionStatus(txId, 'failed');
                return res.status(result.status || 402).json({ error: 'ZumboPay Error', message: result.error?.message || 'Pagamento recusado' });
            }

            const stkStatus = result.data?.status === 'success' ? 'success' : 'pending';
            await attachReference(txId, {
                reference: result.data?.reference, rawResponse: result.data, status: stkStatus,
            });

            // NOTA: "success" síncrono aqui é só o retorno do POST /charges —
            // a activação de facto da assinatura acontece SEMPRE via webhook
            // (payment.succeeded), nunca por esta resposta directa, para
            // cumprir "nenhum callback do frontend confirma pagamento".
            res.status(202).json({
                transaction_id: txId, status: stkStatus, method,
                reference: result.data?.reference,
            });
        } catch (err) {
            console.error('[zumbopay/charge]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── GET /api/payments/zumbopay/status/:id — polling do NOSSO backend
    //     (não existe endpoint de status de /charges na doc do ZumboPay;
    //     o estado real só muda quando o webhook o actualizar) ─────────────
    app.get('/api/payments/zumbopay/status/:id', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const tx = await getTransactionById(req.params.id);
            if (!tx || tx.userId !== req.user.id) return res.status(404).json({ error: 'Not Found' });
            res.json({ transaction_id: tx.id, status: tx.status, plan_id: tx.planId, reference: tx.reference, checkout_url: tx.checkoutUrl });
        } catch (err) {
            console.error('[zumbopay/status]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── POST /api/webhooks/zumbopay — confirmação oficial ───────────────────
    app.post('/api/webhooks/zumbopay', async (req, res) => {
        try {
            // req.body já vem parseado pelo express.json() global — para a
            // verificação HMAC precisamos do corpo BRUTO exactamente como
            // chegou. Ver nota de configuração no README da integração:
            // é preciso capturar rawBody (express.json({ verify }) ) para
            // este endpoint funcionar correctamente em produção.
            const rawBody   = req.rawBody || JSON.stringify(req.body || {});
            // A doc escrita diz `x-zumbopay-signature`, mas o botão "testar"
            // do próprio painel ZumboPay envia `X-Zumbo-Signature` (confirmado
            // por teste real, 15/set/2026 — vários eventos, sempre este nome).
            // Aceitamos os dois para não voltar a partir se isto mudar de novo.
            const signature = req.headers['x-zumbopay-signature'] || req.headers['x-zumbo-signature'];
            const secret    = getEnv('ZUMBOPAY_WEBHOOK_SECRET');

            if (!verifySignature(rawBody, signature, secret)) {
                console.warn('[webhooks/zumbopay] assinatura inválida — rejeitado');
                return res.status(403).json({ error: 'Forbidden', message: 'invalid_signature' });
            }

            const info     = extractEventInfo(req.body);
            const eventKey = eventKeyFor(info, rawBody);

            // Camada extra (não exigida pela doc, mas o campo existe e é
            // grátis verificar): rejeita se o merchant_id do payload não
            // bater com o configurado — protege contra reaproveitamento de
            // endpoint/secret entre contas, caso alguma vez venha a haver
            // mais que uma conta ZumboPay no mesmo projecto.
            const expectedMerchantId = getEnv('ZUMBOPAY_MERCHANT_ID');
            if (req.body?.merchant_id && expectedMerchantId && req.body.merchant_id !== expectedMerchantId) {
                console.warn(`[webhooks/zumbopay] merchant_id inesperado: ${req.body.merchant_id}`);
                return res.status(403).json({ error: 'Forbidden', message: 'merchant_id_mismatch' });
            }

            if (await hasProcessedEvent(eventKey)) {
                console.log(`[webhooks/zumbopay] evento duplicado ignorado: ${eventKey}`);
                return res.json({ ok: true, duplicate: true });
            }

            if (!info.reference) {
                console.warn('[webhooks/zumbopay] payload sem reference reconhecível — a rever contra doc real:', JSON.stringify(req.body).slice(0, 500));
                await markEventProcessed(eventKey, { eventName: info.eventName, reference: null, rawPayload: req.body });
                return res.status(200).json({ ok: true, warning: 'reference_not_found' });
            }

            const tx = await getTransactionByReference(info.reference);
            if (!tx) {
                console.warn(`[webhooks/zumbopay] transação não encontrada para reference=${info.reference}`);
                await markEventProcessed(eventKey, { eventName: info.eventName, reference: info.reference, rawPayload: req.body });
                return res.status(200).json({ ok: true, warning: 'transaction_not_found' });
            }

            const status = (info.status || '').toLowerCase();
            const eventName = (info.eventName || '').toLowerCase();

            const isSuccess = eventName.includes('succeeded') || SUCCESS_STATUSES.includes(status);
            const isFailed  = eventName.includes('failed') || eventName.includes('refunded') || FAILED_STATUSES.includes(status);

            if (isSuccess) {
                if (tx.status === 'active') {
                    console.log(`[webhooks/zumbopay] tx=${tx.id} já activa — ignorado (idempotente)`);
                } else {
                    await app.edgeone.activateSubscriptionFromZumbopay(tx.userId, {
                        planId: tx.planId, zumbopayReference: tx.reference, durationDays: planDurationDays(tx.planId),
                    });
                    await updateTransactionStatus(tx.id, 'active');
                    console.log(`[webhooks/zumbopay] activado plan=${tx.planId} tx=${tx.id} reference=${tx.reference}`);
                }
            } else if (isFailed) {
                await updateTransactionStatus(tx.id, 'failed');
                console.log(`[webhooks/zumbopay] falhado tx=${tx.id} reference=${tx.reference} event=${info.eventName}`);
            } else {
                console.log(`[webhooks/zumbopay] evento informativo/não mapeado: ${info.eventName} status=${info.status} tx=${tx.id} — sem alteração de acesso`);
            }

            await markEventProcessed(eventKey, { eventName: info.eventName, reference: info.reference, rawPayload: req.body });
            res.json({ ok: true });
        } catch (err) {
            console.error('[webhooks/zumbopay]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
