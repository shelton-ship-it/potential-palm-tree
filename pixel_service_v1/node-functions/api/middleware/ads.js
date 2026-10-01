// middleware/ads.js
// ── Ads control per plan ──────────────────────────────────────────────────
//
// Reactivado (ago/2026): show_ads agora reflecte o plano real —
// true para free (inclui expirado), false para pago activo.
//
// Rodada 3: adiciona formatos por plataforma (mobile/web/tv) e detecção de
// adblock — ver detectAdblock()/reportAdblock() abaixo.
//
// Rodada 4: adiciona `network` (config plug-and-play do provedor real —
// ver lib/ad-network.js) ao contexto, pro cliente saber que tags/domínios
// usar sem precisar de nada hardcoded no frontend.
//
// ── MUDANÇA DE ARQUITETURA (definitiva — remove KV deste caminho) ─────────
// A flag de adblock era persistida no KV (`edgeone.get/put('progress', ...)`)
// e lida em TODA resposta que inclui contexto de ads (ou seja, em quase toda
// rota autenticada do site — ver content.js/catalog.js/channels.js). Isso é
// exactamente o padrão que estava a somar latência e custo de execução por
// nada: é uma preferência simples, do próprio navegador, que não precisa de
// nenhum storage do lado do servidor.
//
// Agora vive num COOKIE (mesmo padrão já usado em routes/auth.js pra guardar
// o idioma preferido) — zero I/O, zero KV, zero Turso, custo de CPU
// desprezível (o cookie-parser já faz o parsing da requisição de qualquer
// forma). O valor é lido diretamente de `req.cookies` em getAdsContext(); só
// a rota POST /api/ads/adblock precisa de `res` pra gravá-lo.

import { getAdNetworkConfig } from '../lib/ad-network.js';

// ── Formatos de anúncio por plataforma ──────────────────────────────────────
// mobile: pre-roll, mid-roll, native (nos cards de listagem), interstitial
//         (transições de tela)
// web:    pre-roll, mid-roll, display (banners na UI)
// tv:     pre-roll, mid-roll (como "ad-break" — pausa o conteúdo, cheio ecrã)
const AD_FORMATS_BY_PLATFORM = {
    mobile: ['pre-roll', 'mid-roll', 'native', 'interstitial'],
    web:    ['pre-roll', 'mid-roll', 'display'],
    tv:     ['pre-roll', 'mid-roll'],
};

function resolvePlatform(req) {
    const p = String(req?.query?.platform || req?.headers?.['x-client-platform'] || '').toLowerCase();
    if (['mobile', 'web', 'tv'].includes(p)) return p;
    return 'web'; // omisso = web, que é sempre servido por este API
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlanActive(user, plan) {
    if (plan.id === 'free') return false; // free nunca é "plano pago activo"
    if (!user.plan_expires_at) return true; // sem data = sem expiração conhecida
    return new Date(user.plan_expires_at) > new Date();
}

/**
 * Returns whether the user should see ads — true para free/expirado,
 * false para plano pago activo.
 */
export async function shouldShowAds(edgeone, user) {
    if (!user) return true;
    const plan = edgeone.PLANS[user.plan_id] || edgeone.PLANS.free;
    return !isPlanActive(user, plan);
}

// ── Detecção de adblock (persistida em COOKIE, não em storage do servidor) ──
// O cliente corre um teste "bait" (ver useAdblockGuard no frontend) e reporta
// o resultado via POST /api/ads/adblock. Fica guardado no cookie até o
// próprio cliente reportar blocked:false de novo (adblock desligado) — não
// expira sozinho antes do maxAge, porque o objectivo é o modal persistir até
// resolver de verdade.
const ADBLOCK_COOKIE          = 'px_adblock';
const ADBLOCK_COOKIE_MAX_AGE  = Number(process.env.ADS_ADBLOCK_COOKIE_MAX_AGE_MS) || 180 * 24 * 3600 * 1000; // 180 dias

function readAdblockCookie(req) {
    return req?.cookies?.[ADBLOCK_COOKIE] === '1';
}

export function setAdblockCookie(res, blocked) {
    res.cookie(ADBLOCK_COOKIE, blocked ? '1' : '0', {
        path:     '/',
        maxAge:   ADBLOCK_COOKIE_MAX_AGE,
        httpOnly: true,        // o servidor é quem decide mostrar/ocultar UI a partir disto — não precisa de JS no cliente
        secure:   isProduction(),
        sameSite: 'lax',
    });
}

/**
 * Returns the ads context object for any API response. Não faz NENHUM I/O —
 * `edgeone` só é usado para ler os planos (objecto estático em memória, sem
 * custo de rede), e o adblock vem do cookie da própria requisição.
 */
export async function getAdsContext(edgeone, user, req = null) {
    const platform = resolvePlatform(req);
    const formats   = AD_FORMATS_BY_PLATFORM[platform];
    const network   = getAdNetworkConfig();
    const adblock   = readAdblockCookie(req);

    if (!user) {
        return { show_ads: true, plan: 'free', is_paid: false, adblock, platform, formats, network };
    }

    const plan    = edgeone.PLANS[user.plan_id] || edgeone.PLANS.free;
    const isPaid  = isPlanActive(user, plan);

    return {
        show_ads: !isPaid,
        plan:     plan.id,
        is_paid:  isPaid,
        adblock,
        platform,
        formats,
        network,
    };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export default function registerAdsRoutes(app) {

    // ── GET /api/ads/ping — no-op, returns 1x1 gif without tracking ──────────
    app.get('/api/ads/ping', (req, res) => {
        if (!req.user) return res.status(401).end();
        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'
        );
        res.set({
            'Content-Type':   'image/gif',
            'Cache-Control':  'no-store, no-cache',
            'Content-Length': pixel.length,
        });
        res.end(pixel);
    });

    // ── POST /api/ads/adblock — reportado pelo useAdblockGuard no cliente ────
    // body: { blocked: boolean }. Persistido em cookie — fica assim até o
    // próprio cliente reportar blocked:false de novo (ver comentário acima).
    // Não bloqueia nada aqui — quem decide mostrar o modal é o frontend,
    // lendo `adblock` de getAdsContext() nas respostas normais.
    app.post('/api/ads/adblock', async (req, res) => {
        if (!req.user) return res.status(401).end();
        try {
            const blocked = req.body?.blocked === true;
            setAdblockCookie(res, blocked);
            res.json({ ok: true, adblock: blocked });
        } catch (err) {
            console.error('[ads] /api/ads/adblock falhou:', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── GET /api/ads/status ───────────────────────────────────────────────────
    app.get('/api/ads/status', async (req, res) => {
        if (!req.user) return res.status(401).end();
        try {
            const ctx = await getAdsContext(app.edgeone, req.user, req);
            res.json(ctx);
        } catch (err) {
            console.error('[ads] /api/ads/status falhou:', err.message);
            // Fail-open: nunca deixar o cliente sem resposta por causa de ads.
            res.status(200).json({
                show_ads: false, plan: 'unknown', is_paid: false, adblock: false,
                platform: 'web', formats: [], network: { configured: false },
                degraded: true,
            });
        }
    });
}
