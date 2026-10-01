// lib/edgeone.js — EdgeOne KV Client + Turso SQL Hybrid (v6.5)
// ─────────────────────────────────────────────────────────────────────────────
// EdgeOne Pages Node Functions runtime.
//
// MIGRAÇÃO TURSO (v6):
//   Dados relacionais migraram do KV para Turso (SQLite):
//     • content, seasons, episodes, tags     → Turso
//     • users, profiles, subscriptions       → Turso
//     • channels                             → Turso
//     • my_list                              → Turso
//
//   O que CONTINUA no KV EdgeOne:
//     • session_{token}         → PROGRESS_NS
//     • progress_{profile}...   → PROGRESS_NS (heartbeat por conteúdo)
//     • recent_v2_{profile}     → PROGRESS_NS (1 chave JSON, últimos 20)
//     • rate_{type}_{ip}        → PROGRESS_NS
//     • streamtime_{ipKey}      → PROGRESS_NS
//     • geo_ip_{ip}             → LANG_NS
//     • stealth_playlist_{vid}  → CATALOG_NS
//     • chunk_{...}             → CHUNKS_NS (legacy, não usado pelo player)
//     • refresh_{token}         → USERS_NS
//     • admin_log_...           → USERS_NS
//
//   A API pública do EdgeOneClient MANTÉM-SE IDÊNTICA.
//   Nenhum route handler precisa ser alterado (excepto deleteContent, ver v6.5).
//
// KV rules (from official docs):
//   • key: only [a-zA-Z0-9_], max 512 bytes
//   • value: string | ArrayBuffer | ArrayBufferView | ReadableStream, max 25 MB
//   • put(key, value)                   → Promise<void>  (NO expirationTtl)
//   • get(key, {type?})                 → Promise<string|null>
//   • delete(key)                       → Promise<void>
//   • list({prefix?,limit?,cursor?})    → Promise<{keys:[{key:string},...], complete:boolean, cursor:string|null}>
//
// KV bindings are GLOBAL variables (not env props):
//   globalThis['CATALOG_NS'] — set via EdgeOne Pages dashboard namespace binding.
//
// FIX v6.6:
//   • deleteContent()/_dispatchShardDelete não falam mais directamente com a
//     API do GitHub. Corrigido para chamar o dispatcher (Render) via
//     DISPATCHER_URL + ADMIN_API_KEY — o mesmo serviço que já faz o
//     round-robin entre as 2 contas GH_ACCOUNT_1/2 para disparar process.yml.
//     EdgeOne nunca teve, e não deve ter, tokens do GitHub.
//
// FIX v6.5:
//   • CDN_DOMAIN eliminado por completo. O storage deixou de ser servido
//     atrás de um Worker/CDN (cdn.pixgo.qzz.io) — os segmentos vivem em
//     shards git e são servidos directamente por raw.githubusercontent.com,
//     com a URL completa (owner/repo/branch/job_id) já gravada em
//     stealth_playlist.masterUrl/noncesUrl pelo pipeline. Nada no backend
//     precisa reconstruir essa URL a partir de uma base fixa.
//   • CloudflareCacheWarmer / cfWarmer / rewarmContent() removidos — existiam
//     só para purgar/aquecer o cache do Worker, que já não está no caminho
//     de serving. Confirmmado sem nenhum caller nas rotas (content.js,
//     admin.js, catalog.js).
//   • generateDownloadUrl() removido — construía uma URL sob CDN_DOMAIN para
//     a rota legada `GET /download/:contentId/:quality`, que já devolve
//     410 Gone em routes/content.js. Código morto a par de código morto.
//   • deleteContent(contentId) reescrito: antes só apagava a linha `content`
//     e 1 chave stealth_playlist (a do contentId) — para séries/anime/dorama
//     isso deixava órfãos (cada episódio tem a sua própria chave
//     stealth_playlist_{episodeId}, nunca tocada) e nunca limpava os bytes
//     no shard git. Agora: descobre todas as chaves de playlist relevantes
//     (por episódio, ou a própria se for filme), lê o masterUrl de cada uma
//     para extrair owner/repo/job_id, dispara o workflow shard-delete.yml
//     via GitHub API para cada job_id encontrado, apaga as chaves KV, e só
//     depois limpa as linhas relacionais (episode/season/content_tag/
//     content_translation/content) no Turso.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { getEnv } from './env.js';
import { execute, getOne, getAll, getScalar, bool, json, fromJson } from './turso.js';

// ── KEY SANITIZATION ──────────────────────────────────────────────────────────

function sanitizeKey(part) {
    return String(part).replace(/[^a-zA-Z0-9_]/g, c =>
        'X' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
    );
}

function kvKey(...parts) {
    return parts.map(sanitizeKey).join('_');
}

// ── KV TIMEOUT ────────────────────────────────────────────────────────────────
// Nenhuma operação KV tinha limite de tempo. Rate-limit, sessão, geoip e o
// hot-path do player passam por aqui; um KV lento fazia a request esperar até
// o limite de 30s da plataforma. Agora estoura com ERRO (não com fallback), para
// os try/catch existentes (fail-open no rate-limit, 500 nas rotas) actuarem.
const KV_TIMEOUT_MS = Number(process.env.KV_TIMEOUT_MS) || 1500;

function kvWithTimeout(promise, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`KV timeout após ${KV_TIMEOUT_MS}ms (${label})`)), KV_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function withRetry(fn, attempts = 3, baseDelay = 500) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); }
        catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
        }
    }
    throw lastErr;
}

function log(level, context, message, data = {}) {
    const entry = { ts: new Date().toISOString(), level, context, message, ...data };
    if (level === 'error') console.error(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

// ── SHARD DELETE (dispara shard-delete.yml no GitHub Actions) ──────────────
// Extrai { owner, repo, jobId } de uma URL raw.githubusercontent.com gravada
// em stealth_playlist.masterUrl:
//   https://raw.githubusercontent.com/{owner}/{repo}/storage-main/{job_id}/master.m3u8
function _parseShardFromUrl(masterUrl) {
    const m = /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/storage-main\/([^/]+)\//.exec(masterUrl || '');
    if (!m) return null;
    return { owner: m[1], repo: m[2], jobId: m[3] };
}

// FIX v6.6: EdgeOne NUNCA fala directamente com a API do GitHub — quem tem
// os tokens/contas para disparar Actions é o dispatcher (Render, dispatcher.js),
// o mesmo serviço que já dispara process.yml via round-robin entre as 2
// contas GH_ACCOUNT_1/2. EdgeOne chama o dispatcher pela rota nova
// POST /shard-delete (ver dispatcher.js), autenticada com o MESMO
// ADMIN_API_KEY já usado no resto da plataforma (webhook, /api/pipeline/register).
async function _dispatchShardDelete(repo, jobId) {
    const dispatcherUrl = getEnv('DISPATCHER_URL', '').replace(/\/$/, '');
    const adminKey      = getEnv('ADMIN_API_KEY', '');
    if (!dispatcherUrl) {
        log('error', 'ShardDelete', 'DISPATCHER_URL não configurado no EdgeOne', { repo, jobId });
        return false;
    }
    try {
        const res = await fetch(`${dispatcherUrl}/shard-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': adminKey,
            },
            body: JSON.stringify({ job_id: jobId, shard_repo: repo }),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            log('error', 'ShardDelete', `dispatcher respondeu HTTP ${res.status}`, { jobId, repo, body: t.slice(0, 300) });
            return false;
        }
        return true;
    } catch (err) {
        log('error', 'ShardDelete', 'erro a contactar dispatcher', { message: err.message, jobId, repo });
        return false;
    }
}

// ── HELPERS INTERNOS ─────────────────────────────────────────────────────────

function _parseGenres(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

function _rowToContent(row) {
    if (!row) return null;
    return {
        id:             row.id,
        type:           row.type,
        year:           row.year,
        status:         row.status,
        views:          row.views,
        duration:       row.duration,
        poster:         row.poster || null,
        videoID:        row.video_id || row.id,
        quality:        row.quality || null,
        rating:         row.rating || 0,
        genres:         _parseGenres(row.genres),
        created_at:     row.created_at,
        updated_at:     row.updated_at || null,
        title:          row.title || null,
        title_original: row.title_original || null,
        description:    row.description || null,
        lang:           row.lang || null,
        // PixGo Creative (ligado via /creator-lookup no registo do pipeline —
        // ver [[default]].js /api/pipeline/register):
        uploader_id:      row.uploader_id || null,
        go_creative:      row.go_creative == 1 || row.go_creative === true,
        copyright_status: row.copyright_status || 'clear',
        likes:            row.likes || 0,
    };
}

function _rowToMeta(row) {
    if (!row) return null;
    return {
        rating: row.rating || 0,
        genres: _parseGenres(row.genres),
    };
}

function _rowToUser(row) {
    if (!row) return null;
    return {
        id:              row.id,
        username:        row.username,
        email:           row.email || null,
        password:        row.password,
        name:            row.name || '',
        role:            row.role || 'user',
        plan_id:         row.plan_id || 'free',
        plan_expires_at: row.plan_expires_at || null,
        is_active:       row.is_active == 1 || row.is_active === true,
        failed_logins:   row.failed_logins || 0,
        locked_until:    row.locked_until || null,
        preferences:     fromJson(row.preferences) || {},
        // Identidade Google (login "Continuar com Google") — null para
        // contas tradicionais e para contas ainda não vinculadas.
        google_sub:      row.google_sub || null,
        created_at:      row.created_at,
        updated_at:      row.updated_at || null,
        // PixGo Creative (monetização):
        monetization_status:   row.monetization_status || 'not_eligible',
        maturation_started_at: row.maturation_started_at || null,
    };
}

function _rowToProfile(row) {
    if (!row) return null;
    return {
        id:         row.id,
        user_id:    row.user_id,
        username:   row.username || null,
        name:       row.name,
        avatar:     row.avatar || null,
        language:   row.language || 'en',
        is_kid:     row.is_kid == 1 || row.is_kid === true,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
    };
}

function _rowToSeason(row) {
    if (!row) return null;
    return {
        id:            row.id,
        content_id:    row.content_id,
        number:        row.number,
        episode_count: row.episode_count || 0,
    };
}

function _rowToEpisode(row) {
    if (!row) return null;
    return {
        id:         row.id,
        content_id: row.content_id,
        season_id:  row.season_id,
        number:     row.number,
        title:      row.title || null,
        duration:   row.duration || 0,
    };
}

function _rowToChannel(row) {
    if (!row) return null;
    return {
        id:          row.id,
        name:        row.name,
        logo:        row.logo || null,
        category:    row.category || null,
        country:     row.country || null,
        language:    row.language || null,
        url:         row.url,
        description: row.description || null,
        is_public:   row.is_public == 1 || row.is_public === true,
    };
}

// ── EDGEONE CLIENT ───────────────────────────────────────────────────────────

class EdgeOneClient {
    constructor() {
        this.namespaces = {
            catalog:  'CATALOG_NS',
            channels: 'CHANNELS_NS',
            chunks:   'CHUNKS_NS',
            users:    'USERS_NS',
            progress: 'PROGRESS_NS',
            lang:     'LANG_NS',
        };
        this._plans = null;
    }

    // ── PLANS ─────────────────────────────────────────────────────────────────
    // v3.0 — limpeza de cripto órfã: só Hotmart (cartão/Pix/boleto) continua a
    // existir como forma de pagamento; os campos price_usdt/min_usdt/currency/
    // network/label_usdt (Polygon/USDT) foram removidos — a assinatura real é
    // criada pelo hub (app.pixgo.qzz.io/api-core) via webhook Hotmart, e esta
    // API só LÊ o que já está na tabela `users`/`subscription` partilhada.
    // `price` é o valor real mostrado ao utilizador (BRL) — antes ficava
    // hardcoded no frontend (R$ 6/10/30), agora é servido daqui para não
    // duplicar a fonte de verdade entre backend e frontend.
    get PLANS() {
        if (this._plans) return this._plans;

        this._plans = {
            free: {
                id:'free', name:'Free', price:0, has_ads:true,
                max_profiles:1, max_downloads:0,
                duration_days:null, billing_cycle:null, label:'Gratuito',
                features:['Streaming com anúncios (1h/dia)','1 perfil','Sem downloads','Qualidade HD'],
            },
            // FIX (modal promocional do /catalog, pedido explícito):
            //   • "Canais ao vivo" removido das features dos planos pagos —
            //     os canais (Sinal Aberto) já são abertos e gratuitos para
            //     todos os planos, incluindo o Free (ver channels.infoBody1
            //     no frontend), por isso listá-lo como vantagem exclusiva
            //     do pago era informação incorrecta/desnecessária.
            //   • "Streaming ilimitado" → "Streaming ilimitado por tempo
            //     ilimitado", texto pedido explicitamente para reforçar que
            //     não há tecto de horas/dia nos planos pagos (ao contrário
            //     do Free, que tem limite diário — ver middleware/
            //     rate-limit.js).
            premium: {
                id:'premium', name:'Mensal Premium', price:6.00,
                has_ads:false, max_profiles:2, max_downloads:20, duration_days:30,
                billing_cycle:'monthly', label:'R$ 6,00 / mês',
                features:['Tempo ilimitado','Sem anúncios','2 perfis','Até 20 downloads/mês','Download HD','Qualidade 4K'],
            },
            premium_quarterly: {
                id:'premium_quarterly', name:'Trimestral Premium', price:10.00,
                has_ads:false, max_profiles:4, max_downloads:200, duration_days:90,
                billing_cycle:'quarterly', label:'R$ 10,00 / trimestre',
                features:['Tempo ilimitado','Sem anúncios','4 perfis','Até 200 downloads','Download HD','Qualidade 4K'],
            },
            premium_annual: {
                id:'premium_annual', name:'Anual Premium', price:30.00,
                has_ads:false, max_profiles:6, max_downloads:null, duration_days:365,
                billing_cycle:'annual', label:'R$ 30,00 / ano',
                features:['Tempo ilimitado','Sem anúncios','6 perfis','Downloads ilimitados','Download HD','Qualidade 4K','Melhor valor'],
            },
        };

        // Aliases — utilizadores que assinam via Hotmart no hub central
        // (app.pixgo.qzz.io) ou em qualquer uma das 9 ferramentas Pixgo
        // recebem plan_id 'monthly'/'quarterly'/'annual' (não
        // 'premium'/'premium_quarterly'/'premium_annual'). Mesma conta
        // partilhada (tabela `users` no Turso) — sem este alias, esses
        // planos cairiam em 'free' aqui por não serem reconhecidos.
        this._plans.monthly   = { ...this._plans.premium,          id: 'monthly' };
        this._plans.quarterly = { ...this._plans.premium_quarterly, id: 'quarterly' };
        this._plans.annual    = { ...this._plans.premium_annual,    id: 'annual' };

        return this._plans;
    }

    invalidatePlansCache() { this._plans = null; }

    // ── KV BINDING RESOLVER ───────────────────────────────────────────────────
    _getBinding(namespace) {
        const name    = this.namespaces[namespace];
        if (!name) throw new Error(`Unknown KV namespace: "${namespace}"`);
        const binding = globalThis[name];
        if (!binding) {
            throw new Error(
                `KV binding "${name}" not found. Configure o namespace "${namespace}" no painel do EdgeOne Pages.`
            );
        }
        return binding;
    }

    // ── GENERIC KV OPS ────────────────────────────────────────────────────────

    async get(namespace, key) {
        return kvWithTimeout(this._getBinding(namespace).get(key), `get ${namespace}`);
    }

    async put(namespace, key, value) {
        return kvWithTimeout(this._getBinding(namespace).put(key, value), `put ${namespace}`);
    }

    async delete(namespace, key) {
        return kvWithTimeout(this._getBinding(namespace).delete(key), `delete ${namespace}`);
    }

    async list(namespace, prefix) {
        const b       = this._getBinding(namespace);
        const allKeys = [];
        let cursor;
        do {
            const params = { prefix, limit: 256 };
            if (cursor) params.cursor = cursor;
            const result = await kvWithTimeout(b.list(params), `list ${namespace}`);
            for (const k of result.keys) allKeys.push(k.key);
            if (result.complete) break;
            cursor = result.cursor;
        } while (cursor);
        return allKeys;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CATALOG_NS — MIGRADO PARA TURSO
    // ══════════════════════════════════════════════════════════════════════════

    // FIX: LEFT JOIN sem fallback de idioma devolvia title/description=null
    // sempre que só existisse tradução 'en' e o request chegasse com outro
    // lang (ex: preferência do utilizador, ou middleware de geoIP) — client
    // apps ficavam com nomes de conteúdo em branco mesmo pedindo dados
    // válidos. Este segundo LEFT JOIN traz sempre a tradução 'en' como
    // fallback; COALESCE prefere o idioma pedido quando existir.
    async getContent(contentId, lang = 'en') {
        const row = await getOne(`
            SELECT c.*,
                   COALESCE(ct.title, ct_en.title)                   AS title,
                   COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                   COALESCE(ct.description, ct_en.description)       AS description,
                   COALESCE(ct.lang, ct_en.lang)                     AS lang
            FROM content c
            LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
            LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
            WHERE c.id = ?
        `, [lang, contentId]);
        return _rowToContent(row);
    }

    // ── Busca em lote por id — evita N+1 (ex.: continue-watching, que fazia ─
    // 1 getContent() por item; ver routes/progress.js GET /api/progress/continue).
    // Uma única query com WHERE id IN (...), ordem devolvida igual à de `ids`
    // (a ordem importa — é "mais recente primeiro" no continue-watching).
    async getContentsByIds(ids, lang = 'en') {
        const uniqueIds = [...new Set(ids)].filter(Boolean);
        if (uniqueIds.length === 0) return [];

        const placeholders = uniqueIds.map(() => '?').join(',');
        const rows = await getAll(`
            SELECT c.*,
                   COALESCE(ct.title, ct_en.title)                   AS title,
                   COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                   COALESCE(ct.description, ct_en.description)       AS description,
                   COALESCE(ct.lang, ct_en.lang)                     AS lang
            FROM content c
            LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
            LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
            WHERE c.id IN (${placeholders})
        `, [lang, ...uniqueIds]);

        const byId = new Map(rows.map(r => [r.id, _rowToContent(r)]));
        // Preserva a ordem de entrada, descarta ids que não existem mais
        return ids.map(id => byId.get(id)).filter(Boolean);
    }

    async setContent(contentId, data, lang = 'en') {
        await execute(`
            INSERT INTO content (id, type, year, status, views, duration, poster, video_id, quality, rating, genres, uploader_id, go_creative, copyright_status, likes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT (id) DO UPDATE SET
                type = excluded.type,
                year = excluded.year,
                status = excluded.status,
                views = excluded.views,
                duration = excluded.duration,
                poster = excluded.poster,
                video_id = excluded.video_id,
                quality = excluded.quality,
                rating = COALESCE(excluded.rating, content.rating),
                genres = COALESCE(excluded.genres, content.genres),
                uploader_id = COALESCE(excluded.uploader_id, content.uploader_id),
                go_creative = COALESCE(excluded.go_creative, content.go_creative),
                copyright_status = COALESCE(excluded.copyright_status, content.copyright_status),
                likes = COALESCE(excluded.likes, content.likes),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `, [
            contentId,
            data.type || 'movie',
            data.year || new Date().getFullYear(),
            data.status || 'published',
            data.views || 0,
            data.duration || 0,
            data.poster || '',
            data.videoID || contentId,
            data.quality || '',
            data.rating || 0,
            json(data.genres || []),
            data.uploader_id || null,
            data.go_creative ? 1 : 0,
            data.copyright_status || 'clear',
            data.likes ?? 0,
        ]);

        if (data.title || data.description) {
            await execute(`
                INSERT INTO content_translation (content_id, lang, title, title_original, description)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (content_id, lang) DO UPDATE SET
                    title = excluded.title,
                    title_original = excluded.title_original,
                    description = excluded.description
            `, [
                contentId,
                lang,
                data.title || '',
                data.title_original || data.title || '',
                data.description || '',
            ]);
        }

        return true;
    }

    // ── video_categories — tabela própria pra rain/relaxation/ai/other.
    // Migration feita à mão no Turso (não reaproveita o padrão idempotente
    // do geo-log.js, por pedido explícito):
    //
    //   CREATE TABLE IF NOT EXISTS video_categories (
    //     content_id TEXT PRIMARY KEY REFERENCES content(id),
    //     category   TEXT NOT NULL,
    //     created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    //   );
    //
    // Nunca é chamado fora do fluxo type='video' (rain/relaxation/ai/
    // other) — ver isAmbient em [[default]].js.
    async setVideoCategory(contentId, category) {
        await execute(`
            INSERT INTO video_categories (content_id, category)
            VALUES (?, ?)
            ON CONFLICT (content_id) DO UPDATE SET
                category = excluded.category
        `, [contentId, category]);
        return true;
    }

    async getVideoCategory(contentId) {
        const row = await getOne('SELECT category FROM video_categories WHERE content_id = ?', [contentId]);
        return row?.category || null;
    }

    async getContentMeta(contentId) {
        const row = await getOne('SELECT rating, genres FROM content WHERE id = ?', [contentId]);
        return _rowToMeta(row);
    }

    async setContentMeta(contentId, data) {
        await execute(
            'UPDATE content SET rating = ?, genres = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?',
            [data.rating || 0, json(data.genres || []), contentId]
        );
        return true;
    }

    // FIX: mesmo fallback de idioma do getContent() — sem isto, listagens de
    // catálogo (home, catálogo, latest) vinham com título/descrição em
    // branco sempre que o lang resolvido não tivesse tradução própria.
    async getContentIdsByType(lang, type, year = null, limit = 50, offset = 0) {
        let sql, args;

        if (year) {
            sql = `
                SELECT c.*,
                       COALESCE(ct.title, ct_en.title)                   AS title,
                       COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                       COALESCE(ct.description, ct_en.description)       AS description,
                       COALESCE(ct.lang, ct_en.lang)                     AS lang
                FROM content c
                LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
                LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
                WHERE c.type = ? AND c.year = ? AND c.status = 'published'
                ORDER BY c.year DESC, c.views DESC
                LIMIT ? OFFSET ?
            `;
            args = [lang, type, year, limit, offset];
        } else {
            // FIX (catálogo por tipo a misturar / "não ordenar pelo mais
            // recente" — relatado em /main/catalog, aba "Filmes", mas o
            // mesmo bug afectava TODOS os tipos porque é a mesma função):
            // o ORDER BY anterior só ordenava por created_at para conteúdo
            // dos últimos 14 dias; para tudo o resto (a maioria do
            // catálogo, em qualquer type específico) a segunda CASE dava
            // NULL para todas as linhas por igual, e o critério de
            // desempate que sobrava era RANDOM(). Dois problemas por causa
            // disso: (1) conteúdo mais antigo aparecia fora de ordem
            // cronológica; (2) como RANDOM() é recalculado a cada chamada,
            // a MESMA página (offset/limit) podia devolver itens
            // diferentes — ou repetidos — de um load para o outro, porque
            // o "sort" usado para decidir quem cai em cada página mudava
            // entre pedidos. sort=recent, sem ?year, passa a significar
            // sempre a mesma coisa: created_at mais recente primeiro, com
            // c.id como desempate estável (evita reordenar em empates no
            // mesmo segundo) — sem aleatoriedade nenhuma aqui. A "mistura"
            // pedida para o feed estilo YouTube (/main, ver routes/
            // catalog.js) é feita depois, sobre a página já ordenada e já
            // fechada — nunca ao nível desta query, que serve também o
            // /main/catalog (onde a ordem tem de ser estável e previsível
            // ao paginar).
            sql = `
                SELECT c.*,
                       COALESCE(ct.title, ct_en.title)                   AS title,
                       COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                       COALESCE(ct.description, ct_en.description)       AS description,
                       COALESCE(ct.lang, ct_en.lang)                     AS lang
                FROM content c
                LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
                LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
                WHERE c.type = ? AND c.status = 'published'
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT ? OFFSET ?
            `;
            args = [lang, type, limit, offset];
        }

        const rows = await getAll(sql, args);
        return rows.map(r => _rowToContent(r)).filter(Boolean);
    }

    // FIX: mesmo fallback de idioma — usado por catalog/featured e
    // sort=popular, que também vinham sem título/descrição.
    async getContentIdsByViews(lang, type, limit = 50) {
        let sql, args;

        if (type) {
            sql = `
                SELECT c.*,
                       COALESCE(ct.title, ct_en.title)                   AS title,
                       COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                       COALESCE(ct.description, ct_en.description)       AS description,
                       COALESCE(ct.lang, ct_en.lang)                     AS lang
                FROM content c
                LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
                LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
                WHERE c.type = ? AND c.status = 'published'
                ORDER BY c.views DESC
                LIMIT ?
            `;
            args = [lang, type, limit];
        } else {
            sql = `
                SELECT c.*,
                       COALESCE(ct.title, ct_en.title)                   AS title,
                       COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                       COALESCE(ct.description, ct_en.description)       AS description,
                       COALESCE(ct.lang, ct_en.lang)                     AS lang
                FROM content c
                LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
                LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
                WHERE c.status = 'published'
                ORDER BY c.views DESC
                LIMIT ?
            `;
            args = [lang, limit];
        }

        const rows = await getAll(sql, args);
        return rows.map(r => _rowToContent(r)).filter(Boolean);
    }

    async getContentTags(contentId) {
        const rows = await getAll('SELECT tag FROM content_tag WHERE content_id = ?', [contentId]);
        return rows.map(r => r.tag);
    }

    async setContentTags(contentId, tags) {
        await execute('DELETE FROM content_tag WHERE content_id = ?', [contentId]);
        if (tags.length > 0) {
            const placeholders = tags.map(() => '(?, ?)').join(', ');
            const flatArgs = [];
            for (const tag of tags) flatArgs.push(contentId, tag);
            await execute(`INSERT OR IGNORE INTO content_tag (content_id, tag) VALUES ${placeholders}`, flatArgs);
        }
        return true;
    }

    async getSeason(contentId, seasonNumber) {
        const row = await getOne(
            'SELECT * FROM season WHERE content_id = ? AND number = ?',
            [contentId, seasonNumber]
        );
        return _rowToSeason(row);
    }

    async setSeason(contentId, seasonNumber, data) {
        const seasonId = data.id || `${contentId}_s${seasonNumber}`;
        await execute(`
            INSERT INTO season (id, content_id, number, episode_count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (content_id, number) DO UPDATE SET
                episode_count = excluded.episode_count
        `, [seasonId, contentId, seasonNumber, data.episode_count || 0]);

        return this.getSeason(contentId, seasonNumber);
    }

    async getEpisode(contentId, seasonNumber, episodeNumber) {
        const row = await getOne(`
            SELECT e.* FROM episode e
            JOIN season s ON e.season_id = s.id
            WHERE s.content_id = ? AND s.number = ? AND e.number = ?
        `, [contentId, seasonNumber, episodeNumber]);
        return _rowToEpisode(row);
    }

    async setEpisode(contentId, seasonNumber, episodeNumber, data) {
        const season = await this.getSeason(contentId, seasonNumber);
        if (!season) throw new Error(`Season ${seasonNumber} not found for content ${contentId}`);

        const episodeId = data.id || `${season.id}_e${episodeNumber}`;
        await execute(`
            INSERT INTO episode (id, content_id, season_id, number, title, duration)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (season_id, number) DO UPDATE SET
                title = excluded.title,
                duration = excluded.duration
        `, [episodeId, contentId, season.id, episodeNumber, data.title || '', data.duration || 0]);

        const count = await getScalar('SELECT COUNT(*) FROM episode WHERE season_id = ?', [season.id]);
        await execute('UPDATE season SET episode_count = ? WHERE id = ?', [count, season.id]);

        return this.getEpisode(contentId, seasonNumber, episodeNumber);
    }

    async getEpisodeById(episodeId) {
        const row = await getOne(`
            SELECT e.*, s.content_id, s.number as season_number
            FROM episode e
            JOIN season s ON e.season_id = s.id
            WHERE e.id = ?
        `, [episodeId]);

        if (!row) return null;

        return {
            id:            row.id,
            content_id:    row.content_id,
            season_id:     row.season_id,
            number:        row.number,
            title:         row.title || null,
            duration:      row.duration || 0,
            contentId:     row.content_id,
            seasonNumber:  row.season_number,
            episodeNumber: row.number,
        };
    }

    async getContentByTitle(title, year) {
        const row = await getOne(`
            SELECT c.*, ct.title, ct.title_original, ct.description, ct.lang
            FROM content c
            JOIN content_translation ct ON c.id = ct.content_id
            WHERE ct.title = ? AND c.year = ?
            LIMIT 1
        `, [title, year]);
        return _rowToContent(row);
    }

    async getContentDependencies(contentId) {
        const chunksKeys = await this.list('chunks', kvKey('chunk_content', contentId) + '_');
        const epCount = await getScalar('SELECT COUNT(*) FROM episode WHERE content_id = ?', [contentId]);
        return { hasChunks: chunksKeys.length > 0, hasEpisodes: (epCount || 0) > 0 };
    }

    // FIX v6.5: deleteContent agora limpa TUDO — shard git, KV (incluindo
    // por episódio) e Turso. Antes só apagava a linha `content` e 1 chave
    // de stealth_playlist (a do contentId) — para séries/anime/dorama isso
    // deixava órfãos: cada episódio tem a sua própria chave
    // `stealth_playlist_{episodeId}`, nunca tocada, e os segmentos ficavam
    // para sempre no shard git (o que também inviabiliza o squash de
    // histórico do shard-gc — o HEAD nunca fica só com conteúdo vivo).
    //
    // Fluxo: descobre todas as chaves de playlist relevantes (por episódio,
    // ou a própria se for filme/conteúdo simples), lê o masterUrl de cada
    // uma para extrair {repo, jobId}, dispara shard-delete.yml por job_id
    // encontrado, apaga as chaves KV, só depois limpa as linhas relacionais
    // no Turso.
    //
    async deleteContent(contentId) {
        const isEpisodic = await getScalar(
            'SELECT COUNT(*) FROM season WHERE content_id = ?', [contentId]
        );

        const playlistKeys = [];
        if (isEpisodic > 0) {
            const episodes = await getAll(`
                SELECT e.id FROM episode e
                JOIN season s ON e.season_id = s.id
                WHERE s.content_id = ?
            `, [contentId]);
            for (const ep of episodes) playlistKeys.push(ep.id);
        } else {
            playlistKeys.push(contentId);
        }

        for (const key of playlistKeys) {
            const playlist = await this.getStealthPlaylist(key);
            if (playlist?.masterUrl) {
                const shard = _parseShardFromUrl(playlist.masterUrl);
                if (shard) {
                    const ok = await _dispatchShardDelete(shard.repo, shard.jobId);
                    log(ok ? 'info' : 'error', 'ShardDelete',
                        ok ? `disparado para ${shard.jobId}` : `falhou para ${shard.jobId}`,
                        { key, repo: shard.repo });
                } else {
                    log('error', 'ShardDelete', 'masterUrl não corresponde ao padrão esperado — shard não identificado', { key, masterUrl: playlist.masterUrl });
                }
            }
            await this.delete('catalog', kvKey('stealth_playlist', key));
        }

        await execute('DELETE FROM episode WHERE season_id IN (SELECT id FROM season WHERE content_id = ?)', [contentId]);
        await execute('DELETE FROM season WHERE content_id = ?', [contentId]);
        await execute('DELETE FROM content_tag WHERE content_id = ?', [contentId]);
        await execute('DELETE FROM content_translation WHERE content_id = ?', [contentId]);
        await execute('DELETE FROM content WHERE id = ?', [contentId]);

        return true;
    }

    async getContentStats() {
        const [totalRow, byTypeRows, byLangRows, byYearRows] = await Promise.all([
            getOne('SELECT COUNT(*) as cnt FROM content WHERE status = \'published\''),
            getAll('SELECT type, COUNT(*) as cnt FROM content WHERE status = \'published\' GROUP BY type'),
            getAll('SELECT lang, COUNT(*) as cnt FROM content_translation GROUP BY lang'),
            getAll('SELECT year, COUNT(*) as cnt FROM content WHERE status = \'published\' AND year IS NOT NULL GROUP BY year ORDER BY year DESC'),
        ]);

        const byType = {};
        for (const row of byTypeRows) byType[row.type] = row.cnt;

        const byLang = {};
        for (const row of byLangRows) byLang[row.lang] = row.cnt;

        const byYear = {};
        for (const row of byYearRows) byYear[row.year] = row.cnt;

        return {
            total_content: totalRow?.cnt || 0,
            by_type: byType,
            by_language: byLang,
            by_year: byYear,
        };
    }

    // ── STEALTH PLAYLIST (KEEP IN KV — hot path) ─────────────────────────────
    async getStealthPlaylist(videoID) {
        const v = await this.get('catalog', kvKey('stealth_playlist', videoID));
        return v ? JSON.parse(v) : null;
    }

    async setStealthContentMeta(contentId, meta) {
        await this.put('catalog', kvKey('stealth_playlist', contentId), JSON.stringify(meta));
        return true;
    }

    // ── TAG ───────────────────────────────────────────────────────────────────
    async getTag(tagName) {
        const cnt = await getScalar('SELECT COUNT(*) FROM content_tag WHERE tag = ?', [tagName]);
        return { name: tagName, content_count: cnt || 0 };
    }
    async setTag(_tagName, _data) {
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CHANNELS_NS — MIGRADO PARA TURSO
    // ══════════════════════════════════════════════════════════════════════════

    async getChannel(channelId) {
        const row = await getOne('SELECT * FROM channel WHERE id = ?', [channelId]);
        return _rowToChannel(row);
    }

    async setChannel(channelId, data) {
        await execute(`
            INSERT INTO channel (id, name, logo, category, country, language, url, description, is_public)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                logo = excluded.logo,
                category = excluded.category,
                country = excluded.country,
                language = excluded.language,
                url = excluded.url,
                description = excluded.description
        `, [
            channelId,
            data.name,
            data.logo || '',
            data.category || '',
            data.country || '',
            data.language || data.lang || '',
            data.url || data.stream_url || '',
            data.description || '',
            1,  // is_public
        ]);
        return true;
    }

    async getChannelsByCategory(category, limit = 50) {
        const rows = await getAll(
            'SELECT * FROM channel WHERE category = ? AND is_public = 1 LIMIT ?',
            [category, limit]
        );
        return rows.map(r => _rowToChannel(r));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // USERS_NS — MIGRADO PARA TURSO
    // ══════════════════════════════════════════════════════════════════════════

    async getUser(username) {
        const row = await getOne('SELECT * FROM users WHERE username = ?', [username]);
        return _rowToUser(row);
    }

    async getUserWithPassword(username) {
        return this.getUser(username);
    }

    async getUserById(userId) {
        const row = await getOne('SELECT * FROM users WHERE id = ?', [userId]);
        return _rowToUser(row);
    }

    async getUserByEmail(email) {
        const row = await getOne('SELECT * FROM users WHERE email = ?', [email]);
        return _rowToUser(row);
    }

    // Login "Continuar com Google" — busca por identificador estável (sub)
    // do Google, nunca por e-mail (e-mail pode mudar de dono no Google).
    async getUserByGoogleSub(googleSub) {
        const row = await getOne('SELECT * FROM users WHERE google_sub = ?', [googleSub]);
        return _rowToUser(row);
    }

    async createUser(data) {
        const id  = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        await execute(`
            INSERT INTO users (
                id, username, password, name, email, role, plan_id,
                plan_expires_at, is_active, failed_logins, locked_until,
                preferences, google_sub, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            data.username,
            data.password,
            data.name || '',
            data.email || null,
            data.role || 'user',
            data.plan_id || 'free',
            null,
            1,
            0,
            null,
            json(data.preferences || {}),
            data.google_sub || null,
            now,
            null,
        ]);

        return _rowToUser({
            id,
            username:        data.username,
            password:        data.password,
            name:            data.name || '',
            email:           data.email || null,
            role:            data.role || 'user',
            plan_id:         data.plan_id || 'free',
            plan_expires_at: null,
            is_active:       true,
            failed_logins:   0,
            locked_until:    null,
            preferences:     json(data.preferences || {}),
            google_sub:      data.google_sub || null,
            created_at:      now,
            updated_at:      null,
        });
    }

    async updateUser(username, updates) {
        const user = await this.getUser(username);
        if (!user) return null;

        const fields = [];
        const args   = [];

        const setIf = (col, val) => { fields.push(`${col} = ?`); args.push(val); };

        if ('password'        in updates) setIf('password',        updates.password);
        if ('name'            in updates) setIf('name',            updates.name);
        if ('email'           in updates) setIf('email',           updates.email);
        if ('role'            in updates) setIf('role',            updates.role);
        if ('is_active'       in updates) setIf('is_active',       bool(updates.is_active));
        if ('failed_logins'   in updates) setIf('failed_logins',   updates.failed_logins);
        if ('locked_until'    in updates) setIf('locked_until',    updates.locked_until);
        if ('preferences'     in updates) setIf('preferences',     json(updates.preferences));
        if ('plan_id'         in updates) setIf('plan_id',         updates.plan_id);
        if ('plan_expires_at' in updates) setIf('plan_expires_at', updates.plan_expires_at);
        if ('last_login'      in updates) setIf('last_login',      updates.last_login);
        if ('login_count'     in updates) setIf('login_count',     updates.login_count);
        if ('google_sub'      in updates) setIf('google_sub',      updates.google_sub);

        if (fields.length > 0) {
            fields.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')');
            args.push(username);
            await execute(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, args);
        }

        return this.getUser(username);
    }

    async updateUserPlan(username, planId, expiresAt = null) {
        const result = await execute(
            'UPDATE users SET plan_id = ?, plan_expires_at = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE username = ?',
            [planId, expiresAt, username]
        );
        if (result.rowsAffected === 0) return null;
        return this.getUser(username);
    }

    // ── PixGo Creative — monetização ────────────────────────────────────────
    async updateUserMonetization(userId, { status, maturationStartedAt } = {}) {
        const fields = [];
        const args   = [];
        if (status !== undefined) { fields.push('monetization_status = ?'); args.push(status); }
        if (maturationStartedAt !== undefined) { fields.push('maturation_started_at = ?'); args.push(maturationStartedAt); }
        if (fields.length === 0) return this.getUserById(userId);

        fields.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')');
        args.push(userId);
        await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, args);
        return this.getUserById(userId);
    }

    // ── PixGo Creative — conteúdos por criador ──────────────────────────────
    async getContentsByUploader(uploaderId, { page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;
        const rows = await getAll(
            `SELECT c.*, COALESCE(ct.title, ct_en.title) AS title,
                    COALESCE(ct.description, ct_en.description) AS description
             FROM content c
             LEFT JOIN content_translation ct    ON c.id = ct.content_id AND ct.lang = 'pt'
             LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
             WHERE c.uploader_id = ?
             ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [uploaderId, limit, offset]
        );
        const total = await getScalar('SELECT COUNT(*) FROM content WHERE uploader_id = ?', [uploaderId]);
        return { items: rows.map(_rowToContent), total: total || 0, page, limit };
    }

    async getAllContentsByUploader(uploaderId) {
        // Sem paginação — usado internamente pelo motor de elegibilidade
        // (lib/monetization.js), que precisa de todos os conteúdos do
        // criador para calcular vídeos qualificados/atividade recente.
        const rows = await getAll(
            'SELECT * FROM content WHERE uploader_id = ? ORDER BY created_at DESC',
            [uploaderId]
        );
        return rows.map(_rowToContent);
    }

    // ── PixGo Creative — likes ("Amei") ─────────────────────────────────────
    async likeContent(contentId, userId) {
        const existing = await getOne(
            'SELECT id FROM content_like WHERE content_id = ? AND user_id = ?',
            [contentId, userId]
        );
        if (existing) return { liked: true, already: true };

        await execute(
            'INSERT INTO content_like (id, content_id, user_id, created_at) VALUES (?, ?, ?, strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\'))',
            [crypto.randomUUID(), contentId, userId]
        );
        await execute('UPDATE content SET likes = likes + 1 WHERE id = ?', [contentId]);
        return { liked: true, already: false };
    }

    async unlikeContent(contentId, userId) {
        const result = await execute(
            'DELETE FROM content_like WHERE content_id = ? AND user_id = ?',
            [contentId, userId]
        );
        if (result.rowsAffected > 0) {
            await execute('UPDATE content SET likes = MAX(0, likes - 1) WHERE id = ?', [contentId]);
        }
        return { liked: false };
    }

    async hasUserLiked(contentId, userId) {
        const row = await getOne(
            'SELECT id FROM content_like WHERE content_id = ? AND user_id = ?',
            [contentId, userId]
        );
        return !!row;
    }

    // ── Recomendação — score simples e sustentável pelos dados existentes ──
    // (views + likes + bónus de recência). "Engagement" fica limitado a
    // views/likes por agora — não há ainda um log de watch-time agregado;
    // quando existir, entra aqui como sinal adicional sem mudar a assinatura.
    async getRecommendedContentIds(lang, type, excludeId, limit = 50) {
        const typeClause = type ? 'AND c.type = ?' : '';
        const sql = `
            SELECT c.*,
                   COALESCE(ct.title, ct_en.title)                   AS title,
                   COALESCE(ct.title_original, ct_en.title_original) AS title_original,
                   COALESCE(ct.description, ct_en.description)       AS description,
                   COALESCE(ct.lang, ct_en.lang)                     AS lang,
                   (c.views * 1.0) + (c.likes * 5.0) +
                   (CASE WHEN c.created_at >= datetime('now', '-14 days') THEN 50 ELSE 0 END)
                       AS recommendation_score
            FROM content c
            LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = ?
            LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
            WHERE c.status = 'published' AND c.id != ? ${typeClause}
            ORDER BY recommendation_score DESC, c.created_at DESC
            LIMIT ?
        `;
        const args = type ? [lang, excludeId, type, limit] : [lang, excludeId, limit];
        const rows = await getAll(sql, args);
        return rows
            .map(r => {
                const content = _rowToContent(r);
                if (!content) return null;
                return { ...content, recommendation_score: Math.round((r.recommendation_score || 0) * 100) / 100 };
            })
            .filter(Boolean);
    }

    // ── PixGo Creative /admin — listagem de conteúdos com filtros ───────────
    async getAllContentsFiltered({ type, status, uploaderId, goCreative, copyrightStatus, search, page = 1, limit = 30 } = {}) {
        const offset = (page - 1) * limit;
        const where  = [];
        const args   = [];

        if (type)             { where.push('c.type = ?');             args.push(type); }
        if (status)           { where.push('c.status = ?');           args.push(status); }
        if (uploaderId)       { where.push('c.uploader_id = ?');      args.push(uploaderId); }
        if (goCreative !== undefined && goCreative !== null) { where.push('c.go_creative = ?'); args.push(goCreative ? 1 : 0); }
        if (copyrightStatus)  { where.push('c.copyright_status = ?'); args.push(copyrightStatus); }
        if (search)           { where.push('(ct.title LIKE ? OR ct_en.title LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await getAll(
            `SELECT c.*, COALESCE(ct.title, ct_en.title) AS title
             FROM content c
             LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = 'pt'
             LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
             ${whereSql}
             ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...args, limit, offset]
        );
        const totalRow = await getOne(
            `SELECT COUNT(*) AS cnt FROM content c
             LEFT JOIN content_translation ct    ON c.id = ct.content_id    AND ct.lang = 'pt'
             LEFT JOIN content_translation ct_en ON c.id = ct_en.content_id AND ct_en.lang = 'en'
             ${whereSql}`,
            args
        );

        return { items: rows.map(_rowToContent), total: totalRow?.cnt || 0, page, limit };
    }

    // ── PixGo Creative /admin — correções manuais (likes/views/copyright) ───
    async adminSetContentCounters(contentId, { likes, views } = {}) {
        const fields = [];
        const args   = [];
        if (likes !== undefined) { fields.push('likes = ?'); args.push(Math.max(0, parseInt(likes, 10) || 0)); }
        if (views !== undefined) { fields.push('views = ?'); args.push(Math.max(0, parseInt(views, 10) || 0)); }
        if (fields.length === 0) return this.getContent(contentId);

        fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
        args.push(contentId);
        await execute(`UPDATE content SET ${fields.join(', ')} WHERE id = ?`, args);
        return this.getContent(contentId);
    }

    async adminSetCopyrightStatus(contentId, status) {
        await execute(
            "UPDATE content SET copyright_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            [status, contentId]
        );
        return this.getContent(contentId);
    }

    async getUserPlan(username) {
        const row = await getOne(
            'SELECT plan_id, plan_expires_at FROM users WHERE username = ?',
            [username]
        );
        // FIX: devolver a definição completa do plano (max_profiles, has_ads, name,
        // price, features, etc.) — antes só devolvíamos id/is_active/expires_at, o
        // que deixava o frontend sem forma de saber o limite de perfis de cada
        // assinatura fora do momento do registo (routes/auth.js POST /register já
        // fazia este merge correctamente; login e GET /me, que passam por aqui,
        // não faziam).
        const planId = (row && row.plan_id) || 'free';
        const base   = this.PLANS[planId] || this.PLANS.free;

        if (!row) return { ...base, is_active: false, expires_at: null };

        const plan = {
            ...base,
            id:         planId,
            is_active:  planId !== 'free',
            expires_at: row.plan_expires_at || null,
        };
        if (plan.expires_at) plan.is_active = new Date(plan.expires_at) > new Date();
        return plan;
    }

    async getUserActivePlan(username) {
        if (!username) return null;
        const plan = await this.getUserPlan(username);
        if (!plan) return null;
        if (plan.id === 'free') return plan;
        if (!plan.is_active) return null;
        return plan;
    }

    async getUserPreferences(userId) {
        const user = await this.getUserById(userId);
        return user?.preferences || null;
    }

    async setUserPreference(userId, key, value) {
        await execute(
            `UPDATE users
             SET preferences = JSON_SET(COALESCE(preferences, '{}'), ?, ?),
                 updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?`,
            [`$.${key}`, JSON.stringify(value), userId]
        );
    }

    // ── BRUTE-FORCE LOCKOUT ───────────────────────────────────────────────────
    isAccountLocked(user) {
        if (!user || !user.locked_until) return { locked: false };
        const remaining_ms = new Date(user.locked_until).getTime() - Date.now();
        if (remaining_ms <= 0) return { locked: false };
        return { locked: true, remaining_ms };
    }

    async recordFailedLogin(userId, _ip) {
        await execute(`
            UPDATE users
            SET failed_logins = failed_logins + 1,
                locked_until  = CASE
                    WHEN failed_logins + 1 >= 10
                    THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+15 minutes')
                    ELSE locked_until
                END,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
        `, [userId]);
    }

    async resetFailedLogins(username) {
        await execute(
            'UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE username = ?',
            [username]
        );
    }

    // ── PROFILES ──────────────────────────────────────────────────────────────

    async getProfiles(username) {
        const rows = await getAll(
            `SELECT p.id, p.name, p.avatar, p.is_kid
             FROM profile p
             WHERE p.user_id = (SELECT id FROM users WHERE username = ? LIMIT 1)`,
            [username]
        );
        return rows.map(r => ({
            id:     r.id,
            name:   r.name,
            avatar: r.avatar || null,
            is_kid: r.is_kid == 1 || r.is_kid === true,
        }));
    }

    async getProfile(profileId) {
        const row = await getOne(
            `SELECT p.*, u.username FROM profile p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
            [profileId]
        );
        return _rowToProfile(row);
    }

    async createProfile(username, data) {
        const user = await this.getUser(username);
        if (!user) throw new Error('User not found');
        const plan     = this.PLANS[user.plan_id] || this.PLANS.free;
        const profiles = await this.getProfiles(username);
        if (profiles.length >= plan.max_profiles) {
            throw new Error(`Limite máximo de ${plan.max_profiles} perfil(is) atingido para o plano ${plan.name}.`);
        }

        const id  = crypto.randomBytes(8).toString('hex');
        const now = new Date().toISOString();
        await execute(
            'INSERT INTO profile (id, user_id, name, avatar, language, is_kid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, user.id, data.name, data.avatar || null, data.language || 'en', bool(data.is_kid), now]
        );

        return _rowToProfile({
            id,
            user_id:    user.id,
            username,
            name:       data.name,
            avatar:     data.avatar || null,
            language:   data.language || 'en',
            is_kid:     bool(data.is_kid),
            created_at: now,
            updated_at: null,
        });
    }

    async createProfileFromUser(user, data) {
        const id  = crypto.randomBytes(8).toString('hex');
        const now = new Date().toISOString();
        await execute(
            'INSERT INTO profile (id, user_id, name, avatar, language, is_kid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, user.id, data.name || user.name, data.avatar || null, data.language || 'en', bool(data.is_kid), now]
        );
        return _rowToProfile({
            id,
            user_id:    user.id,
            username:   user.username,
            name:       data.name || user.name,
            avatar:     data.avatar || null,
            language:   data.language || 'en',
            is_kid:     bool(data.is_kid),
            created_at: now,
            updated_at: null,
        });
    }

    async updateProfile(profileId, data) {
        const fields = [];
        const args   = [];

        const setIf = (col, val) => { fields.push(`${col} = ?`); args.push(val); };

        if ('name'     in data) setIf('name',     data.name);
        if ('avatar'   in data) setIf('avatar',   data.avatar);
        if ('language' in data) setIf('language', data.language);
        if ('is_kid'   in data) setIf('is_kid',   bool(data.is_kid));

        if (fields.length > 0) {
            fields.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')');
            args.push(profileId);
            await execute(`UPDATE profile SET ${fields.join(', ')} WHERE id = ?`, args);
        }

        return this.getProfile(profileId);
    }

    async deleteProfile(profileId) {
        await execute('DELETE FROM profile WHERE id = ?', [profileId]);
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SESSIONS (KEEP IN KV — TTL nativo do EdgeOne)
    // ══════════════════════════════════════════════════════════════════════════

    async createSession(sessionId, data) {
        await this.put('progress', kvKey('session', sessionId), JSON.stringify(data));
        const raw = await this.get('progress', kvKey('user_sessions', data.userId)) || '[]';
        const ids = JSON.parse(raw);
        ids.push(sessionId);
        await this.put('progress', kvKey('user_sessions', data.userId), JSON.stringify(ids));
        return true;
    }

    async getSession(sessionId) {
        const v = await this.get('progress', kvKey('session', sessionId));
        return v ? JSON.parse(v) : null;
    }

    async deleteSession(sessionId) {
        const session = await this.getSession(sessionId);
        if (session?.userId) {
            const raw = await this.get('progress', kvKey('user_sessions', session.userId)) || '[]';
            const ids = JSON.parse(raw).filter(id => id !== sessionId);
            await this.put('progress', kvKey('user_sessions', session.userId), JSON.stringify(ids));
        }
        await this.delete('progress', kvKey('session', sessionId));
        return true;
    }

    async deleteAllUserSessions(userId) {
        const raw = await this.get('progress', kvKey('user_sessions', userId)) || '[]';
        const ids = JSON.parse(raw);
        await Promise.all(ids.map(id => this.delete('progress', kvKey('session', id))));
        await this.delete('progress', kvKey('user_sessions', userId));
        return true;
    }

    // ── REFRESH TOKENS (KEEP IN KV) ─────────────────────────────────────────
    async setRefreshToken(userId, token, _days = 364) {
        await this.put('users', kvKey('refresh', token), JSON.stringify({ userId, created_at: new Date().toISOString() }));
        return true;
    }

    async validateRefreshToken(token) {
        const v = await this.get('users', kvKey('refresh', token));
        if (!v) return null;
        return JSON.parse(v).userId || null;
    }

    async deleteRefreshToken(_userId, token) {
        await this.delete('users', kvKey('refresh', token));
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTIONS — MIGRADO PARA TURSO
    // ══════════════════════════════════════════════════════════════════════════

    async getSubscription(userId) {
        return getOne('SELECT * FROM subscription WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
    }

    // Todas as linhas (não só a mais recente) — usado por /api/payments/history.
    // Coluna real é `expires_at` (não `end_date`) e `amount_usdt`/`network`/
    // `tx_hash` continuam a existir na tabela por serem partilhadas com o
    // registo Hotmart (api-core grava network:'hotmart', amount_usdt:NULL,
    // tx_hash:<id da transacção Hotmart> — ver activateSubscriptionFromHotmart
    // no api-core). Não são campos "de cripto" na prática, só nomes de coluna
    // antigos reaproveitados.
    async getSubscriptionHistory(userId) {
        return getAll('SELECT * FROM subscription WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }

    async setSubscription(userId, data) {
        const id  = data.id || crypto.randomUUID();
        const now = new Date().toISOString();
        // BUG REAL corrigido aqui: todo o resto de routes/payments.js constrói o
        // objecto subscription com start_date/end_date/usdt_amount (ver linhas
        // 180-194, 515-521, 542, 558-563) — mas esta função só lia
        // started_at/expires_at/amount_usdt (nomes das colunas SQL, não dos
        // campos do objecto). Resultado: TODA subscrição alguma vez gravada
        // (incluindo pagamentos reais confirmados) ficava com expires_at=NULL e
        // amount_usdt=NULL na tabela `subscription` — só a tabela `users`
        // (plan_expires_at, actualizada à parte em updateUserPlan) tinha a data
        // certa. Aceita as duas convenções, preferindo a que o resto do código
        // já usa.
        await execute(`
            INSERT INTO subscription (id, user_id, plan_id, tx_hash, network, amount_usdt, status, started_at, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                status     = excluded.status,
                expires_at = excluded.expires_at
        `, [
            id,
            userId,
            data.plan_id,
            data.tx_hash || null,
            data.network || null,
            (data.amount_usdt ?? data.usdt_amount) || null,
            data.status || 'active',
            data.started_at || data.start_date || data.activated_at || now,
            data.expires_at || data.end_date || null,
            data.created_at || now,   // necessário para ORDER BY created_at DESC em getSubscription
        ]);
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROGRESS_NS (KEEP IN KV — 1 get/put por operação, sem list)
    // ══════════════════════════════════════════════════════════════════════════

    async getProgress(profileId, contentId, lang = 'en', episodeId = null) {
        const key = kvKey('progress', profileId, contentId, lang, episodeId || '0');
        const v   = await this.get('progress', key);
        return v ? JSON.parse(v) : null;
    }

    async setProgress(profileId, contentId, lang = 'en', episodeId = null, data) {
        // 1. Heartbeat individual por conteúdo (1 put KV)
        await this.put('progress', kvKey('progress', profileId, contentId, lang, episodeId || '0'),
            JSON.stringify({ ...data, updated_at: new Date().toISOString() })
        );

        // 2. Histórico recente — 1 chave JSON por perfil (recent_v2)
        //    1 get + 1 put KV. Sem list(). Máximo 20 itens.
        const RECENT_KEY = kvKey('recent_v2', profileId);
        const MAX_RECENT = 20;

        const raw    = await this.get('progress', RECENT_KEY);
        const recent = raw ? JSON.parse(raw) : [];

        const filtered = recent.filter(r => r.content_id !== contentId);

        const updated = [
            {
                profile_id: profileId,
                content_id: contentId,
                lang,
                episode_id: episodeId || null,
                progress:   data.progress,
                updated_at: new Date().toISOString(),
            },
            ...filtered,
        ].slice(0, MAX_RECENT);

        await this.put('progress', RECENT_KEY, JSON.stringify(updated));
        return true;
    }

    async getRecentProgress(profileId, limit = 20) {
        const raw = await this.get('progress', kvKey('recent_v2', profileId));
        if (!raw) return [];
        const recent = JSON.parse(raw);
        return recent.slice(0, limit);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MY LIST — MIGRADO PARA TURSO
    // ══════════════════════════════════════════════════════════════════════════

    async getMyList(profileId, limit = 100) {
        const rows = await getAll(
            'SELECT profile_id, content_id, added_at FROM my_list WHERE profile_id = ? ORDER BY added_at DESC LIMIT ?',
            [profileId, limit]
        );
        return rows.map(r => ({
            profile_id: r.profile_id,
            content_id: r.content_id,
            added_at:   r.added_at,
        }));
    }

    async addToMyList(profileId, contentId) {
        await execute('INSERT OR IGNORE INTO my_list (profile_id, content_id) VALUES (?, ?)', [profileId, contentId]);
        return true;
    }

    async removeFromMyList(profileId, contentId) {
        await execute('DELETE FROM my_list WHERE profile_id = ? AND content_id = ?', [profileId, contentId]);
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CHUNKS_NS (KEEP IN KV — legacy, não usado pelo player)
    // ══════════════════════════════════════════════════════════════════════════

    async getChunk(contentId, chunkIndex, lang = 'en', quality = '1080p') {
        const v = await this.get('chunks', kvKey('chunk', contentId, lang, quality, String(chunkIndex)));
        return v ? JSON.parse(v) : null;
    }

    async setChunk(contentId, chunkIndex, data, lang = 'en', quality = '1080p') {
        const key = kvKey('chunk', contentId, lang, quality, String(chunkIndex));
        await this.put('chunks', key, JSON.stringify(data));
        await this.put('chunks', kvKey('chunk_content', contentId, lang, quality, String(chunkIndex)), key);
        return true;
    }

    async getChunkByHash(hash) {
        const v = await this.get('chunks', kvKey('chunkhash', hash));
        return v ? JSON.parse(v) : null;
    }

    async setChunkUrls(contentId, urls) {
        await this.put('chunks', kvKey('chunk_urls', contentId), JSON.stringify(urls));
        return true;
    }

    async setChunkByHash(hash, data) {
        await this.put('chunks', kvKey('chunkhash', hash), JSON.stringify(data));
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RATE LIMITING (KEEP IN KV)
    // ══════════════════════════════════════════════════════════════════════════

    async checkRateLimit(ip, type = 'ip', limit = 2000) {
        const key  = kvKey('rate', type, ip);
        const now  = Date.now();
        const winMs = 3600000;
        const raw  = await this.get('progress', key);
        const data = raw ? JSON.parse(raw) : null;
        if (!data || now - data.last_request > winMs) return { allowed: true, remaining: limit };
        const remaining = limit - data.requests;
        return { allowed: remaining > 0, remaining: Math.max(0, remaining), reset: data.last_request + winMs };
    }

    async incrementRateLimit(ip, type = 'ip') {
        const key  = kvKey('rate', type, ip);
        const now  = Date.now();
        const winMs = 3600000;
        const raw  = await this.get('progress', key);
        let data   = raw ? JSON.parse(raw) : null;
        if (!data || now - data.last_request > winMs) data = { requests: 1, last_request: now };
        else data.requests += 1;
        await this.put('progress', key, JSON.stringify(data));
        return data.requests;
    }

    // ── STREAM TIME (KEEP IN KV) ─────────────────────────────────────────────
    async getStreamTime(ipKey) {
        const v = await this.get('progress', kvKey('streamtime', ipKey));
        return v ? JSON.parse(v) : null;
    }

    async setStreamTime(ipKey, data) {
        await this.put('progress', kvKey('streamtime', ipKey), JSON.stringify(data));
        return true;
    }

    // ── GEOIP (KEEP IN KV — LANG_NS) ─────────────────────────────────────────
    async getGeoIP(ip) {
        const v = await this.get('lang', kvKey('geo_ip', ip));
        return v ? JSON.parse(v) : null;
    }

    async setGeoIP(ip, data) {
        await this.put('lang', kvKey('geo_ip', ip), JSON.stringify(data));
        return true;
    }

    // ── ADMIN LOG (KEEP IN KV) ───────────────────────────────────────────────
    async logAdminAction(logData) {
        const key = kvKey('admin_log', String(Date.now()), logData.admin_id);
        await this.put('users', key, JSON.stringify(logData));
        return true;
    }

    async getRecentAdminActions(limit = 10) {
        const keys   = await this.list('users', kvKey('admin_log') + '_');
        const sorted = keys.sort().reverse().slice(0, limit);
        const results = await Promise.all(sorted.map(async key => {
            const v = await this.get('users', key);
            return v ? JSON.parse(v) : null;
        }));
        return results.filter(Boolean);
    }

    // ── PING ─────────────────────────────────────────────────────────────────
    async ping() {
        try {
            const { ping: tursoPing } = await import('./turso.js');
            return await tursoPing();
        } catch {
            return false;
        }
    }

    async getCacheStats() {
        return { hit_rate: 0.95, total_requests: 0, cached_items: 0 };
    }

    // ── USER STATS ───────────────────────────────────────────────────────────
    async getUserStats() {
        const [total, active, paid] = await Promise.all([
            getScalar('SELECT COUNT(*) FROM users'),
            getScalar('SELECT COUNT(*) FROM users WHERE is_active = 1'),
            getScalar('SELECT COUNT(*) FROM users WHERE plan_id != \'free\' AND is_active = 1'),
        ]);
        return {
            total_users:  total  || 0,
            active_users: active || 0,
            paid_users:   paid   || 0,
        };
    }

    // ── DOWNLOAD TOKENS ──────────────────────────────────────────────────────
    // Quota MENSAL (reseta todo mês, decisão explícita do user — "como o
    // ciclo de cobrança") por conta, em cima do gate por plano que já
    // existia. max_downloads: 0 (free, nunca chega aqui), 20 (mensal),
    // 200 (trimestral), null = ilimitado (anual). Guardado em KV
    // ('progress', reaproveitando o namespace já usado por outros
    // contadores neste ficheiro) — eventual consistency é aceitável aqui,
    // não é vector de fraude (mesmo raciocínio da quota de horas grátis).
    monthlyDownloadKey(userId) {
        return kvKey('downloads_month', userId, new Date().toISOString().slice(0, 7)); // YYYY-MM
    }

    async getMonthlyDownloadCount(userId) {
        try {
            const raw = await this.get('progress', this.monthlyDownloadKey(userId));
            return raw ? (parseInt(raw, 10) || 0) : 0;
        } catch {
            return 0;
        }
    }

    async incrementMonthlyDownloadCount(userId) {
        try {
            const current = await this.getMonthlyDownloadCount(userId);
            await this.put('progress', this.monthlyDownloadKey(userId), String(current + 1));
        } catch (err) {
            console.error('[canDownload] falha ao incrementar contador mensal:', err.message);
        }
    }

    async canDownload(username, userId = null) {
        const plan = await this.getUserActivePlan(username);
        if (!plan || plan.id === 'free') {
            return { allowed: false, plan: 'free', quality: null, remaining: 0, max: 0 };
        }
        if (plan.max_downloads == null) { // ilimitado (anual)
            return { allowed: true, plan: plan.id, quality: 'original', remaining: null, max: null };
        }
        const used = userId ? await this.getMonthlyDownloadCount(userId) : 0;
        if (used >= plan.max_downloads) {
            return { allowed: false, plan: plan.id, quality: null, remaining: 0, max: plan.max_downloads, exhausted: true };
        }
        return { allowed: true, plan: plan.id, quality: 'original', remaining: plan.max_downloads - used, max: plan.max_downloads };
    }

    validateDownloadToken(token) {
        if (!token) return null;
        try {
            const dot      = token.lastIndexOf('.');
            if (dot === -1) return null;
            const data     = token.slice(0, dot);
            const sig      = token.slice(dot + 1);
            const secret   = getEnv('DOWNLOAD_TOKEN_SECRET') || getEnv('JWT_SECRET') || '';
            const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
            if (sig.length !== expected.length) return null;
            if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
            const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        } catch { return null; }
    }

    // ── CONTENT REGISTRATION ─────────────────────────────────────────────────
    async registerContent(contentId, meta, _cdnUrls = []) {
        // cdnUrls ignorado: o player lê master.m3u8 → index.m3u8 → .bin directamente
        // via raw.githubusercontent.com. Guardar as URLs individualmente no KV
        // não serve nenhum consumer.
        const langs = meta.available_langs || [meta.lang || 'en'];

        const parsedEpNumbers = String(meta.episodeNumber ?? '')
            .split(',')
            .map(n => parseInt(n.trim(), 10))
            .filter(n => Number.isInteger(n) && n > 0);

        const isEpisodic = ['series', 'anime', 'dorama'].includes(meta.type) &&
                            Number(meta.seasonNumber) > 0 &&
                            parsedEpNumbers.length > 0;

        let existing = null;
        if (isEpisodic) {
            existing = await getOne(
                'SELECT duration, poster, video_id, quality FROM content WHERE id = ?',
                [contentId]
            );
        }

        const contentData = {
            id:          contentId,
            title:       meta.title,
            description: meta.description || '',
            type:        meta.type,
            year:        meta.year || new Date().getFullYear(),
            duration:    isEpisodic ? (existing?.duration ?? meta.duration ?? 0) : (meta.duration || 0),
            poster:      isEpisodic ? (existing?.poster   || meta.thumbnail || '') : (meta.thumbnail || ''),
            quality:     isEpisodic ? (existing?.quality  || meta.qualities?.[0] || '') : (meta.qualities?.[0] || ''),
            status:      'published',
            views:       0,
            created_at:  meta.created_at || new Date().toISOString(),
            videoID:     isEpisodic ? (existing?.video_id || meta.videoID || contentId) : (meta.videoID || contentId),
            rating:      meta.rating || 0,
            genres:      meta.genres || [],
            // PixGo Creative — vem da lookup em /api/pipeline/register (o
            // pipeline em si nunca soube disto, nem precisou de saber):
            uploader_id:      meta.uploaderId || null,
            go_creative:      meta.goCreative === true,
            copyright_status: 'clear',
        };

        const stealthPayload = {
            videoID:      meta.videoID || contentId,
            duration:     meta.duration || 0,
            segmentCount: meta.segmentCount || 0,
            segDuration:  meta.segDuration || 4,
            qualities:    meta.qualities || [],
            width:        meta.width || 0,
            height:       meta.height || 0,
            bitrate:      meta.bitrate || 0,
            codec:        meta.codec || 'h264',
            fps:          meta.fps || 24,
            segExt:       meta.segExt || 'bin',
            encrypted:    meta.encrypted || false,
            encryption:   meta.encryption || null,
            masterUrl:    meta.masterUrl || '',
            noncesUrl:    meta.noncesUrl || '',
        };

        const ops = [
            // Turso: todas as langs em paralelo
            ...langs.map(lang => this.setContent(contentId, contentData, lang)),
        ];

        if (isEpisodic) {
            const seasonNumber = Number(meta.seasonNumber);
            const seasonId = `${contentId}_s${seasonNumber}`;
            for (const epNum of parsedEpNumbers) {
                const episodeId = `${seasonId}_e${epNum}`;
                ops.push(this.setStealthContentMeta(episodeId, stealthPayload));
            }
        } else {
            ops.push(this.setStealthContentMeta(contentId, stealthPayload));
        }

        if (meta.thumbnails?.length > 0) {
            ops.push(
                this.put('catalog', kvKey('content_thumbs', meta.videoID || contentId),
                    JSON.stringify({
                        urls:       meta.thumbnails,
                        primary:    meta.thumbnail || meta.thumbnails[0],
                        updated_at: new Date().toISOString(),
                    })
                )
            );
        }

        await Promise.all(ops);

        if (isEpisodic) {
            const seasonNumber = Number(meta.seasonNumber);
            await this.setSeason(contentId, seasonNumber, {});
            for (const epNum of parsedEpNumbers) {
                await this.setEpisode(contentId, seasonNumber, epNum, {
                    title:    meta.episodeTitle?.trim() || `Episódio ${epNum}`,
                    duration: meta.duration || 0,
                });
            }
        }

        return true;
    }

    // ── SEASON/EPISODE HELPERS ────────────────────────────────────────────────
    async incrementSeasonEpisodeCount(contentId, seasonNumber) {
        await execute(
            'UPDATE season SET episode_count = episode_count + 1 WHERE content_id = ? AND number = ?',
            [contentId, seasonNumber]
        );
        return true;
    }

    async invalidateContentCache(_contentId) {
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ADMIN DASHBOARD — ADIÇÕES (nada acima desta secção foi alterado)
    // ══════════════════════════════════════════════════════════════════════════

    // ── USERS: DELETE (não existia — CRUD estava incompleto) ────────────────
    async deleteUser(username) {
        const user = await this.getUser(username);
        if (!user) return false;

        // Cascata manual — mesmo padrão já usado em deleteContent() acima.
        await execute('DELETE FROM my_list WHERE profile_id IN (SELECT id FROM profile WHERE user_id = ?)', [user.id]);
        await execute('DELETE FROM profile WHERE user_id = ?', [user.id]);
        await execute('DELETE FROM subscription WHERE user_id = ?', [user.id]);
        await execute('DELETE FROM users WHERE id = ?', [user.id]);

        await this.deleteAllUserSessions(user.id).catch(() => {});
        return true;
    }

    // ── SUBSCRIPTIONS: listagem admin (não existia — só GET /me do próprio user) ─
    async getSubscriptionsAdmin({ page = 1, limit = 50, status = null } = {}) {
        const offset = (page - 1) * limit;
        const where  = status ? 'WHERE s.status = ?' : '';
        const args   = status ? [status, limit, offset] : [limit, offset];

        const rows = await getAll(`
            SELECT s.id, s.user_id, u.username, u.email, s.plan_id, s.tx_hash, s.network,
                   s.amount_usdt, s.status, s.started_at, s.expires_at, s.created_at
            FROM subscription s
            JOIN users u ON u.id = s.user_id
            ${where}
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `, args);

        const totalArgs = status ? [status] : [];
        const total = await getScalar(`SELECT COUNT(*) FROM subscription s ${where}`, totalArgs);

        return { rows, total: total || 0 };
    }

    // ── USAGE: agregação por user (não existia — progress só existe por perfil, ──
    // ── em KV, sem endpoint de listagem). Chamado sob-demanda por username, ─────
    // ── nunca varre todos os users de uma vez (custaria N leituras KV). ─────────
    async getUserUsage(username) {
        const profiles = await this.getProfiles(username);
        const results = [];

        for (const p of profiles) {
            const recent = await this.getRecentProgress(p.id, 20);
            const inProgress = recent.filter(r => (r.progress || 0) < 95);
            const completed  = recent.filter(r => (r.progress || 0) >= 95);

            results.push({
                profile_id:        p.id,
                profile_name:      p.name,
                items_in_progress: inProgress.length,
                items_completed:   completed.length,
                last_activity:     recent[0]?.updated_at || null,
                recent_items:      recent,
            });
        }

        return { username, profiles: results };
    }
}

export const edgeone = new EdgeOneClient();
export { withRetry, log, formatFileSize, sanitizeKey, kvKey };