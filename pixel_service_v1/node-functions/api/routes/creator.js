// routes/creator.js — PixGo Creative
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints do painel do criador (workerspace.pixgo.qzz.io). Toda a identidade
// vem de `req.user` (JWT/cookie `pixgo_session`, mesma auth partilhada com
// o resto do PixGo — ver middleware/auth.js) — NUNCA de um user_id/creator_id
// enviado pelo cliente. Um utilizador só consegue ver/alterar os seus
// próprios dados.
//
// Segurança:
//   • Todas as rotas exigem `authenticate` (sessão válida).
//   • Nenhuma rota aceita user_id/creator_id no body/query — sempre req.user.id.
//   • O estado de monetização é sempre recalculado/lido no servidor
//     (lib/monetization.js) — o frontend só apresenta o que a API devolve.
//   • Payment methods: bloqueado a nível de API (403), não só de UI.

import { authenticate } from '../middleware/auth.js';
import { computeEligibility } from '../lib/monetization.js';

// Recalcula elegibilidade e persiste o início da maturação na primeira vez
// que os requisitos base são cumpridos. Chamado por /me e /monetization.
async function getMonetizationSnapshot(app, user) {
    const contents = await app.edgeone.getAllContentsByUploader(user.id);
    const publishedContents = contents.filter(c => c.status === 'published');

    let snapshot = computeEligibility(user, publishedContents);

    if (snapshot.should_start_maturation) {
        const now = new Date().toISOString();
        const updatedUser = await app.edgeone.updateUserMonetization(user.id, {
            status: 'maturation',
            maturationStartedAt: now,
        });
        snapshot = computeEligibility(updatedUser, publishedContents);
    }

    return { snapshot, contents: publishedContents };
}

export default function (app) {

    // ── GET /api/creator/me ──────────────────────────────────────────────────
    // Resumo da conta + monetização, para o Dashboard principal.
    app.get('/api/creator/me', authenticate, async (req, res) => {
        try {
            const user = await app.edgeone.getUserById(req.user.id);
            if (!user) return res.status(404).json({ error: 'Not Found' });

            const { snapshot, contents } = await getMonetizationSnapshot(app, user);

            const totalViews = contents.reduce((sum, c) => sum + (c.views || 0), 0);
            const totalLikes = contents.reduce((sum, c) => sum + (c.likes || 0), 0);
            const copyrightIssues = contents.filter(c => c.copyright_status === 'issue').length;

            res.json({
                account: {
                    id:         user.id,
                    name:       user.name,
                    username:   user.username,
                    email:      user.email,
                    created_at: user.created_at,
                    account_age_days: snapshot.requirements.account_age.current_days,
                },
                content_summary: {
                    total:              contents.length,
                    qualifying:         snapshot.requirements.qualifying_videos.current,
                    go_creative:        contents.filter(c => c.go_creative).length,
                    copyright_issues:   copyrightIssues,
                },
                performance: {
                    total_views: totalViews,
                    total_likes: totalLikes,
                },
                monetization: snapshot,
            });
        } catch (err) {
            console.error('[creator/me]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── GET /api/creator/contents ─────────────────────────────────────────────
    app.get('/api/creator/contents', authenticate, async (req, res) => {
        try {
            const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

            const { items, total } = await app.edgeone.getContentsByUploader(req.user.id, { page, limit });

            const withState = items.map(c => ({
                ...c,
                creative_status: deriveContentState(c),
            }));

            res.json({
                items: withState,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
            });
        } catch (err) {
            console.error('[creator/contents]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── GET /api/creator/analytics ────────────────────────────────────────────
    app.get('/api/creator/analytics', authenticate, async (req, res) => {
        try {
            const contents = await app.edgeone.getAllContentsByUploader(req.user.id);
            const published = contents.filter(c => c.status === 'published');

            const totalViews = published.reduce((sum, c) => sum + (c.views || 0), 0);
            const totalLikes = published.reduce((sum, c) => sum + (c.likes || 0), 0);

            const byViews = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
            const byLikes = [...published].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);

            // Série simples "views por conteúdo" (a API não guarda histórico
            // diário de views ainda — só o total corrente por conteúdo).
            // Uma série temporal real fica para quando existir um log de
            // eventos de view; por agora expomos o que é sustentável.
            res.json({
                totals: { views: totalViews, likes: totalLikes, contents: published.length },
                top_by_views: byViews.map(c => ({ id: c.id, title: c.title, views: c.views, likes: c.likes })),
                top_by_likes: byLikes.map(c => ({ id: c.id, title: c.title, views: c.views, likes: c.likes })),
                per_content: published.map(c => ({
                    id: c.id, title: c.title, views: c.views || 0, likes: c.likes || 0,
                    created_at: c.created_at,
                })),
            });
        } catch (err) {
            console.error('[creator/analytics]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── GET /api/creator/monetization ─────────────────────────────────────────
    app.get('/api/creator/monetization', authenticate, async (req, res) => {
        try {
            const user = await app.edgeone.getUserById(req.user.id);
            if (!user) return res.status(404).json({ error: 'Not Found' });

            const { snapshot } = await getMonetizationSnapshot(app, user);
            res.json(snapshot);
        } catch (err) {
            console.error('[creator/monetization]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── Payment methods — estrutura pronta, sem gateway real ainda ───────────
    // Bloqueado por elegibilidade tanto aqui (API) como na UI (modal).
    async function requireEligible(req, res, next) {
        try {
            const user = await app.edgeone.getUserById(req.user.id);
            if (!user) return res.status(404).json({ error: 'Not Found' });
            const { snapshot } = await getMonetizationSnapshot(app, user);
            if (!['eligible', 'active'].includes(snapshot.status)) {
                return res.status(403).json({
                    error: 'not_eligible',
                    message: 'Conta não elegível para monetização ainda.',
                    monetization: snapshot,
                });
            }
            req.monetizationSnapshot = snapshot;
            next();
        } catch (err) {
            console.error('[creator/payment-methods gate]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    app.get('/api/creator/payment-methods', authenticate, requireEligible, async (req, res) => {
        // Sem gateway real nesta fase (Paxum planeado, ver users.monetization_status).
        // Estrutura pronta para a integração futura, sem dados sensíveis ainda.
        res.json({
            eligible: true,
            configured: false,
            available_providers: ['paxum'],
            methods: [],
        });
    });

    app.post('/api/creator/payment-methods', authenticate, requireEligible, async (req, res) => {
        // Integração real de gateway fica para fase futura (ver missão:
        // "não implementar payout real ainda"). Aqui só confirmamos que a
        // conta É elegível — a configuração em si ainda não persiste nada.
        res.status(501).json({
            error: 'not_implemented',
            message: 'A integração com o gateway de pagamentos (Paxum) ainda não está disponível nesta fase.',
        });
    });
}

// Deriva um estado amigável para a UI de "Contents" a partir dos campos
// já existentes em content — sem inventar nenhum estado que a API não
// consiga sustentar.
function deriveContentState(c) {
    if (c.status !== 'published') return 'processing';
    if (c.copyright_status === 'issue') return 'copyright_issue';
    if (c.go_creative) return 'go_creative';
    return 'published';
}
