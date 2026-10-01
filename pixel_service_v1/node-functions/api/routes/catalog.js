// routes/catalog.js (v10.0 — set/2026)
// ─────────────────────────────────────────────────────────────────────────────
// v10 (esta rodada):
//   GET /api/catalog, sort=recent, COM ?type (ex.: "Filmes" no /main/catalog):
//   a ordenação vinha de getContentIdsByType() em lib/edgeone.js, cujo SQL
//   usava RANDOM() como critério de desempate para todo o conteúdo com mais
//   de 14 dias — ou seja, quase todo o catálogo por tipo saía embaralhado, e
//   de forma diferente a cada pedido (o que também corrompia a paginação:
//   a mesma página podia trazer itens repetidos ou saltar itens de um load
//   para o outro). Corrigido na origem (edgeone.js): ORDER BY determinístico
//   por created_at, sem RANDOM(). Ver comentário lá para o detalhe.
//   GET /api/catalog(?feed=1), sort=recent, SEM ?type — usado só pela home
//   (/main): mistura local (shuffleWindows), aplicada SOBRE a página já
//   ordenada por mergeTypesRecent/sortByRecency, para dar o efeito "recentes
//   misturados, não em filas por tipo" pedido para a home, ao estilo
//   YouTube — sem tocar na ordenação/paginação usada pelo /main/catalog
//   (que continua estritamente cronológica quando ?feed não é passado).
// v9 (rodada anterior):
//   GET /api/catalog, sort=recent, SEM ?type ("Todos"): antes caía num
//   fallback silencioso para type='movie' — a aba "Todos" nunca mostrava
//   séries/anime/vídeos, só filmes, apesar do nome. Passa a fazer merge de
//   todos os tipos (mergeTypesRecent), ordenado por recência
//   (sortByRecency), com paginação correta sobre o conjunto misturado —
//   mesmo critério que GET /api/catalog/latest já usava sem type, agora
//   partilhado entre os dois em vez de duplicado.
// v7 (Turso-first): ver histórico anterior — todas as queries vão direto ao
// Turso, sem aggregate-cache em KV.
//
// v8 (esta rodada) — duas mudanças, ambas confirmadas por leitura do código
// antes de mexer (nenhuma removida "por suspeita"):
//
//   1. `ads: adsCtx` removido de TODAS as respostas deste ficheiro.
//      Confirmado por grep em todo o frontend_web: nenhum componente lê
//      `.ads` de uma resposta de /api/catalog*. O contexto de anúncios real
//      (pre-roll/mid-roll) já vem só de routes/content.js, que continua
//      intocado. Aqui era peso morto — e pior, ao variar por
//      utilizador/plano, impedia estas rotas de serem cacheadas na borda.
//
//   2. Cache-Control adicionado (antes não existia nenhum nestas rotas).
//      Catálogo de VOD muda pouco — confirmado com o time: um takedown por
//      copyright leva até 24h para sair do ar de qualquer forma, então não
//      há motivo para um TTL de borda mais curto que isso.
//        - /api/catalog, /api/catalog/featured, /api/catalog/latest,
//          /api/catalog/home → max-age=60 (browser), s-maxage=86400 (borda,
//          24h), stale-while-revalidate=3600 (serve stale por mais 1h
//          enquanto revalida em segundo plano, se o EdgeOne suportar SWR).
//        - /api/catalog/genres → estático de verdade (lista fixa no
//          código), max-age=86400 sem risco nenhum de ficar desatualizado.
//      CONFIRMADO em produção (a equipa já testou): mantém-se a regra no
//      edgeone.json a par deste res.set() — não é redundância a eliminar,
//      são duas camadas com papéis diferentes. O res.set() garante o
//      header mesmo que o edgeone.json alguma vez não seja aplicado (ex.:
//      chamada interna, teste local sem o layer de plataforma); a regra do
//      edgeone.json é a que efectivamente evita muitos pedidos de chegarem
//      a esta função de todo. As duas variantes já foram confirmadas com
//      o mesmo valor — se um dia precisarem de mudar o TTL, mudar nos
//      dois sítios.
//
//   3. Novo GET /api/catalog/home — funde featured + latest(movie/series/
//      anime) + popular (5 pedidos HTTP separados, chamados sempre juntos
//      pela home em /main/page.tsx) numa única resposta. "featured" e
//      "popular" já eram literalmente a mesma query (getContentIdsByViews)
//      com limites diferentes — passam a ser UMA só chamada à BD,
//      reaproveitada para as duas fileiras.
//      Os 5 pedidos antigos continuam a existir (usados noutras páginas:
//      /main/catalog, sidebar de /main/watch/[id]) — nada foi removido.
//
// TODAS as queries de catálogo vão direto ao Turso:
//   GET /api/catalog (sort=recent)      → getContentIdsByType(lang, type, null, limit, offset)
//   GET /api/catalog (sort=popular)     → getContentIdsByViews(lang, type|null, limit)
//   GET /api/catalog (sort=recommended) → getRecommendedContentIds(lang, type|null, excludeId, limit)
//   GET /api/catalog (year filter)      → getContentIdsByType(lang, type, year, limit, offset)
//   GET /api/catalog/featured           → getContentIdsByViews(lang, null, limit)
//   GET /api/catalog/latest             → getContentIdsByType(lang, type|'movie', null, limit, 0)
//                                          + merge de todos os tipos quando sem ?type
//   GET /api/catalog/home               → NOVO — funde os 3 de cima numa resposta
//   GET /api/catalog/genres             → estático (inalterado)
// ─────────────────────────────────────────────────────────────────────────────

import { parsePagination } from '../lib/utils.js';
import { cached }          from '../lib/catalog-cache.js';

// FIX (pedido explícito): tipos novos da página de upload (entretenimento,
// finanças, viagens, estudos, cursos) — precisam de estar aqui para
// entrarem no catálogo agregado ("Todos"/home, ver mergeTypesRecent em
// routes/catalog.js) tal como movie/series/etc. já entravam.
const CONTENT_TYPES  = ['movie', 'series', 'documentary', 'dorama', 'anime', 'video', 'entertainment', 'finance', 'travel', 'education', 'courses'];

// ── Restrição de catálogo para perfil infantil ───────────────────────────────
// "Dorama" é a mesma coisa que a superfície já rotula como "Animação" (ver
// rename de superfície já existente) — por isso perfil infantil = só
// anime + dorama, nunca movie/series/documentary.
const KID_SAFE_TYPES = ['anime', 'dorama'];

// Cache-Control partilhado pelas rotas dinâmicas de catálogo (ver nota no
// cabeçalho do ficheiro sobre o porquê destes valores e a Rule Engine).
const CATALOG_CACHE_CONTROL = 'public, max-age=60, s-maxage=86400, stale-while-revalidate=3600';

// profile_id vem do cliente, mas nunca é confiado às cegas: sempre validado
// contra req.user (rota exige sessão) e contra o dono real do perfil na BD.
// Sem user autenticado ou sem profile_id, devolve false (sem restrição) —
// mesmo comportamento neutro que o resto do catálogo já tem para visitantes.
async function isKidProfile(app, req) {
    const profileId = req.query.profile_id;
    if (!profileId || !req.user) return false;
    try {
        const profile = await app.edgeone.getProfile(profileId);
        if (!profile || profile.user_id !== req.user.id) return false;
        return !!profile.is_kid;
    } catch {
        return false;
    }
}

// ── Cache das queries de catálogo (ver lib/catalog-cache.js) ─────────────────
// Só valores conhecidos entram no cache — ?lang=/?type= arbitrários passam direto
// ao Turso (comportamento anterior) em vez de gerar chaves novas.
const CACHEABLE_LANGS = ['pt', 'en'];
const okKey = (lang, type) =>
    CACHEABLE_LANGS.includes(lang) && (type == null || CONTENT_TYPES.includes(type));

function makeCatalogData(edgeone) {
    return {
        getContentIdsByType(lang, type, year, limit, offset) {
            const load = () => edgeone.getContentIdsByType(lang, type, year, limit, offset);
            if (!okKey(lang, type)) return load();
            return cached(`t|${lang}|${type}|${year ?? ''}|${limit}|${offset}`, load);
        },
        getContentIdsByViews(lang, type, limit) {
            const load = () => edgeone.getContentIdsByViews(lang, type, limit);
            if (!okKey(lang, type)) return load();
            return cached(`v|${lang}|${type ?? ''}|${limit}`, load);
        },
        getRecommendedContentIds(lang, type, excludeId, limit) {
            const load = () => edgeone.getRecommendedContentIds(lang, type, excludeId, limit);
            if (!okKey(lang, type) || String(excludeId).length > 64) return load();
            return cached(`r|${lang}|${type ?? ''}|${excludeId}|${limit}`, load);
        },
    };
}

// Pré-aquecimento: corre uma vez no cold start, em segundo plano. Cobre o que a
// home (/api/catalog/home, defaults limit=24) pede — o que TODO visitante novo
// chama. Se o frontend usa outros limits, ajuste aqui (veja a query string real
// nos logs). 3 queries em paralelo no máximo, para não fazer rajada no Turso.
// Pedidos que chegam durante o aquecimento juntam-se à mesma promise (single-flight).
export async function prewarmCatalog(data, { limit = 24 } = {}) {
    const jobs = [];
    for (const lang of CACHEABLE_LANGS) {
        jobs.push(() => data.getContentIdsByViews(lang, null, limit));
        for (const t of ['movie', 'series', 'anime', 'video', 'entertainment', 'finance', 'travel', 'education', 'courses']) {
            jobs.push(() => data.getContentIdsByType(lang, t, null, limit, 0));
        }
    }
    let i = 0;
    const worker = async () => {
        while (i < jobs.length) {
            const job = jobs[i++];
            try { await job(); } catch (err) {
                console.warn('[catalog-cache] prewarm falhou (não fatal):', err?.message);
            }
        }
    };
    await Promise.all([worker(), worker(), worker()]);
}

// Compara dois itens de catálogo por recência (created_at, com fallback
// para year quando created_at não existe) — mais recente primeiro.
// Usado sempre que se junta conteúdo de vários "type" numa lista única
// (GET /api/catalog sem type, GET /api/catalog/latest sem type), para que
// "ordenar por mais recente" signifique sempre a mesma coisa em todo o
// catálogo, e não dependa de cada endpoint reimplementar o critério.
function sortByRecency(a, b) {
    const ta = a.created_at ? new Date(a.created_at).getTime() : (a.year || 0) * 1000;
    const tb = b.created_at ? new Date(b.created_at).getTime() : (b.year || 0) * 1000;
    return tb - ta;
}

// ── Mistura "estilo YouTube" para o feed da home (?feed=1) ──────────────────
// Pedido explícito: a home não deve ser uma fila estritamente cronológica —
// mesmo os itens recentes devem aparecer misturados entre si (não só entre
// tipos diferentes), como a home do YouTube faz.
//
// Importante: isto NUNCA mexe em que itens caem em cada página — só na
// ORDEM DENTRO da página já decidida por mergeTypesRecent/sortByRecency e já
// cortada por offset/limit. Ou seja, é seguro para paginação/infinite-scroll:
// cada página continua a trazer sempre o mesmo conjunto de itens, só a sua
// ordem local é embaralhada — nunca duplica nem salta itens entre páginas.
//
// Técnica: baralha dentro de janelas pequenas e contíguas (WINDOW itens de
// cada vez), preservando a tendência geral "mais recente primeiro" (um item
// nunca sai da sua janela de ~WINDOW posições), mas sem ordem fixa lá dentro.
const MIX_WINDOW = 8;
function shuffleWindows(items) {
    const out = items.slice();
    for (let start = 0; start < out.length; start += MIX_WINDOW) {
        const end = Math.min(start + MIX_WINDOW, out.length);
        // Fisher–Yates só dentro de [start, end)
        for (let i = end - 1; i > start; i--) {
            const j = start + Math.floor(Math.random() * (i - start + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
    }
    return out;
}

// FIX (catálogo "Todos" a misturar sem ordem / a devolver só filmes):
// antes, GET /api/catalog com sort=recent e SEM ?type fazia
// `effectiveType = type || 'movie'` — ou seja, a aba "Todos" do catálogo
// nunca via mais do que filmes, apesar do rótulo. O frontend tapava o
// sintoma com um videoFirst() que empurrava vídeos para o topo
// independentemente da data — o que por sua vez destruía a ordenação
// cronológica (um vídeo de 2020 aparecia antes de um filme de 2026).
// Esta função faz o que faltava: busca `offset+limit` itens de CADA tipo
// (o suficiente para garantir que a página pedida está coberta mesmo
// depois do merge), junta tudo, ordena por sortByRecency, e só depois
// corta a janela [offset, offset+limit) — a paginação fica correcta
// mesmo misturando tipos com volumes diferentes.
async function mergeTypesRecent(data, lang, types, year, limit, offset) {
    const fetchLimit = offset + limit;
    const perType = await Promise.all(
        types.map(t => data.getContentIdsByType(lang, t, year, fetchLimit, 0).catch(() => []))
    );
    const seen   = new Set();
    const merged = [];
    for (const bucket of perType) {
        for (const c of bucket) {
            if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
        }
    }
    merged.sort(sortByRecency);
    return merged.slice(offset, offset + limit);
}

export default function (app) {

    const data = makeCatalogData(app.edgeone);
    if (process.env.CATALOG_PREWARM !== '0') {
        setTimeout(() => prewarmCatalog(data).catch(() => {}), 0);
    }

    // ── GET /api/catalog ──────────────────────────────────────────────────────
    app.get('/api/catalog', async (req, res) => {
        const { type, year, sort = 'recent' } = req.query;
        const { limit, page, offset }          = parsePagination(req.query);
        const lang                             = req.query.lang || req.language || 'en';

        try {
            const kidMode = await isKidProfile(app, req);
            res.set('Cache-Control', CATALOG_CACHE_CONTROL);

            // ── sort=popular → ordenado por views ─────────────────────────────
            if (sort === 'popular') {
                if (kidMode && type && !KID_SAFE_TYPES.includes(type)) {
                    return res.json({ items: [], pagination: { page, limit, total: 0, pages: 1 }, language: lang });
                }
                let items;
                if (kidMode && !type) {
                    const perType = await Promise.all(
                        KID_SAFE_TYPES.map(t => data.getContentIdsByViews(lang, t, limit).catch(() => []))
                    );
                    items = perType.flat().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limit);
                } else {
                    items = await data.getContentIdsByViews(lang, type || null, limit);
                }
                return res.json({
                    items,
                    pagination: { page, limit, total: items.length, pages: 1 },
                    language:   lang,
                });
            }

            // ── sort=recommended → motor de recomendação (Rodada 3) ────────────
            // Score calculado no servidor (views + likes + recência) — o
            // frontend só consome, nunca recalcula. ?exclude=<id> tira o
            // próprio conteúdo da lista (ex.: sidebar da página de watch).
            if (sort === 'recommended') {
                const excludeId = req.query.exclude || null;
                if (!excludeId) {
                    return res.status(400).json({ error: 'exclude é obrigatório para sort=recommended' });
                }
                if (kidMode && type && !KID_SAFE_TYPES.includes(type)) {
                    return res.json({ items: [], pagination: { page, limit, total: 0, pages: 1 }, language: lang });
                }
                const items = await data.getRecommendedContentIds(lang, type || null, excludeId, limit);
                return res.json({
                    items,
                    pagination: { page, limit, total: items.length, pages: 1 },
                    language:   lang,
                });
            }

            // ── sort=recent, filtro year opcional ─────────────────────────────
            if (kidMode && type && !KID_SAFE_TYPES.includes(type)) {
                return res.json({ items: [], pagination: { page, limit, total: 0, pages: 1 }, language: lang });
            }
            const yearInt = year ? parseInt(year) : null;

            if (!type) {
                // "Todos" — mistura todos os tipos (ou só os kid-safe em
                // perfil infantil), ordenados por mais recente. Ver
                // mergeTypesRecent() acima: substitui o antigo fallback
                // silencioso para 'movie' que fazia esta aba nunca mostrar
                // séries/anime/vídeos, e a ordenação vem de sortByRecency,
                // não de nenhuma reordenação por tipo feita no frontend.
                const typesToMerge = kidMode ? KID_SAFE_TYPES : CONTENT_TYPES;
                let items = await mergeTypesRecent(data, lang, typesToMerge, yearInt, limit, offset);
                // ?feed=1 — só a home (/main) usa isto (ver shuffleWindows
                // acima). O /main/catalog (aba "Todos") não manda ?feed,
                // por isso continua estritamente cronológico.
                if (req.query.feed === '1') items = shuffleWindows(items);
                // total heurístico, igual ao resto do ficheiro: página cheia
                // sugere que há mais para vir.
                const total = items.length === limit ? offset + limit + 1 : offset + items.length;
                return res.json({
                    items,
                    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
                    language:   lang,
                });
            }

            const items   = await data.getContentIdsByType(
                lang, type, yearInt, limit, offset
            );
            // total heurístico: se veio uma página cheia há provavelmente mais
            const total = items.length === limit ? offset + limit + 1 : offset + items.length;
            return res.json({
                items,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
                language:   lang,
            });

        } catch (err) {
            console.error('Catalog error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load catalog' });
        }
    });

    // ── GET /api/catalog/featured ─────────────────────────────────────────────
    app.get('/api/catalog/featured', async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const lang  = req.query.lang || req.language || 'en';
        try {
            const kidMode = await isKidProfile(app, req);

            let items;
            if (kidMode) {
                const perType = await Promise.all(
                    KID_SAFE_TYPES.map(t => data.getContentIdsByViews(lang, t, limit).catch(() => []))
                );
                items = perType.flat().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limit);
            } else {
                items = await data.getContentIdsByViews(lang, null, limit);
            }

            res.set('Cache-Control', CATALOG_CACHE_CONTROL);
            return res.json({ items, language: lang });
        } catch (err) {
            console.error('Featured error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load featured content' });
        }
    });

    // ── GET /api/catalog/latest ───────────────────────────────────────────────
    // Com ?type → 1 query Turso para esse tipo.
    // Sem ?type → 1 query por tipo + merge ordenado por created_at/year.
    app.get('/api/catalog/latest', async (req, res) => {
        const { type } = req.query;
        const limit    = Math.min(parseInt(req.query.limit) || 20, 100);
        const lang     = req.query.lang || req.language || 'en';
        try {
            const kidMode = await isKidProfile(app, req);
            res.set('Cache-Control', CATALOG_CACHE_CONTROL);

            if (kidMode && type && !KID_SAFE_TYPES.includes(type)) {
                return res.json({ items: [], language: lang });
            }

            let items;
            if (type) {
                items = await data.getContentIdsByType(lang, type, null, limit, 0);
            } else {
                // Merge dos tipos mais recentes — equivalente ao _buildLatest anterior.
                // Perfil infantil: só faz merge de anime+dorama, nunca dos outros tipos.
                const typesToMerge = kidMode ? KID_SAFE_TYPES : CONTENT_TYPES;
                const perType = await Promise.all(
                    typesToMerge.map(t =>
                        data.getContentIdsByType(lang, t, null, limit, 0).catch(() => [])
                    )
                );
                const seen   = new Set();
                const merged = [];
                for (const bucket of perType) {
                    for (const c of bucket) {
                        if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
                    }
                }
                merged.sort(sortByRecency);
                items = merged.slice(0, limit);
            }

            return res.json({ items, language: lang });
        } catch (err) {
            console.error('Latest error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load latest content' });
        }
    });

    // ── GET /api/catalog/home (novo, Rodada 2) ────────────────────────────────
    // Funde featured + popular + latest(movie/series/anime) — as 5 chamadas
    // que /main/page.tsx sempre faz juntas — numa única resposta.
    // "featured" e "popular" partilham a MESMA query (getContentIdsByViews);
    // antes eram 2 pedidos HTTP + 2 idas ao Turso para o mesmo dado, agora
    // é uma só, cortada em dois tamanhos.
    app.get('/api/catalog/home', async (req, res) => {
        const lang          = req.query.lang || req.language || 'en';
        const limit         = Math.min(parseInt(req.query.limit) || 24, 50);
        const featuredLimit = Math.min(parseInt(req.query.featured_limit) || 6, 20);

        try {
            const kidMode = await isKidProfile(app, req);

            const fetchType = (type) => (kidMode && !KID_SAFE_TYPES.includes(type))
                ? Promise.resolve([])
                : data.getContentIdsByType(lang, type, null, limit, 0).catch(() => []);

            const fetchPopular = async () => {
                if (!kidMode) return data.getContentIdsByViews(lang, null, limit);
                const perType = await Promise.all(
                    KID_SAFE_TYPES.map(t => data.getContentIdsByViews(lang, t, limit).catch(() => []))
                );
                return perType.flat().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limit);
            };

            const [popular, movies, series, anime, videos] = await Promise.all([
                fetchPopular(),
                fetchType('movie'),
                fetchType('series'),
                fetchType('anime'),
                fetchType('video'),
            ]);

            res.set('Cache-Control', CATALOG_CACHE_CONTROL);
            return res.json({
                featured: popular.slice(0, featuredLimit),
                popular,
                latest: { movie: movies, series, anime, video: videos },
                language: lang,
            });
        } catch (err) {
            console.error('Catalog home error:', err);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load home catalog' });
        }
    });

    // ── GET /api/catalog/genres ───────────────────────────────────────────────
    // Lista fixa no código — cache longo sem risco (não muda sem um deploy).
    app.get('/api/catalog/genres', (_req, res) => {
        res.set('Cache-Control', 'public, max-age=86400');
        res.json([
            'Action', 'Adventure', 'Comedy', 'Drama', 'Sci-Fi',
            'Horror', 'Romance', 'Thriller', 'Documentary', 'Animation',
            'Fantasy', 'Mystery', 'Crime', 'War', 'History',
            'Western', 'Musical', 'Sport', 'Family', 'Police',
        ]);
    });
}
