// routes/plans.js — Core genérico multi-plataforma
// ─────────────────────────────────────────────────────────────────────────────
// Substitui por completo o antigo routes/payments.js (USDT/TRC20/Polygon).
// Este backend NÃO gera endereço de pagamento nem QR code — o checkout é
// feito inteiramente pela Hotmart, numa página dedicada do frontend
// (/main/plans/checkout) que lê o link de checkout do PRÓPRIO env da
// plataforma (NEXT_PUBLIC_HOTMART_CHECKOUT_MONTHLY / _ANNUAL).
//
// Este ficheiro só:
//   1. Expõe GET /api/plans — metadata dos planos + estado actual do user
//   2. Recebe o postback da Hotmart (POST /api/webhooks/hotmart) e activa
//      a assinatura do utilizador correspondente
//
// CONFIGURAÇÃO NECESSÁRIA (env do backend, por deploy — o backend é único,
// mas cada produto Hotmart pode ter o seu próprio mapeamento):
//   HOTMART_HOTTOK        — token secreto enviado pela Hotmart no payload
//                            (Configurações → Webhook → Hottok), usado para
//                            validar a autenticidade do postback.
//   HOTMART_PLAN_MAP       — JSON: { "<offer_code>": "monthly" | "annual" }
//                            mapeia o código da oferta Hotmart para o plano
//                            interno. Um único backend serve várias ofertas
//                            (uma por plataforma), todas mapeadas aqui.
// ─────────────────────────────────────────────────────────────────────────────

import { PLANS } from '../lib/edgeone.js';
import { getEnv, getEnvInt } from '../lib/env.js';
import { getCountry } from '../lib/geo-country.js';
import { resolveGatewayAndPrice } from '../lib/plan-pricing.js';

function hotmartPlanMap() {
    try { return JSON.parse(getEnv('HOTMART_PLAN_MAP', '{}')); }
    catch { return {}; }
}

// Chave de rastreamento "plan" (monthly/quarterly/annual) configurada em
// cada oferta na Hotmart — mais fiável do que mapear offer.code, porque o
// valor já vem exactamente igual ao id interno, sem precisar de mapeamento.
//
// CONFIRMADO pela doc oficial da Hotmart (Eventos de pedidos, v2.0.0):
// as "chaves de rastreamento" são o campo `purchase.offer.metadata` —
// "Objeto contendo pares chave-valor de metadados customizados configurados
// na oferta [...] com no máximo 10 entries por oferta" — bate certo com o
// limite "1 de 10 chaves" que aparece no painel da Hotmart. Mantidos os
// caminhos antigos como fallback só por segurança (nunca deviam ser
// necessários agora que o campo real está confirmado).
function readPlanTrackingKey(data) {
    return (
        data?.purchase?.offer?.metadata?.plan ??
        data?.purchase?.tracking?.plan ??
        data?.tracking?.plan ??
        null
    );
}

function planDurationDays(planId) {
    return PLANS[planId]?.duration_days || 30;
}

export default function (app) {

    // ── GET /api/plans — lista de planos + estado do utilizador actual ─────
    app.get('/api/plans', async (req, res) => {
        // FIX (preço em R$ para utilizadores de MZ): esta rota devolvia sempre
        // o preço base (env/BRL), mesmo para IPs de Moçambique — só o checkout
        // (routes/zumbopay.js, GET /api/payments/gateway) resolvia o país.
        // Agora reutiliza a MESMA função única do checkout
        // (resolveGatewayAndPrice + getCountry) sem duplicar a decisão
        // MZ -> zumbopay. Só os planos pagos de MZ são alterados (price,
        // currency, price_label, gateway, country); fora de MZ, ou se o
        // override faltar/falhar, o plano segue EXACTAMENTE como antes
        // (sem campo currency; o frontend mantém o símbolo por omissão).
        let plans = Object.values(PLANS);
        try {
            const country = getCountry(req);
            if (country === 'MZ') {
                plans = await Promise.all(plans.map(async (p) => {
                    if (p.is_free || p.id === 'free') return p;
                    const r = await resolveGatewayAndPrice(p.id, country, p);
                    if (r.gateway !== 'zumbopay') return p;
                    return { ...p, price: r.amount, currency: r.currency, price_label: r.label, gateway: r.gateway, country: r.country };
                }));
                // Plano grátis: preço continua 0, mas a MOEDA acompanha a dos
                // pagos (senão o cartão "Grátis" mostrava R$0 ao lado de
                // "140 MZN/mês" — só cosmético, mas incoerente).
                const mzCurrency = plans.find(p => p.currency)?.currency;
                if (mzCurrency) {
                    plans = plans.map(p => (p.is_free || p.id === 'free') ? { ...p, currency: mzCurrency } : p);
                }
            }
        } catch (err) {
            console.error('[plans] resolução de preço por país falhou (usa preço base):', err.message);
            plans = Object.values(PLANS);
        }
        if (!req.user) return res.json({ plans, current: null });

        const plan = await app.edgeone.getUserPlan(req.user.username);
        res.json({ plans, current: plan });
    });

    // ── GET /api/plans/status — estado detalhado da assinatura ─────────────
    app.get('/api/plans/status', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const plan = await app.edgeone.getUserPlan(req.user.username);
        const sub  = await app.edgeone.getSubscription(req.user.id);
        res.json({ plan, subscription: sub || null });
    });

    // ── POST /api/plans/cancel — cancela a renovação (a Hotmart trata do
    //     estorno/cancelamento real; aqui só reflectimos o estado) ──────────
    app.post('/api/plans/cancel', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const sub = await app.edgeone.cancelSubscription(req.user.username);
        res.json({ ok: true, subscription: sub });
    });

    // ── POST /api/webhooks/hotmart — postback de compra/renovação/cancelamento ─
    app.post('/api/webhooks/hotmart', async (req, res) => {
        try {
            const hottok = req.body?.hottok || req.headers['x-hotmart-hottok'];
            const expected = getEnv('HOTMART_HOTTOK');
            if (!expected || hottok !== expected) {
                return res.status(403).json({ error: 'Forbidden', message: 'Invalid hottok' });
            }

            const event = req.body?.event || '';
            const data  = req.body?.data || {};
            const email = data?.buyer?.email;
            const offerCode = data?.purchase?.offer?.code || data?.subscription?.plan?.name;

            if (!email) return res.status(400).json({ error: 'Bad Request', message: 'Missing buyer email' });

            const user = await app.edgeone.getUserByEmail(email);
            if (!user) {
                // Utilizador ainda não criou conta na plataforma — regista o
                // pagamento pendente não é necessário aqui: a Hotmart reenvia
                // o webhook em caso de falha, e o utilizador normalmente já
                // se regista antes de comprar (mesmo e-mail).
                console.warn(`[hotmart] user not found for email ${email}`);
                return res.status(200).json({ ok: true, warning: 'user_not_found' });
            }

            // Eventos que CONCEDEM/ESTENDEM acesso — inequívocos (pagamento
            // já confirmado, ou troca de plano de uma assinatura já activa).
            const ACTIVATE_EVENTS = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SUBSCRIPTION_REACTIVATED', 'SWITCH_PLAN'];

            // Eventos que REVOGAM acesso — também inequívocos (cancelamento,
            // reembolso ou chargeback confirmados).
            const CANCEL_EVENTS = ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'SUBSCRIPTION_CANCELLATION'];

            // Eventos PENDENTES/informativos — não mexem no acesso (nem
            // concedem nem revogam). Nomes CONFIRMADOS pela doc oficial da
            // Hotmart (Eventos de pedidos v2.0.0): PURCHASE_BILLET_PRINTED
            // ("Aguardando pagamento" — boleto/Pix gerado), PURCHASE_DELAYED
            // ("Compra atrasada"/em análise), PURCHASE_PROTEST ("Pedido de
            // reembolso"/disputa aberta), PURCHASE_EXPIRED ("Compra
            // expirada"). UPDATE_SUBSCRIPTION_CHARGE_DATE é da família de
            // eventos de assinatura (não documentada nesta página, mas
            // nome bem estabelecido). Nenhum destes deve derrubar uma
            // assinatura activa de um ciclo anterior só porque uma
            // tentativa de renovação falhou ou ainda está em análise — só
            // regista, para auditoria.
            const PENDING_EVENTS = ['PURCHASE_BILLET_PRINTED', 'PURCHASE_DELAYED', 'PURCHASE_PROTEST', 'PURCHASE_EXPIRED', 'UPDATE_SUBSCRIPTION_CHARGE_DATE'];

            if (ACTIVATE_EVENTS.includes(event)) {
                const trackedPlan = readPlanTrackingKey(data);
                const map    = hotmartPlanMap();
                const planId = trackedPlan || map[offerCode] || 'monthly';
                if (!trackedPlan) {
                    // Sinal de que a chave de rastreamento não chegou onde
                    // esperávamos — não bloqueia (cai no fallback), mas vale
                    // a pena conferir isto no log depois do 1º teste real.
                    console.warn(`[hotmart] tracking key 'plan' não encontrada no payload — usando fallback (offer.code='${offerCode}' → '${planId}'). Payload data.purchase: ${JSON.stringify(data?.purchase ?? {}).slice(0, 500)}`);
                }
                await app.edgeone.activateSubscriptionFromHotmart(user.username, {
                    planId,
                    hotmartTransactionId: data?.purchase?.transaction || data?.subscription?.subscriber?.code || '',
                    durationDays: planDurationDays(planId),
                });
                console.log(`[hotmart] activated plan=${planId} user=${user.username} event=${event}`);
            } else if (CANCEL_EVENTS.includes(event)) {
                await app.edgeone.cancelSubscription(user.username);
                console.log(`[hotmart] cancelled user=${user.username} event=${event}`);
            } else if (PENDING_EVENTS.includes(event)) {
                console.log(`[hotmart] pending/info event=${event} user=${user.username} — sem alteração de acesso`);
            } else {
                // Evento seleccionado no painel mas ainda não mapeado aqui —
                // não deve acontecer com os eventos activados, mas se o nome
                // real vier diferente do que assumimos acima, aparece aqui.
                console.warn(`[hotmart] evento desconhecido/não tratado: "${event}" user=${user.username} — nada foi alterado`);
            }

            res.json({ ok: true });
        } catch (err) {
            console.error('[webhooks/hotmart]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
