// routes/mylist.js
// FIX v6: my_list migrated to Turso.
//   • addToMyList / removeFromMyList / getMyList already use Turso via edgeone.js.
//   • /check endpoint previously did a direct KV get for a progress-namespace key
//     that is no longer written. Now uses edgeone.getMyList to check membership.

import { authenticate } from '../middleware/auth.js';

async function resolveProfile(app, req, profileId) {
    let targetId = profileId;
    if (!targetId) {
        const profiles = await app.edgeone.getProfiles(req.user.username);
        if (profiles.length === 0) return null;
        targetId = profiles[0].id;
    }
    const profile = await app.edgeone.getProfile(targetId);
    if (!profile || profile.user_id !== req.user.id) return null;
    return { profileId: targetId, profile };
}

// Exportado (Rodada 3, set/2026) para routes/content.js reaproveitar na
// verificação de `in_list` embutida em GET /api/content/:id — mesma lógica,
// sem duplicar.
export { resolveProfile };

export default function (app) {

    // ── GET /api/mylist ──────────────────────────────────────────────────────
    app.get('/api/mylist', authenticate, async (req, res) => {
        const { profileId, page = 1, limit = 20 } = req.query;

        try {
            const resolved = await resolveProfile(app, req, profileId);
            if (!resolved) {
                return res.json({
                    items: [],
                    pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 }
                });
            }

            const mylist  = await app.edgeone.getMyList(resolved.profileId, 500);
            const offset   = (parseInt(page) - 1) * parseInt(limit);
            const paginated = mylist.slice(offset, offset + parseInt(limit));
            const total    = mylist.length;

            const enriched = (await Promise.all(
                paginated.map(async item => {
                    const content = await app.edgeone.getContent(item.content_id, req.language || 'en');
                    if (!content) return null;
                    return {
                        ...item,
                        content: { id: content.id, title: content.title, type: content.type, poster: content.poster, year: content.year, duration: content.duration }
                    };
                })
            )).filter(Boolean);

            res.json({
                items: enriched,
                pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
            });
        } catch (err) {
            console.error('My list error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load my list' });
        }
    });

    // ── POST /api/mylist/add ─────────────────────────────────────────────────
    app.post('/api/mylist/add', authenticate, async (req, res) => {
        const { profileId, contentId } = req.body;
        if (!profileId || !contentId) {
            return res.status(400).json({ error: 'Bad Request', message: 'profileId and contentId are required' });
        }
        try {
            const profile = await app.edgeone.getProfile(profileId);
            if (!profile || profile.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }
            await app.edgeone.addToMyList(profileId, contentId);
            res.json({ success: true });
        } catch (err) {
            console.error('Add to my list error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add to my list' });
        }
    });

    // ── POST /api/mylist/remove ──────────────────────────────────────────────
    app.post('/api/mylist/remove', authenticate, async (req, res) => {
        const { profileId, contentId } = req.body;
        if (!profileId || !contentId) {
            return res.status(400).json({ error: 'Bad Request', message: 'profileId and contentId are required' });
        }
        try {
            const profile = await app.edgeone.getProfile(profileId);
            if (!profile || profile.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
            }
            await app.edgeone.removeFromMyList(profileId, contentId);
            res.json({ success: true });
        } catch (err) {
            console.error('Remove from my list error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove from my list' });
        }
    });

    // ── GET /api/mylist/check/:contentId ─────────────────────────────────────
    // FIX v6: my_list is now in Turso. The old KV key (progress namespace) is
    // no longer written. Check membership via getMyList (single Turso query).
    app.get('/api/mylist/check/:contentId', authenticate, async (req, res) => {
        const { contentId } = req.params;
        const { profileId } = req.query;

        try {
            const resolved = await resolveProfile(app, req, profileId);
            if (!resolved) return res.json({ inList: false });

            // getMyList returns all items for the profile (max 500).
            // For a membership check this is the correct approach — Turso
            // executes a single indexed query; no KV round-trip needed.
            const list   = await app.edgeone.getMyList(resolved.profileId, 500);
            const inList = list.some(item => item.content_id === contentId);

            res.json({ inList, profileId: resolved.profileId });
        } catch (err) {
            console.error('Check my list error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to check my list' });
        }
    });
}