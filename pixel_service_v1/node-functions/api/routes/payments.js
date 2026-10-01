// routes/payments.js — StreamPlatform (EdgeOne)
// ─────────────────────────────────────────────────────────────────────────────
// v3.0 — LIMPEZA DE CRIPTO ÓRFÃ (Polygon/USDT removido, só Hotmart).
//
// A assinatura real (cartão/Pix/boleto) é criada no hub central
// (app.pixgo.qzz.io, backend api-core) via webhook Hotmart, que escreve
// directamente nas tabelas `users`/`subscription` do MESMO Turso partilhado.
// Esta API (pixgo/api.rar) já não cria nem verifica pagamentos — só LÊ o que
// já lá está. Por isso todo o fluxo antigo de derivação de carteira HD,
// verificação on-chain via microservice AlwaysData (POLYGON_SERVICE_URL) e
// conversão USDT/BRL foi removido (rotas /convert, /create, /status/:id,
// /scan e os helpers que só existiam para as suportar). Nada disto era
// chamado por nenhum frontend actual — o frontend_web já redirecciona
// "Assinar" para app.pixgo.qzz.io desde a migração para Hotmart.
//
// O que fica: /plans (lista com preço real BRL, vindo de lib/edgeone.js
// PLANS), /subscription (estado actual), /history (histórico, generalizado
// sem campos usdt/network), /cancel (auto_renew=false no registo local).
// ─────────────────────────────────────────────────────────────────────────────

import { authenticate }        from '../middleware/auth.js';
import { extractGeoData }      from '../lib/geo-log.js';
import { getPlanPriceOverride } from '../lib/plan-pricing-read.js';

function isProd() {
    return process.env.NODE_ENV === 'production';
}

function log(level, section, msg, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, section: `payments/${section}`, msg, ...(isProd() && level === 'info' ? {} : meta) };
    if (level === 'error') console.error(JSON.stringify(entry));
    else if (!isProd()) console.log(JSON.stringify(entry));
}

export default function (app) {

    // GET /api/payments/plans — usado pelo frontend_web na página de planos.
    // Preço/features vêm todos do PLANS já limpo (sem USDT/Polygon/Tron).
    // PLANS internamente tem 'premium'/'premium_quarterly'/'premium_annual'
    // DUPLICADOS de 'monthly'/'quarterly'/'annual' (mesmo conteúdo, id
    // diferente) — mantidos só para compatibilidade com plan_id antigos já
    // gravados na tabela users; a resposta pública só expõe os 4 ids
    // "canónicos" que o utilizador reconhece.
    const PUBLIC_PLAN_IDS = ['free', 'monthly', 'quarterly', 'annual'];
    app.get('/api/payments/plans', async (req, res) => {
        // Preço herdado do api-core (fonte única, tabela `plan_prices`) — se
        // não houver override para o país do pedido (ex.: fora de MZ, ou
        // falha de leitura), mantém-se o PLANS hardcoded actual sem alteração.
        const country = extractGeoData(req).geo?.countryCodeAlpha2 || null;
        const plans = await Promise.all(PUBLIC_PLAN_IDS.map(async id => {
            const base = app.edgeone.PLANS[id];
            if (id === 'free' || !country) return base;
            const override = await getPlanPriceOverride(id, country);
            if (!override) return base;
            return { ...base, price: override.price, currency: override.currency, label: override.label, gateway: override.gateway };
        }));
        res.json(plans);
    });

    // GET /api/payments/subscription
    app.get('/api/payments/subscription', authenticate, async (req, res) => {
        try {
            const subscription = await app.edgeone.getSubscription(req.user.id);
            // BUG REAL corrigido aqui: lia subscription.end_date, mas a coluna
            // real na tabela `subscription` é `expires_at` (setSubscription já
            // grava correctamente nela — só a leitura aqui estava errada).
            // Resultado antigo: esta rota devolvia sempre {status:'free'} até
            // para assinantes Hotmart activos, porque new Date(undefined)
            // nunca é > nem <= que new Date() (NaN em qualquer comparação).
            if (subscription?.status === 'active' && new Date(subscription.expires_at) <= new Date()) {
                subscription.status = 'expired';
                subscription.expired_at = new Date().toISOString();
                await Promise.all([
                    app.edgeone.setSubscription(req.user.id, subscription),
                    app.edgeone.updateUserPlan(req.user.username, 'free'),
                ]);
            }
            const isActive = subscription?.status === 'active' && new Date(subscription.expires_at) > new Date();
            if (!isActive) return res.json({ status: 'free', plan: app.edgeone.PLANS.free, is_active: false });

            const country  = extractGeoData(req).geo?.countryCodeAlpha2 || null;
            const basePlan = app.edgeone.PLANS[subscription.plan_id] || app.edgeone.PLANS.premium;
            const override = country ? await getPlanPriceOverride(subscription.plan_id, country) : null;
            const plan     = override ? { ...basePlan, price: override.price, currency: override.currency, label: override.label } : basePlan;

            res.json({
                ...subscription,
                plan,
                is_active:  true,
                days_left:  Math.max(0, Math.ceil((new Date(subscription.expires_at) - new Date()) / 86_400_000)),
            });
        } catch (err) {
            log('error', 'subscription', err.message, { userId: req.user?.id });
            res.status(500).json({ error: 'Internal Server Error', message: 'Falha ao obter subscrição' });
        }
    });

    // GET /api/payments/history — CORRIGIDO: a versão anterior lia registos de
    // um audit trail em KV ('users', payment_audit_*/payment_*) que só o
    // fluxo cripto antigo escrevia — o Hotmart nunca escreveu ali, por isso
    // esta rota devolvia sempre uma lista vazia para qualquer assinante real.
    // Agora lê directamente da tabela `subscription` (Turso), a mesma que o
    // webhook Hotmart em api-core já popula.
    app.get('/api/payments/history', authenticate, async (req, res) => {
        try {
            const rows = await app.edgeone.getSubscriptionHistory(req.user.id);
            const payments = rows.map(r => ({
                id:             r.id,
                plan_id:        r.plan_id,
                plan_name:      (app.edgeone.PLANS[r.plan_id] || app.edgeone.PLANS.premium).name,
                payment_method: r.network === 'hotmart' ? 'Hotmart' : (r.network || 'Hotmart'),
                status:         r.status,
                started_at:     r.started_at,
                expires_at:     r.expires_at,
                created_at:     r.created_at,
            }));
            res.json({ payments, total: payments.length });
        } catch (err) {
            log('error', 'history', err.message, { userId: req.user?.id });
            res.status(500).json({ error: 'Internal Server Error', message: 'Falha ao obter histórico' });
        }
    });

    // POST /api/payments/cancel
    // NOTA: só desliga auto_renew no registo local — não cancela a
    // assinatura na Hotmart em si (isso é gerido pela própria Hotmart /
    // webhook em api-core). Ver pedido do user para a próxima rodada:
    // "verificar se as condições de assinaturas estão funcionais" — este
    // ponto entra nessa verificação, não foi alterado agora.
    app.post('/api/payments/cancel', authenticate, async (req, res) => {
        try {
            const subscription = await app.edgeone.getSubscription(req.user.id);
            if (!subscription || subscription.status !== 'active') {
                return res.status(404).json({ error: 'Not Found', message: 'Nenhuma subscrição activa' });
            }
            // BUG REAL corrigido aqui também: end_date→expires_at (mesma causa).
            if (new Date(subscription.expires_at) <= new Date()) {
                return res.status(400).json({ error: 'Already Expired', message: 'Subscrição já expirou' });
            }
            subscription.auto_renew  = false;
            subscription.canceled_at = new Date().toISOString();
            await app.edgeone.setSubscription(req.user.id, subscription);
            res.json({
                success:   true,
                message:   `Acesso activo até ${subscription.expires_at}`,
                expires_at: subscription.expires_at,
                days_left: Math.max(0, Math.ceil((new Date(subscription.expires_at) - new Date()) / 86_400_000)),
            });
        } catch (err) {
            log('error', 'cancel', err.message, { userId: req.user?.id });
            res.status(500).json({ error: 'Internal Server Error', message: 'Falha ao cancelar' });
        }
    });
}
