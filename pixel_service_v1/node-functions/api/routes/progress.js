// routes/progress.js
import { authenticate } from '../middleware/auth.js';
import { kvKey }        from '../lib/edgeone.js';

// ── Throttle em memória para POST /progress/update ───────────────────────────
// Evita que o cliente dispare actualizações em loop.
// DEFAULT_THROTTLE_MS: intervalo mínimo entre gravações por (profileId+contentId+episodeId).
// Pode ser sobreposto por query-param ?throttle=<ms> (apenas para testes internos).
const DEFAULT_THROTTLE_MS = 60_000; // 1 minuto
const _lastSaved = new Map(); // key → timestamp

function throttleKey(profileId, contentId, episodeId) {
    return `${profileId}:${contentId}:${episodeId || ''}`;
}

function isThrottled(key, intervalMs) {
    const last = _lastSaved.get(key);
    if (!last) return false;
    return Date.now() - last < intervalMs;
}

function markSaved(key) {
    _lastSaved.set(key, Date.now());
    // Evitar crescimento ilimitado do Map — limpar entradas > 2h
    if (_lastSaved.size > 5000) {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        for (const [k, ts] of _lastSaved) {
            if (ts < cutoff) _lastSaved.delete(k);
        }
    }
}

// ── Helper: resolver perfil ──────────────────────────────────────────────────
async function resolveProfile(app, req, profileId) {
    let targetId = profileId;
    if (!targetId) {
        const profiles = await app.edgeone.getProfiles(req.user.username);
        if (!profiles || profiles.length === 0) return null;
        targetId = profiles[0].id;
    }
    const profile = await app.edgeone.getProfile(targetId);
    if (!profile || profile.user_id !== req.user.id) return null;
    return { profileId: targetId, profile };
}

// ── Helper: sanitizar e validar contentId ───────────────────────────────────
// O cliente por vezes envia undefined, "undefined", null, ou string vazia.
function sanitizeContentId(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s === '' || s === 'undefined' || s === 'null') return null;
    return s;
}

export default function (app) {

    // ── GET /api/progress/continue ───────────────────────────────────────────
    app.get('/api/progress/continue', authenticate, async (req, res) => {
        const { profileId, limit = 20 } = req.query;
        try {
            const resolved = await resolveProfile(app, req, profileId);
            if (!resolved) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }

            const progressList = await app.edgeone.getRecentProgress(resolved.profileId, parseInt(limit));

            const enriched = (await Promise.all(
                progressList.map(async prog => {
                    const content = await app.edgeone.getContent(prog.content_id, prog.lang || 'en');
                    if (!content) return null;
                    return {
                        ...prog,
                        content: { id: content.id, title: content.title, type: content.type, poster: content.poster }
                    };
                })
            )).filter(Boolean);

            res.json(enriched);
        } catch (err) {
            console.error('Continue watching error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load continue watching' });
        }
    });

    // ── POST /api/progress/update ────────────────────────────────────────────
    // FIX: profileId já não é obrigatório. Se omitido, usa o primeiro perfil.
    // FIX: throttle de 1 minuto por (profileId+contentId+episodeId) — evita loop de 400s.
    // FIX: sanitização de contentId — rejeita "undefined", null, string vazia.
    // FIX: query-param ?interval=<segundos> permite ao cliente configurar o intervalo
    //      (mínimo 10s, máximo 3600s). Se omitido, usa DEFAULT_THROTTLE_MS.
    app.post('/api/progress/update', authenticate, async (req, res) => {
        const rawInterval = parseInt(req.query.interval);
        const intervalMs  = isNaN(rawInterval)
            ? DEFAULT_THROTTLE_MS
            : Math.min(3600_000, Math.max(10_000, rawInterval * 1000));

        const { profileId, episodeId, lang = 'en', progress, duration } = req.body;
        const contentId = sanitizeContentId(req.body.contentId);

        // Validação defensiva — contentId e progress são obrigatórios
        if (!contentId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'contentId is required and must not be empty or "undefined"',
            });
        }
        if (progress === undefined || progress === null) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'progress is required',
            });
        }

        try {
            const resolved = await resolveProfile(app, req, profileId);
            if (!resolved) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }

            // Throttle — responde 200 silencioso se ainda não passou o intervalo
            const tKey = throttleKey(resolved.profileId, contentId, episodeId);
            if (isThrottled(tKey, intervalMs)) {
                return res.json({ success: true, skipped: true, nextIn: Math.ceil((intervalMs - (Date.now() - _lastSaved.get(tKey))) / 1000) });
            }

            const progressData = {
                profile_id:  resolved.profileId,
                content_id:  contentId,
                lang,
                episode_id:  episodeId || null,
                progress,
                updated_at:  new Date().toISOString(),
            };
            if (duration !== undefined) progressData.duration = duration;

            await app.edgeone.setProgress(resolved.profileId, contentId, lang, episodeId || null, progressData);
            markSaved(tKey);

            res.json({ success: true, progress: progressData });
        } catch (err) {
            console.error('Progress update error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update progress' });
        }
    });

    // ── GET /api/progress/:contentId ─────────────────────────────────────────
    app.get('/api/progress/:contentId', authenticate, async (req, res) => {
        const contentId = sanitizeContentId(req.params.contentId);
        if (!contentId) {
            return res.status(400).json({ error: 'Bad Request', message: 'contentId is required' });
        }

        const { profileId, episodeId, lang = 'en' } = req.query;

        try {
            const resolved = await resolveProfile(app, req, profileId);
            if (!resolved) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }

            const progress = await app.edgeone.getProgress(resolved.profileId, contentId, lang, episodeId || null);
            if (!progress) {
                return res.status(404).json({ error: 'Not Found', message: 'Progress not found' });
            }

            res.json(progress);
        } catch (err) {
            console.error('Get progress error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get progress' });
        }
    });

    // ── POST /api/progress/reset ─────────────────────────────────────────────
    app.post('/api/progress/reset', authenticate, async (req, res) => {
        const contentId = sanitizeContentId(req.body.contentId);
        const { profileId, episodeId, lang = 'en' } = req.body;

        if (!profileId || !contentId) {
            return res.status(400).json({ error: 'Bad Request', message: 'profileId and contentId are required' });
        }

        try {
            const profile = await app.edgeone.getProfile(profileId);
            if (!profile || profile.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }

            const key = kvKey('progress', profileId, contentId, lang, String(episodeId || '0'));
            await app.edgeone.delete('progress', key);

            // Limpar throttle cache para este item
            _lastSaved.delete(throttleKey(profileId, contentId, episodeId));

            res.json({ success: true });
        } catch (err) {
            console.error('Reset progress error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reset progress' });
        }
    });
}