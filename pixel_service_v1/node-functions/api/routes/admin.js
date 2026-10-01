// routes/admin.js
// FIX v1.1:
//   • DELETE /api/admin/content/:id — removido o guard que bloqueava a
//     eliminação de qualquer conteúdo com getContentDependencies().hasEpisodes
//     === true. Uma série/anime/dorama TEM episódios por definição, então
//     esse guard tornava impossível apagar qualquer um deles (409 sempre).
//     deleteContent() (lib/edgeone.js v6.5+) já cascata correctamente
//     episode/season/stealth_playlist/shard git — não há mais razão para
//     bloquear aqui. getContentDependencies() é mantido no edgeone.js caso
//     outra rota ainda o use para fins informativos, só deixou de gatear
//     este delete.
import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { validateOrThrow, schemas, formatFileSize } from '../lib/validation.js';
import rateLimit from 'express-rate-limit';
import onFinished from 'on-finished';
import { getEnv } from '../lib/env.js';
import { getAll } from '../lib/turso.js';
import {
    injectContent,
    rebuildAggregates,
    rebuildForLangs,
    invalidateMemCache,
    SUPPORTED_LANGUAGES,
} from '../lib/aggregate-cache.js';
import { computeEligibility } from '../lib/monetization.js';

// ── Grant de plano pelo admin — cria um registo real em `subscription` ─────
// (não um placeholder: se o admin concede, é uma subscrição real, só que
// paga fora do fluxo cripto) e mantém users.plan_expires_at sincronizado com
// subscription.expires_at, em vez dos dois divergirem (admin grants nunca
// tinham expiry antes, ficando permanentes por engano). Plano 'free' nunca
// gera subscrição — é só ausência de uma.
async function grantAdminPlan(app, user, planId) {
    const plan = app.edgeone.PLANS[planId];
    if (!plan || planId === 'free') {
        return app.edgeone.updateUserPlan(user.username, 'free', null);
    }
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + plan.duration_days * 86_400_000).toISOString();

    await app.edgeone.setSubscription(user.id, {
        plan_id:     planId,
        status:      'active',
        started_at:  now.toISOString(),
        expires_at:  expiresAt,
        amount_usdt: null, // grant manual do admin, não é pagamento real (nem cripto nem Hotmart)
        network:     'admin',
        tx_hash:     null,
    });

    return app.edgeone.updateUserPlan(user.username, planId, expiresAt);
}

export default function (app) {

    // ── REQUEST ID ───────────────────────────────────────────────────────────
    app.use('/api/admin', (req, _res, next) => {
        req.id = randomUUID();
        next();
    });

    // ── ADMIN AUTH ───────────────────────────────────────────────────────────
    app.use('/api/admin', async (req, res, next) => {
        const apiKey = req.headers['x-api-key'];

        if (apiKey) {
            const validKeys = [
                { key: getEnv('ADMIN_API_KEY_MASTER'), type: 'master' },
                { key: getEnv('ADMIN_API_KEY_BACKUP'), type: 'backup' }
            ].filter(k => k.key);

            for (const entry of validKeys) {
                try {
                    const a = Buffer.from(entry.key);
                    const b = Buffer.from(apiKey);
                    if (a.length === b.length && timingSafeEqual(a, b)) {
                        req.admin = { key: apiKey, type: entry.type, authenticated_at: new Date().toISOString() };
                        return next();
                    }
                } catch {
                    continue;
                }
            }
        }

        // JWT admin fallback
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const payload = app.jwt.verify(authHeader.slice(7));
                if (payload.role === 'admin') {
                    req.admin = { id: payload.id, username: payload.username, type: 'jwt', authenticated_at: new Date().toISOString() };
                    return next();
                }
            } catch {
                // fall through
            }
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Admin access required. Provide a valid API Key or admin JWT token.'
        });
    });

    // ── ADMIN RATE LIMITERS ──────────────────────────────────────────────────
    const makeLimiter = (max, keyFn) => rateLimit({
        windowMs: 60_000,
        max,
        keyGenerator: keyFn,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({
            error: 'Rate Limit Exceeded',
            message: 'Too many admin requests.',
            retryAfter: Math.ceil((req.rateLimit?.resetTime - Date.now()) / 1000) || 60
        })
    });

    const masterLimiter  = makeLimiter(200,  req => `admin:master:${req.admin?.key || 'x'}`);
    const backupLimiter  = makeLimiter(50,   req => `admin:backup:${req.admin?.key || 'x'}`);
    const jwtLimiter     = makeLimiter(20,   req => `admin:jwt:${req.admin?.id  || 'x'}`);

    app.use('/api/admin', (req, res, next) => {
        if (!req.admin) return next();
        if (req.admin.type === 'master') return masterLimiter(req, res, next);
        if (req.admin.type === 'backup') return backupLimiter(req, res, next);
        return jwtLimiter(req, res, next);
    });

    // ── AUDIT LOG ────────────────────────────────────────────────────────────
    app.use('/api/admin', (req, _res, next) => { req.startTime = Date.now(); next(); });

    app.use('/api/admin', (req, res, next) => {
        onFinished(res, () => {
            if (req.admin && req.method !== 'GET') {
                const body = req.body ? { ...req.body } : undefined;
                if (body?.password)  delete body.password;
                if (body?.api_key)   delete body.api_key;
                app.edgeone.logAdminAction({
                    admin_id:    req.admin.key || req.admin.id,
                    admin_type:  req.admin.type,
                    action:      `${req.method} ${req.url}`,
                    body,
                    params:      req.params,
                    query:       req.query,
                    status:      res.statusCode,
                    duration:    Date.now() - (req.startTime || 0),
                    ip:          req.ip,
                    user_agent:  req.headers['user-agent'],
                    timestamp:   new Date().toISOString()
                }).catch(() => {});
            }
        });
        next();
    });

    // ── GET /api/admin/health ────────────────────────────────────────────────
    app.get('/api/admin/health', async (req, res) => {
        const checks = { edgeone: false, storage: false, catalog: false };
        try {
            checks.edgeone  = await app.edgeone.ping();
            checks.storage  = true;
            const testRead  = await app.edgeone.getContent('_health', 'en');
            checks.catalog  = testRead !== undefined;
        } catch { /* checks remain false */ }

        const healthy = Object.values(checks).every(Boolean);
        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString(),
            admin: { type: req.admin?.type, authenticated_at: req.admin?.authenticated_at }
        });
    });

    // ── GET /api/admin/stats ─────────────────────────────────────────────────
    app.get('/api/admin/stats', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can view system stats' });
        }
        try {
            const [contentStats, userStats, recentActivity, cacheStats] =
                await Promise.all([
                    app.edgeone.getContentStats(),
                    app.edgeone.getUserStats(),
                    app.edgeone.getRecentAdminActions(10),
                    app.edgeone.getCacheStats()
                ]);

            res.json({
                ...contentStats,
                ...userStats,
                recent_activity: recentActivity,
                cache: cacheStats,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('Stats error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load stats', request_id: req.id });
        }
    });

    // ── POST /api/admin/content ──────────────────────────────────────────────
    app.post('/api/admin/content', async (req, res) => {
        try {
            const contentData = validateOrThrow(schemas.content, req.body);

            if (contentData.id && req.admin.type !== 'master') {
                return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can update existing content' });
            }

            const contentId = contentData.id || randomBytes(16).toString('hex');
            const now       = new Date().toISOString();

            if (!contentData.id) {
                const existing = await app.edgeone.getContentByTitle(contentData.title, contentData.year);
                if (existing) {
                    return res.status(409).json({
                        error: 'Conflict',
                        message: 'Content with this title and year already exists',
                        existing_id: existing.id,
                        existing_title: existing.title
                    });
                }
            }

            const languages = contentData.audio_langs || ['en'];
            const ops = [];

            for (const lang of languages) {
                ops.push(app.edgeone.setContent(contentId, {
                    id:             contentId,
                    lang,
                    type:           contentData.type,
                    title:          contentData.title,
                    title_original: contentData.title_original || null,
                    year:           contentData.year,
                    poster:         contentData.poster || null,
                    description:    contentData.description || null,
                    duration:       contentData.duration || null,
                    seasons:        contentData.seasons || null,
                    episodes:       contentData.episodes || null,
                    views:          0,
                    created_at:     contentData.id ? undefined : now,
                    updated_at:     now,
                    audio_langs:    contentData.audio_langs,
                    subtitle_langs: contentData.subtitle_langs,
                    created_by:     req.admin.key || req.admin.id
                }, lang));
            }

            if (contentData.meta) {
                ops.push(app.edgeone.setContentMeta(contentId, {
                    id:              contentId,
                    available_langs: contentData.meta.available_langs || languages,
                    default_lang:    contentData.meta.default_lang    || 'en',
                    original_lang:   contentData.meta.original_lang   || 'en',
                    year:            contentData.year,
                    rating:          contentData.meta.rating          || 0,
                    genres:          contentData.meta.genres          || [],
                    poster_default:  contentData.meta.poster_default  || contentData.poster || null,
                    updated_at:      now,
                    updated_by:      req.admin.key || req.admin.id
                }));
            }

            if (contentData.tags?.length > 0) {
                ops.push(app.edgeone.setContentTags(contentId, contentData.tags));
                for (const tagName of contentData.tags) {
                    const existing = await app.edgeone.getTag(tagName);
                    if (!existing) {
                        ops.push(app.edgeone.setTag(tagName, {
                            id:         randomBytes(8).toString('hex'),
                            name:       tagName,
                            created_at: now,
                            created_by: req.admin.key || req.admin.id
                        }));
                    }
                }
            }

            await Promise.all(ops);
            await app.edgeone.invalidateContentCache(contentId);

            const affectedLangs = contentData.audio_langs?.length ? contentData.audio_langs : ['en'];
            const meta = contentData.meta || null;
            for (const lang of affectedLangs) {
                const contentForInject = await app.edgeone.getContent(contentId, lang);
                if (contentForInject) {
                    injectContent(app.edgeone, contentForInject, meta, lang).catch(err =>
                        console.error(`[admin] injectContent error (${lang}):`, err.message)
                    );
                }
            }

            res.json({
                success: true,
                id:      contentId,
                message: contentData.id ? 'Content updated successfully' : 'Content created successfully',
                action:  contentData.id ? 'update' : 'create'
            });
        } catch (err) {
            if (err.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation Error', details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            console.error('Save content error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save content', request_id: req.id });
        }
    });

    // ── DELETE /api/admin/content/:id ────────────────────────────────────────
    app.delete('/api/admin/content/:id', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can delete content' });
        }
        try {
            const content = await app.edgeone.getContent(req.params.id, 'en');
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: 'Content not found' });
            }

            // deleteContent() já cascata episode/season/stealth_playlist (por
            // episódio quando aplicável) e dispara a remoção dos segmentos no
            // shard git via dispatcher. Não há mais dependência a verificar
            // aqui antes de apagar.
            await app.edgeone.deleteContent(req.params.id);
            res.json({ success: true, message: `Content ${req.params.id} deleted`, deleted_at: new Date().toISOString() });
        } catch (err) {
            console.error('Delete content error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete content' });
        }
    });

    // ── POST /api/admin/season ───────────────────────────────────────────────
    app.post('/api/admin/season', async (req, res) => {
        if (!['master', 'backup'].includes(req.admin.type)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master or backup admin can manage seasons' });
        }
        try {
            const data = validateOrThrow(schemas.season, req.body);

            const content = await app.edgeone.getContent(data.content_id, 'en');
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: `Content ${data.content_id} not found` });
            }

            const existing = await app.edgeone.getSeason(data.content_id, data.season_number);
            if (existing) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: `Season ${data.season_number} already exists`,
                    existing_season: { id: existing.id, title: existing.title, episode_count: existing.episode_count }
                });
            }

            const now      = new Date().toISOString();
            const seasonId = randomBytes(16).toString('hex');
            const season   = {
                id:            seasonId,
                content_id:    data.content_id,
                season_number: data.season_number,
                title:         data.title || null,
                poster:        data.poster || null,
                episode_count: 0,
                created_at:    now,
                updated_at:    now,
                created_by:    req.admin.key || req.admin.id
            };

            await app.edgeone.setSeason(data.content_id, data.season_number, season);
            res.json({ success: true, id: seasonId, message: `Season ${data.season_number} created`, season });
        } catch (err) {
            if (err.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation Error', details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            console.error('Save season error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save season' });
        }
    });

    // ── POST /api/admin/episode ──────────────────────────────────────────────
    app.post('/api/admin/episode', async (req, res) => {
        if (!['master', 'backup'].includes(req.admin.type)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master or backup admin can manage episodes' });
        }
        try {
            const data = validateOrThrow(schemas.episode, req.body);

            const season = await app.edgeone.getSeason(data.content_id, data.season_number);
            if (!season) {
                return res.status(404).json({ error: 'Not Found', message: `Season ${data.season_number} not found for content ${data.content_id}` });
            }

            const existing = await app.edgeone.getEpisode(data.content_id, data.season_number, data.episode_number);
            if (existing) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: `Episode ${data.episode_number} already exists`,
                    existing_episode: { id: existing.id, title: existing.title }
                });
            }

            const now       = new Date().toISOString();
            const episodeId = randomBytes(16).toString('hex');
            const episode   = {
                id:             episodeId,
                content_id:     data.content_id,
                season_number:  data.season_number,
                episode_number: data.episode_number,
                season_id:      season.id,
                title:          data.title,
                duration:       data.duration || null,
                poster:         data.poster   || null,
                description:    data.description || null,
                chunk_count:    0,
                created_at:     now,
                updated_at:     now,
                created_by:     req.admin.key || req.admin.id
            };

            await app.edgeone.setEpisode(data.content_id, data.season_number, data.episode_number, episode);
            await app.edgeone.incrementSeasonEpisodeCount(data.content_id, data.season_number);

            res.json({ success: true, id: episodeId, message: `Episode ${data.episode_number} created`, episode });
        } catch (err) {
            if (err.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation Error', details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            console.error('Save episode error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save episode' });
        }
    });

    // ── POST /api/admin/chunk ────────────────────────────────────────────────
    app.post('/api/admin/chunk', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can register chunks' });
        }
        try {
            const data = validateOrThrow(schemas.chunk, req.body);

            const existing = await app.edgeone.getChunkByHash(data.chunk_hash);
            if (existing) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'Chunk with this hash already exists',
                    existing_chunk: { hash: existing.chunk_hash, registered_at: existing.registered_at }
                });
            }

            if (data.content_id) {
                const content = await app.edgeone.getContent(data.content_id, data.lang || 'en');
                if (!content) {
                    return res.status(404).json({ error: 'Not Found', message: `Content ${data.content_id} not found` });
                }
            }

            if (data.episode_id) {
                const episode = await app.edgeone.getEpisodeById(data.episode_id);
                if (!episode) {
                    return res.status(404).json({ error: 'Not Found', message: `Episode ${data.episode_id} not found` });
                }
            }

            const now = new Date().toISOString();
            await app.edgeone.setChunkByHash(data.chunk_hash, {
                ...data,
                registered_at: now,
                registered_by: req.admin.key || req.admin.id,
                access_count:  0,
                is_corrupted:  false
            });

            if (data.urls?.length > 0) {
                await app.edgeone.setChunkUrls(data.chunk_hash, data.urls.map(u => ({
                    ...u,
                    created_at:   now,
                    last_checked: now,
                    health_status: 'unknown'
                })));
            }

            res.json({
                success: true,
                hash:    data.chunk_hash,
                message: 'Chunk registered successfully',
                storage: { size: data.size_bytes, size_formatted: formatFileSize(data.size_bytes) }
            });
        } catch (err) {
            if (err.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation Error', details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            console.error('Save chunk error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save chunk', request_id: req.id });
        }
    });

    // ── POST /api/admin/channel ──────────────────────────────────────────────
    app.post('/api/admin/channel', async (req, res) => {
        if (!['master', 'backup'].includes(req.admin.type)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master or backup admin can manage channels' });
        }
        try {
            const data = validateOrThrow(schemas.channel, req.body);
            const channelId = req.body.id || randomBytes(8).toString('hex');
            await app.edgeone.setChannel(channelId, data);
            res.json({ success: true, id: channelId, message: 'Channel saved' });
        } catch (err) {
            if (err.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation Error', details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) });
            }
            console.error('Save channel error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save channel' });
        }
    });

    // ── GET /api/admin/users ─────────────────────────────────────────────────
    app.get('/api/admin/users', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can list users' });
        }
        try {
            const page   = parseInt(req.query.page  || '1',  10);
            const limit  = Math.min(parseInt(req.query.limit || '50', 10), 200);
            const offset = (page - 1) * limit;

            const [rows, totalRow] = await Promise.all([
                getAll(
                    `SELECT id, username, email, name, role, plan_id, plan_expires_at,
                            is_active, failed_logins, locked_until, created_at, updated_at
                     FROM users
                     ORDER BY created_at DESC
                     LIMIT ? OFFSET ?`,
                    [limit, offset]
                ),
                getAll('SELECT COUNT(*) as cnt FROM users', []),
            ]);

            const total = totalRow[0]?.cnt || 0;

            const users = rows.map(u => ({
                id:              u.id,
                username:        u.username,
                email:           u.email || null,
                name:            u.name  || '',
                role:            u.role  || 'user',
                plan_id:         u.plan_id || 'free',
                plan_expires_at: u.plan_expires_at || null,
                is_active:       u.is_active === 1 || u.is_active === true,
                failed_logins:   u.failed_logins || 0,
                locked_until:    u.locked_until || null,
                created_at:      u.created_at,
                updated_at:      u.updated_at || null,
            }));

            res.json({
                users,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        } catch (err) {
            console.error('List users error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list users' });
        }
    });

    // ── PUT /api/admin/users/:username/plan ──────────────────────────────────
    app.put('/api/admin/users/:username/plan', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can change user plans' });
        }
        try {
            const { planId } = req.body;
            if (!app.edgeone.PLANS[planId]) {
                return res.status(400).json({ error: 'Bad Request', message: 'Invalid plan ID' });
            }
            const target = await app.edgeone.getUser(req.params.username);
            if (!target) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

            const user = await grantAdminPlan(app, target, planId);
            res.json({ success: true, user });
        } catch (err) {
            console.error('Update user plan error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user plan' });
        }
    });

    // ── POST /api/admin/catalog/inject ───────────────────────────────────────
    // Uso manual/admin apenas — para reinjectar um conteúdo já existente no Turso.
    // NÃO deve ser chamado pelo pipeline local (KV binding não existe aí).
    app.post('/api/admin/catalog/inject', async (req, res) => {
        try {
            const { contentId, lang = 'en' } = req.body;
            if (!contentId) return res.status(400).json({ error: 'contentId required' });

            const content = await app.edgeone.getContent(contentId, lang);
            if (!content) return res.status(404).json({ error: 'Content not found', contentId, lang });

            const meta = await app.edgeone.getContentMeta(contentId);
            await injectContent(app.edgeone, content, meta, lang);

            console.log(`[catalog/inject] contentId=${contentId} lang=${lang}`);
            res.json({ ok: true, injected: contentId, lang });
        } catch (err) {
            console.error('Inject error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/admin/cache/rebuild ─────────────────────────────────────────
    // Uso excepcional — rebuild completo após importação em massa.
    // Para conteúdo individual, usar /api/admin/catalog/inject (muito mais rápido).
    app.post('/api/admin/cache/rebuild', async (req, res) => {
        const { langs } = req.body;
        const targetLangs = Array.isArray(langs) && langs.length > 0
            ? langs.filter(l => SUPPORTED_LANGUAGES.includes(l))
            : SUPPORTED_LANGUAGES;

        if (targetLangs.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'No valid languages specified' });
        }

        res.json({
            ok:      true,
            message: `Aggregate rebuild started for ${targetLangs.length} language(s)`,
            langs:   targetLangs,
            note:    'Rebuild runs in background. Use /api/admin/catalog/inject for individual content.',
        });

        rebuildAggregates(app.edgeone, targetLangs).catch(err =>
            console.error('[admin/cache/rebuild] error:', err.message)
        );
    });

    // ── GET /api/admin/cache/status ───────────────────────────────────────────
    app.get('/api/admin/cache/status', (_req, res) => {
        res.json({
            mem_cache_entries: 0,
            note: 'In-memory LRU removed — KV is the source of truth. Aggregates live in KV only.',
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ADMIN DASHBOARD — ROTAS NOVAS (aditivas, nada acima foi alterado)
    // ══════════════════════════════════════════════════════════════════════════

    // ── GET /api/admin/users/:username — detalhe completo de 1 user ─────────────
    app.get('/api/admin/users/:username', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can view user details' });
        }
        try {
            const user = await app.edgeone.getUser(req.params.username);
            if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

            const [profiles, subscription] = await Promise.all([
                app.edgeone.getProfiles(user.username),
                app.edgeone.getSubscription(user.id),
            ]);

            const { password, ...safeUser } = user;
            res.json({ user: safeUser, profiles, subscription: subscription || null });
        } catch (err) {
            console.error('Get user detail error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load user' });
        }
    });

    // ── POST /api/admin/users — criar user pelo admin ────────────────────────────
    app.post('/api/admin/users', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can create users' });
        }
        try {
            const { username, password, name, email, role, plan_id } = req.body || {};
            if (!username || !password || !name) {
                return res.status(400).json({ error: 'Bad Request', message: 'username, password e name são obrigatórios' });
            }
            const existing = await app.edgeone.getUser(username);
            if (existing) {
                return res.status(409).json({ error: 'Conflict', message: 'Username já existe' });
            }

            const { default: bcrypt } = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 12);

            const user = await app.edgeone.createUser({
                username, password: hashedPassword, name,
                email: email || undefined,
                role: role || 'user',
                plan_id: plan_id || 'free',
            });

            const finalUser = await grantAdminPlan(app, user, plan_id || 'free');

            const { password: _pw, ...safeUser } = finalUser;
            res.json({ success: true, user: safeUser });
        } catch (err) {
            console.error('Create user error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user' });
        }
    });

    // ── PUT /api/admin/users/:username — editar dados gerais ─────────────────────
    app.put('/api/admin/users/:username', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can edit users' });
        }
        try {
            const allowed = ['name', 'email', 'role', 'is_active'];
            const updates = {};
            for (const key of allowed) {
                if (key in (req.body || {})) updates[key] = req.body[key];
            }
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'Nenhum campo válido para actualizar' });
            }

            const user = await app.edgeone.updateUser(req.params.username, updates);
            if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

            const { password, ...safeUser } = user;
            res.json({ success: true, user: safeUser });
        } catch (err) {
            console.error('Update user error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user' });
        }
    });

    // ── DELETE /api/admin/users/:username ─────────────────────────────────────────
    app.delete('/api/admin/users/:username', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can delete users' });
        }
        try {
            const deleted = await app.edgeone.deleteUser(req.params.username);
            if (!deleted) return res.status(404).json({ error: 'Not Found', message: 'User not found' });
            res.json({ success: true, message: `User ${req.params.username} deleted` });
        } catch (err) {
            console.error('Delete user error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user' });
        }
    });

    // ── GET /api/admin/users/:username/usage — progresso/uso agregado ────────────
    app.get('/api/admin/users/:username/usage', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can view usage' });
        }
        try {
            const user = await app.edgeone.getUser(req.params.username);
            if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

            const usage = await app.edgeone.getUserUsage(req.params.username);
            res.json(usage);
        } catch (err) {
            console.error('Get usage error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load usage' });
        }
    });

    // ── GET /api/admin/subscriptions — todas as assinaturas ───────────────────────
    app.get('/api/admin/subscriptions', async (req, res) => {
        if (req.admin.type !== 'master') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only master admin can list subscriptions' });
        }
        try {
            const page   = parseInt(req.query.page  || '1',  10);
            const limit  = Math.min(parseInt(req.query.limit || '50', 10), 200);
            const status = req.query.status || null;

            const { rows, total } = await app.edgeone.getSubscriptionsAdmin({ page, limit, status });

            res.json({
                subscriptions: rows,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        } catch (err) {
            console.error('List subscriptions error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list subscriptions' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PixGo Creative — /admin (Rodada 3)
    // READ:  contents (com filtros), monetização de um criador
    // WRITE: likes/views de um conteúdo, copyright_status, fase de
    //        maturação/estado de monetização de um criador
    // Autenticação já coberta pelo app.use('/api/admin', ...) no topo deste
    // ficheiro — nada de novo a validar aqui.
    // ═══════════════════════════════════════════════════════════════════════

    // ── GET /api/admin/contents — listagem filtrada ──────────────────────────
    app.get('/api/admin/contents', async (req, res) => {
        try {
            const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
            const { type, status, uploader_id, go_creative, copyright_status, search } = req.query;

            const { items, total } = await app.edgeone.getAllContentsFiltered({
                type: type || null,
                status: status || null,
                uploaderId: uploader_id || null,
                goCreative: go_creative === undefined ? null : go_creative === 'true',
                copyrightStatus: copyright_status || null,
                search: search || null,
                page, limit,
            });

            res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
        } catch (err) {
            console.error('[admin/contents]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list contents' });
        }
    });

    // ── PUT /api/admin/contents/:id/counters — corrigir likes/views ─────────
    app.put('/api/admin/contents/:id/counters', async (req, res) => {
        try {
            const { likes, views } = req.body || {};
            if (likes === undefined && views === undefined) {
                return res.status(400).json({ error: 'likes e/ou views são obrigatórios' });
            }
            const content = await app.edgeone.adminSetContentCounters(req.params.id, { likes, views });
            if (!content) return res.status(404).json({ error: 'Not Found' });
            res.json(content);
        } catch (err) {
            console.error('[admin/contents/counters]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update counters' });
        }
    });

    // ── PUT /api/admin/contents/:id/copyright-status ─────────────────────────
    app.put('/api/admin/contents/:id/copyright-status', async (req, res) => {
        try {
            const { status } = req.body || {};
            if (!['clear', 'issue', 'review'].includes(status)) {
                return res.status(400).json({ error: "status deve ser 'clear', 'issue' ou 'review'" });
            }
            const content = await app.edgeone.adminSetCopyrightStatus(req.params.id, status);
            if (!content) return res.status(404).json({ error: 'Not Found' });
            res.json(content);
        } catch (err) {
            console.error('[admin/contents/copyright-status]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update copyright status' });
        }
    });

    // ── GET /api/admin/creators/:userId/monetization ─────────────────────────
    app.get('/api/admin/creators/:userId/monetization', async (req, res) => {
        try {
            const user = await app.edgeone.getUserById(req.params.userId);
            if (!user) return res.status(404).json({ error: 'Not Found' });

            const contents = (await app.edgeone.getAllContentsByUploader(user.id))
                .filter(c => c.status === 'published');
            const snapshot = computeEligibility(user, contents);
            res.json({ user: { id: user.id, username: user.username, name: user.name }, monetization: snapshot });
        } catch (err) {
            console.error('[admin/creators/monetization]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    // ── PUT /api/admin/creators/:userId/monetization — fase/estado manual ───
    app.put('/api/admin/creators/:userId/monetization', async (req, res) => {
        try {
            const { status, maturation_started_at } = req.body || {};
            const validStatuses = ['not_eligible', 'requirements_pending', 'maturation', 'eligible', 'active', 'suspended'];
            if (status !== undefined && !validStatuses.includes(status)) {
                return res.status(400).json({ error: `status deve ser um de: ${validStatuses.join(', ')}` });
            }
            const user = await app.edgeone.updateUserMonetization(req.params.userId, {
                status,
                maturationStartedAt: maturation_started_at,
            });
            if (!user) return res.status(404).json({ error: 'Not Found' });
            res.json({ id: user.id, monetization_status: user.monetization_status, maturation_started_at: user.maturation_started_at });
        } catch (err) {
            console.error('[admin/creators/monetization PUT]', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
