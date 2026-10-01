// ADD THIS ENDPOINT to routes/channels.js (inside the export default function)
// Place AFTER the GET /api/channels route and BEFORE the POST /api/channels/refresh route

// ── GET /api/channels/search ──────────────────────────────────────────────
// Searches ALL channels (bypasses pagination) — used by frontend search
app.get('/api/channels/search', async (req, res) => {
    const { q = '' } = req.query;
    const query = q.toLowerCase().trim();

    try {
        const { ready, channels } = await getCachedPlaylist(app.edgeone);

        if (!ready) {
            return res.json({ channels: [], total: 0, loading: true, retry_ms: 2000 });
        }

        const user = req.user || null;

        let filtered = channels;
        if (query) {
            filtered = channels.filter(ch =>
                ch.name.toLowerCase().includes(query) ||
                (ch.group  || '').toLowerCase().includes(query) ||
                (ch.country  || '').toLowerCase().includes(query) ||
                (ch.language || '').toLowerCase().includes(query)
            );
        }

        const mapped = filtered.slice(0, 200).map(ch => {
            if (!user) {
                return { id: ch.id, name: ch.name, logo: ch.logo, group: ch.group, has_access: false, locked: true };
            }
            return { id: ch.id, name: ch.name, logo: ch.logo, group: ch.group, country: ch.country, language: ch.language, url: ch.url, has_access: true };
        });

        res.set({ 'Cache-Control': 'private, no-store' });
        res.json({ channels: mapped, total: mapped.length });

    } catch (err) {
        console.error('[channels/search] error:', err.message);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to search channels' });
    }
});
