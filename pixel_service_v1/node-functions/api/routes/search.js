// routes/search.js (v7.0 — Turso-first)
// ─────────────────────────────────────────────────────────────────────────────
// REMOVIDO em v7:
//   • aggregate-cache (KV) — toda dependência eliminada
//   • caminho rápido via suggest KV (getAggregate ['suggest', lang])
//   • import de getAggregate
//
// TODAS as queries de search vão direto ao Turso:
//
//   GET /api/search:
//     Faz getContentIdsByType para cada tipo relevante (ou só o ?type pedido),
//     filtra por título/descrição/original em memória, aplica genre se pedido.
//     Sem duplo-fetch: getContentIdsByType já devolve o objeto completo.
//
//   GET /api/search/suggest:
//     getContentIdsByViews(lang, null, SUGGEST_LIMIT) → 1 query Turso indexada
//     ordenada por views. Filtra por título em memória. Rápido e sem KV.
//
//   GET /api/search/popular:
//     Estático (inalterado).
// ─────────────────────────────────────────────────────────────────────────────

import { parsePagination } from '../lib/utils.js';

const CONTENT_TYPES = ['movie', 'series', 'documentary', 'dorama', 'anime', 'video', 'entertainment', 'finance', 'travel', 'education', 'courses'];

const SUGGEST_LIMIT = 200; // itens a buscar do Turso para filtrar o suggest
const SCAN_LIMIT    = 200; // itens por tipo no fallback de search

export default function (app) {

    // ── GET /api/search ──────────────────────────────────────────────────────
    app.get('/api/search', async (req, res) => {
        const { q, type, year, genre } = req.query;
        const lang = req.query.lang || req.language || 'en';

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Query parameter "q" is required' });
        }

        const { limit, page, offset } = parsePagination(req.query);
        const query   = q.toLowerCase().trim();
        const yearInt = year ? parseInt(year) : null;

        try {
            const typesToScan = type ? [type] : CONTENT_TYPES;

            // 1 query por tipo — getContentIdsByType já faz JOIN com translation
            const allContent = (await Promise.all(
                typesToScan.map(t =>
                    app.edgeone.getContentIdsByType(lang, t, yearInt, SCAN_LIMIT, 0).catch(() => [])
                )
            )).flat();

            const results = [];
            for (const content of allContent) {
                if (!content) continue;

                const titleMatch = content.title?.toLowerCase().includes(query);
                const origMatch  = (content.title_original || '').toLowerCase().includes(query);
                const descMatch  = (content.description   || '').toLowerCase().includes(query);

                if (!titleMatch && !origMatch && !descMatch) continue;

                // Filtro genre — getContentMeta só para items que passaram o título
                if (genre) {
                    const meta = await app.edgeone.getContentMeta(content.id).catch(() => null);
                    if (!meta?.genres?.includes(genre)) continue;
                }

                results.push(content);

                // parar cedo quando já temos candidatos suficientes
                if (results.length >= offset + limit * 3) break;
            }

            res.json({
                results:    results.slice(offset, offset + limit),
                pagination: { page, limit, total: results.length, pages: Math.ceil(results.length / limit) },
                query:      { q, type, year, genre },
                language:   lang,
            });
        } catch (err) {
            console.error('Search error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Search failed' });
        }
    });

    // ── GET /api/search/suggest ──────────────────────────────────────────────
    app.get('/api/search/suggest', async (req, res) => {
        const { q } = req.query;
        const lang  = req.query.lang || req.language || 'en';

        if (!q || q.trim().length < 2) return res.json([]);

        const query = q.toLowerCase().trim();

        try {
            // 1 query Turso ordenada por views — candidatos mais relevantes primeiro
            const rows = await app.edgeone.getContentIdsByViews(lang, null, SUGGEST_LIMIT).catch(() => []);

            const suggestions = [];
            for (const c of rows) {
                if (suggestions.length >= 10) break;
                if (!c?.title) continue;
                if (
                    c.title.toLowerCase().includes(query) ||
                    (c.title_original || '').toLowerCase().includes(query)
                ) {
                    suggestions.push({
                        id:     c.id,
                        value:  c.title,
                        type:   c.type,
                        year:   c.year,
                        poster: c.poster || null,
                    });
                }
            }
            res.json(suggestions);
        } catch (err) {
            console.error('Suggest error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get suggestions' });
        }
    });

    // ── GET /api/search/popular ──────────────────────────────────────────────
    app.get('/api/search/popular', (_req, res) => {
        res.json([
            { term: 'action',      count: 1250 },
            { term: 'comedy',      count: 980  },
            { term: 'drama',       count: 850  },
            { term: 'horror',      count: 720  },
            { term: 'romance',     count: 650  },
            { term: 'anime',       count: 540  },
            { term: 'series',      count: 480  },
            { term: 'documentary', count: 320  },
            { term: 'adventure',   count: 290  },
            { term: 'sci-fi',      count: 210  },
        ]);
    });
}