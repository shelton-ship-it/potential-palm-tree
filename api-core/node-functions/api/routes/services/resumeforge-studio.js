import { randomUUID } from 'crypto';
import { authenticate } from '../../middleware/auth.js';

const SERVICE = 'resumeforge-studio';
const MAX_DRAFTS = 100;
const MAX_COLLECTIONS = 50;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function cleanText(value, max = 240) {
    return String(value ?? '').trim().slice(0, max);
}
function bodySize(body) {
    try { return Buffer.byteLength(JSON.stringify(body || {}), 'utf8'); } catch { return MAX_BODY_BYTES + 1; }
}
function userKey(userId, type) { return `${type}:${userId}`; }
async function readIndex(app, userId, type) { return (await app.edgeone.get('resumeforge_studio', userKey(userId, type))) || []; }
async function writeIndex(app, userId, type, value) { await app.edgeone.put('resumeforge_studio', userKey(userId, type), value); }
function validId(id) { return /^[a-zA-Z0-9_-]{12,80}$/.test(String(id || '')); }
function now() { return new Date().toISOString(); }

function registerDraftRoutes(app) {
    app.get('/api/resumeforge/drafts', authenticate, async (req, res) => {
        const index = await readIndex(app, req.user.id, 'drafts');
        const drafts = (await Promise.all(index.slice(0, MAX_DRAFTS).map(item => app.edgeone.get('resumeforge_studio', `draft:${req.user.id}:${item.id}`)))).filter(Boolean);
        res.json({ drafts });
    });
    app.post('/api/resumeforge/drafts', authenticate, async (req, res) => {
        if (bodySize(req.body) > MAX_BODY_BYTES) return res.status(413).json({ error: 'Payload Too Large', message: 'Draft exceeds the maximum size.' });
        const id = randomUUID(); const timestamp = now();
        const draft = { id, user_id: req.user.id, name: cleanText(req.body?.name, 120) || 'Currículo sem título', style_id: cleanText(req.body?.style_id, 80), resume: req.body?.resume || {}, created_at: timestamp, updated_at: timestamp };
        const index = await readIndex(app, req.user.id, 'drafts');
        await app.edgeone.put('resumeforge_studio', `draft:${req.user.id}:${id}`, draft);
        await writeIndex(app, req.user.id, 'drafts', [{ id, updated_at: timestamp }, ...index.filter(item => item.id !== id)].slice(0, MAX_DRAFTS));
        res.status(201).json({ draft });
    });
    app.put('/api/resumeforge/drafts/:id', authenticate, async (req, res) => {
        if (!validId(req.params.id) || bodySize(req.body) > MAX_BODY_BYTES) return res.status(400).json({ error: 'Bad Request', message: 'Invalid draft.' });
        const key = `draft:${req.user.id}:${req.params.id}`; const existing = await app.edgeone.get('resumeforge_studio', key);
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Draft not found.' });
        const draft = { ...existing, name: cleanText(req.body?.name ?? existing.name, 120), style_id: cleanText(req.body?.style_id ?? existing.style_id, 80), resume: req.body?.resume ?? existing.resume, updated_at: now() };
        await app.edgeone.put('resumeforge_studio', key, draft);
        res.json({ draft });
    });
    app.delete('/api/resumeforge/drafts/:id', authenticate, async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Bad Request', message: 'Invalid draft.' });
        const key = `draft:${req.user.id}:${req.params.id}`; const existing = await app.edgeone.get('resumeforge_studio', key);
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Draft not found.' });
        await app.edgeone.put('resumeforge_studio', key, null);
        await writeIndex(app, req.user.id, 'drafts', (await readIndex(app, req.user.id, 'drafts')).filter(item => item.id !== req.params.id));
        res.json({ ok: true });
    });
}

function registerShareRoutes(app) {
    app.get('/api/resumeforge/shares', authenticate, async (req, res) => {
        const index = await readIndex(app, req.user.id, 'shares');
        const shares = (await Promise.all(index.map(item => app.edgeone.get('resumeforge_studio', `share:${item.slug}`)))).filter(Boolean).map(item => ({ ...item, resume: undefined }));
        res.json({ shares });
    });
    app.post('/api/resumeforge/shares', authenticate, async (req, res) => {
        if (bodySize(req.body) > MAX_BODY_BYTES) return res.status(413).json({ error: 'Payload Too Large', message: 'Shared resume exceeds the maximum size.' });
        const slug = randomUUID().replaceAll('-', '').slice(0, 20); const timestamp = now();
        const share = { slug, user_id: req.user.id, title: cleanText(req.body?.title, 160) || 'Currículo partilhado', style_id: cleanText(req.body?.style_id, 80), export_layout: cleanText(req.body?.export_layout, 40) || 'standard', resume: req.body?.resume || {}, created_at: timestamp, updated_at: timestamp, view_count: 0, active: true };
        await app.edgeone.put('resumeforge_studio', `share:${slug}`, share);
        const index = await readIndex(app, req.user.id, 'shares');
        await writeIndex(app, req.user.id, 'shares', [{ slug, updated_at: timestamp }, ...index.filter(item => item.slug !== slug)].slice(0, MAX_DRAFTS));
        res.status(201).json({ share: { ...share, resume: undefined } });
    });
    app.get('/api/resumeforge/shares/:slug', async (req, res) => {
        const share = await app.edgeone.get('resumeforge_studio', `share:${cleanText(req.params.slug, 40)}`);
        if (!share || share.active === false) return res.status(404).json({ error: 'Not Found', message: 'Shared resume not found.' });
        share.view_count = Number(share.view_count || 0) + 1; await app.edgeone.put('resumeforge_studio', `share:${share.slug}`, share);
        res.json({ share });
    });
    app.delete('/api/resumeforge/shares/:slug', authenticate, async (req, res) => {
        const key = `share:${cleanText(req.params.slug, 40)}`; const share = await app.edgeone.get('resumeforge_studio', key);
        if (!share || share.user_id !== req.user.id) return res.status(404).json({ error: 'Not Found', message: 'Shared resume not found.' });
        await app.edgeone.put('resumeforge_studio', key, { ...share, active: false, revoked_at: now() });
        res.json({ ok: true });
    });
}

function registerCollectionRoutes(app) {
    app.get('/api/resumeforge/collections', authenticate, async (req, res) => {
        const index = await readIndex(app, req.user.id, 'collections');
        const collections = (await Promise.all(index.map(item => app.edgeone.get('resumeforge_studio', `collection:${req.user.id}:${item.id}`)))).filter(Boolean);
        res.json({ collections });
    });
    app.post('/api/resumeforge/collections', authenticate, async (req, res) => {
        const id = randomUUID(); const timestamp = now();
        const collection = { id, user_id: req.user.id, name: cleanText(req.body?.name, 120) || 'Colecção sem título', description: cleanText(req.body?.description, 500), template_ids: Array.isArray(req.body?.template_ids) ? req.body.template_ids.slice(0, 100).map(v => cleanText(v, 80)) : [], created_at: timestamp, updated_at: timestamp };
        await app.edgeone.put('resumeforge_studio', `collection:${req.user.id}:${id}`, collection);
        const index = await readIndex(app, req.user.id, 'collections'); await writeIndex(app, req.user.id, 'collections', [{ id, updated_at: timestamp }, ...index].slice(0, MAX_COLLECTIONS));
        res.status(201).json({ collection });
    });
    app.put('/api/resumeforge/collections/:id', authenticate, async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Bad Request', message: 'Invalid collection.' });
        const key = `collection:${req.user.id}:${req.params.id}`; const existing = await app.edgeone.get('resumeforge_studio', key); if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Collection not found.' });
        const collection = { ...existing, name: cleanText(req.body?.name ?? existing.name, 120), description: cleanText(req.body?.description ?? existing.description, 500), template_ids: Array.isArray(req.body?.template_ids) ? req.body.template_ids.slice(0, 100).map(v => cleanText(v, 80)) : existing.template_ids, updated_at: now() };
        await app.edgeone.put('resumeforge_studio', key, collection); res.json({ collection });
    });
    app.delete('/api/resumeforge/collections/:id', authenticate, async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ error: 'Bad Request', message: 'Invalid collection.' });
        const key = `collection:${req.user.id}:${req.params.id}`; const existing = await app.edgeone.get('resumeforge_studio', key); if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Collection not found.' });
        await app.edgeone.put('resumeforge_studio', key, null); await writeIndex(app, req.user.id, 'collections', (await readIndex(app, req.user.id, 'collections')).filter(item => item.id !== req.params.id)); res.json({ ok: true });
    });
}

function registerMediaRoutes(app) {
    app.post('/api/resumeforge/media', authenticate, async (req, res) => {
        if (bodySize(req.body) > MAX_BODY_BYTES) return res.status(413).json({ error: 'Payload Too Large', message: 'Media exceeds the maximum size.' });
        const dataUrl = String(req.body?.data_url || ''); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return res.status(400).json({ error: 'Bad Request', message: 'Only PNG, JPEG and WEBP data URLs are accepted.' });
        const id = randomUUID(); const asset = { id, user_id: req.user.id, name: cleanText(req.body?.name, 160) || `asset-${id}.png`, data_url: dataUrl, created_at: now() };
        await app.edgeone.put('resumeforge_studio', `media:${req.user.id}:${id}`, asset); res.status(201).json({ media: { ...asset, data_url: undefined }, url: dataUrl });
    });
}

export default function resumeforgeStudioRoutes(app) { registerDraftRoutes(app); registerShareRoutes(app); registerCollectionRoutes(app); registerMediaRoutes(app); }
