// routes/services/qrforge.js — QRForge
// QR estático: gerado directamente no browser normalmente seria suficiente,
// mas geramos aqui também para consistência de marca/analytics básicos.
// QR dinâmico (o gancho de assinatura): o QR aponta para uma rota própria
// deste backend (/api/qrforge/r/:code) que regista o clique e só depois
// redirecciona para o destino real — o destino pode ser trocado depois sem
// reimprimir o QR, e cada scan fica registado.

import QRCode from 'qrcode';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';
import { shortId } from '../../lib/utils.js';

const SERVICE = 'qrforge';
const FREE_DAILY_LIMIT = 5;
const FREE_DYNAMIC_LIMIT = 1; // nº de QR dinâmicos simultâneos no plano free

// Domínio público deduzido do próprio pedido — a API já sabe em que host
// está a correr, não precisa de env nenhuma para isto.
function publicBase(req) {
    return `${req.protocol}://${req.get('host')}`;
}

export default function (app) {

    // ── POST /api/qrforge/static — QR estático (aponta directo pro destino) ─
    app.post('/api/qrforge/static', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { content, size = 512 } = req.body;
            if (!content) return res.status(400).json({ error: 'Bad Request', message: 'content is required' });

            const dataUrl = await QRCode.toDataURL(content, { width: size, margin: 2 });
            await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
            await app.edgeone.createJob(SERVICE, req.user.id, {
                type: 'static', input_name: content.slice(0, 60), status: 'completed', completed_at: new Date().toISOString(),
            });

            res.json({ ok: true, data_url: dataUrl });
        } catch (err) {
            console.error('[qrforge/static]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/qrforge/dynamic — cria QR dinâmico rastreável ─────────────
    app.post('/api/qrforge/dynamic', authenticate, async (req, res) => {
        try {
            const { target_url, label, size = 512 } = req.body;
            if (!target_url) return res.status(400).json({ error: 'Bad Request', message: 'target_url is required' });

            const plan = await app.edgeone.getUserPlan(req.user.username);
            if (!plan?.is_active || plan.id === 'free') {
                const existing = (await app.edgeone.listUserJobs(req.user.id, SERVICE)).filter(j => j.type === 'dynamic' && j.active !== false);
                if (existing.length >= FREE_DYNAMIC_LIMIT) {
                    return res.status(403).json({
                        error: 'Quota Exceeded',
                        message: `Plano gratuito permite ${FREE_DYNAMIC_LIMIT} QR dinâmico. Faça upgrade para criar mais.`,
                        upgrade_url: '/main/plans',
                    });
                }
            }

            const code = shortId();
            const redirectUrl = `${publicBase(req)}/api/qrforge/r/${code}`;
            const dataUrl = await QRCode.toDataURL(redirectUrl, { width: size, margin: 2 });

            const job = await app.edgeone.createJob(SERVICE, req.user.id, {
                type: 'dynamic', code, target_url, label: label || target_url,
                clicks: 0, active: true, status: 'completed', completed_at: new Date().toISOString(),
            });
            // Índice code → jobId, usado pelo redirect público (sem auth)
            await app.edgeone.put('qrcode', code, { jobId: job.id, userId: req.user.id });

            res.status(201).json({ ok: true, job, redirect_url: redirectUrl, data_url: dataUrl });
        } catch (err) {
            console.error('[qrforge/dynamic]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── PUT /api/qrforge/dynamic/:id — troca o destino sem reimprimir o QR ──
    app.put('/api/qrforge/dynamic/:id', authenticate, async (req, res) => {
        const job = await app.edgeone.getJob(SERVICE, req.params.id);
        if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Not Found' });

        const { target_url, active } = req.body;
        const updated = await app.edgeone.updateJob(SERVICE, req.params.id, {
            ...(target_url ? { target_url } : {}),
            ...(typeof active === 'boolean' ? { active } : {}),
        });
        res.json({ ok: true, job: updated });
    });

    // ── GET /api/qrforge/r/:code — redirect público + contagem de clique ────
    app.get('/api/qrforge/r/:code', async (req, res) => {
        const pointer = await app.edgeone.get('qrcode', req.params.code);
        if (!pointer) return res.status(404).send('QR code não encontrado ou expirado.');

        const job = await app.edgeone.getJob(SERVICE, pointer.jobId);
        if (!job) return res.status(404).send('QR code não encontrado ou expirado.');
        if (!job.active) return res.status(410).send('Este QR code foi desactivado pelo criador.');

        await app.edgeone.updateJob(SERVICE, job.id, { clicks: (job.clicks || 0) + 1, last_click_at: new Date().toISOString() });
        res.redirect(302, job.target_url);
    });

    // ── GET /api/qrforge/jobs — histórico + estatísticas de cliques ────────
    app.get('/api/qrforge/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
