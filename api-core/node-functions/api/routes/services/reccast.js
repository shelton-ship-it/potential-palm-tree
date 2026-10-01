// routes/services/reccast.js — RecCast
// A gravação de tela acontece inteiramente no browser via MediaRecorder API
// — não há upload nem processamento no backend (custo zero de
// infraestrutura). Esta rota só regista metadata da gravação no histórico
// do utilizador para efeitos de quota/analytics.

import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';

const SERVICE = 'reccast';
const FREE_DAILY_LIMIT = 5;

export default function (app) {

    // ── POST /api/reccast/recordings — regista uma gravação concluída ──────
    app.post('/api/reccast/recordings', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, duration_seconds, size_bytes, mime = 'video/webm' } = req.body;
            if (!filename) return res.status(400).json({ error: 'Bad Request', message: 'filename is required' });

            await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
            const job = await app.edgeone.createJob(SERVICE, req.user.id, {
                type: 'recording', input_name: filename, input_size: size_bytes || 0, input_type: mime,
                duration_seconds: duration_seconds || 0, status: 'completed', completed_at: new Date().toISOString(),
            });

            res.status(201).json({ ok: true, job });
        } catch (err) {
            console.error('[reccast/recordings]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    app.get('/api/reccast/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
