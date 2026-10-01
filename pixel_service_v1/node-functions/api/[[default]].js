// cloud-functions/api/[[default]].js — StreamPlatform Entry Point v7.1
// ─────────────────────────────────────────────────────────────────────────────
// EdgeOne Pages Node Functions — Framework mode (Express).
//
// Rules for Node Functions framework mode:
//   • Do NOT start an HTTP server or call app.listen()
//   • Do NOT export `fetch` or use Cloudflare Worker handler patterns
//   • Export the Express instance as `export default app`
//   • Environment variables are read from process.env (standard Node.js)
//   • KV bindings are global variables — accessed via globalThis[bindingName]
//   • No setEnv() / bindEnv() calls needed
// ─────────────────────────────────────────────────────────────────────────────

import express          from 'express';
import helmet           from 'helmet';
import cookieParser     from 'cookie-parser';
import jwt              from 'jsonwebtoken';
import { randomBytes }  from 'crypto';

import { getEnv }                                from './lib/env.js';
import { edgeone }                               from './lib/edgeone.js';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lib/geoip.js';
import { noStoreMiddleware }                     from './lib/no-store.js';
import { rateLimitMiddleware }                   from './middleware/rate-limit.js';
import { languageDetector }                      from './middleware/language.js';
import { optionalAuth }                          from './middleware/auth.js';

import authRoutes     from './routes/auth.js';
import catalogRoutes  from './routes/catalog.js';
import contentRoutes  from './routes/content.js';
import searchRoutes   from './routes/search.js';
import channelsRoutes from './routes/channels.js';
import progressRoutes from './routes/progress.js';
import mylistRoutes   from './routes/mylist.js';
import paymentsRoutes from './routes/payments.js';
import adminRoutes    from './routes/admin.js';
import geoRoutes       from './routes/geo.js';
import creatorRoutes  from './routes/creator.js';
import legalRoutes    from './routes/legal.js';

// ── Rede de segurança de último recurso (nível de processo) ──────────────────
// FIX (crash em produção): Express 4 não captura erros de handlers/middlewares
// `async`. Já corrigimos os pontos identificados (middleware/rate-limit.js),
// mas isto é um cinto-de-segurança para qualquer
// rota ainda não auditada (auth.js, catalog.js, payments.js, admin.js, etc.):
// sem um listener de 'unhandledRejection', o Node.js (desde a v15) trata uma
// promise rejeitada sem .catch() como uma excepção não apanhada e MATA O
// PROCESSO INTEIRO — é isso que fazia a instância "cair e voltar sozinha
// depois de um tempinho". Registar o listener evita essa morte automática;
// o erro é logado, e a request específica que o causou pode ficar pendente/
// com timeout (o cliente vê um erro), mas a instância continua viva para
// todas as outras. Isto NÃO substitui corrigir os handlers individuais —
// é a última linha de defesa, não a primeira.
process.on('unhandledRejection', (reason) => {
    console.error('[fatal] Unhandled Promise Rejection (processo NÃO foi derrubado, mas corrija a origem):', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
    console.error('[fatal] Uncaught Exception (processo NÃO foi derrubado, mas corrija a origem):', err?.stack || err);
});

// ── Startup checks ────────────────────────────────────────────────────────────
// FIX #14: JWT_SECRET e COOKIE_SECRET são bloqueantes — sem eles o servidor
// não pode funcionar correctamente. Lançamos erro fatal para evitar que a
// instância suba e falhe mais tarde com mensagens crypticas.

function startupChecks() {
    const fatal = [];
    const warn  = [];

    for (const key of ['JWT_SECRET', 'COOKIE_SECRET']) {
        if (!getEnv(key)) fatal.push(key);
    }
    if (!getEnv('ADMIN_API_KEY_MASTER')) warn.push('ADMIN_API_KEY_MASTER');
    if (!getEnv('SCAN_ALLOWED_IPS'))     warn.push('SCAN_ALLOWED_IPS');

    for (const key of warn) {
        console.warn(`[startup] WARNING: ${key} is not set.`);
    }

    if (fatal.length > 0) {
        // Em serverless, throw no módulo principal impede o cold start e aparece
        // nos logs da plataforma — muito mais útil que erros em runtime.
        throw new Error(`[startup] FATAL: variáveis obrigatórias não configuradas: ${fatal.join(', ')}. O servidor não pode iniciar.`);
    }
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

function jwtSecret()    {
    const s = getEnv('JWT_SECRET');
    if (!s) throw new Error('[auth] JWT_SECRET not configured');
    return s;
}
function jwtAccessTTL() { return getEnv('JWT_ACCESS_TTL', '365d'); }

// ── ECDH key exchange (server-side) ──────────────────────────────────────────

async function serverECDH(clientPubKeyBytes, videoID, userID) {
    const serverKeyPair = await globalThis.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const clientPubKey = await globalThis.crypto.subtle.importKey(
        'raw', clientPubKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const sharedBits = await globalThis.crypto.subtle.deriveBits(
        { name: 'ECDH', public: clientPubKey }, serverKeyPair.privateKey, 256
    );
    const hkdfKey    = await globalThis.crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const contentKey = await globalThis.crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: Buffer.from(videoID + userID), info: Buffer.from('content-key') },
        hkdfKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt']
    );
    const serverPubBytes = await globalThis.crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
    return { serverPubKey: new Uint8Array(serverPubBytes), contentKey };
}

function b64encode(buf) { return Buffer.from(buf).toString('base64'); }
function b64decode(str) { return Buffer.from(str, 'base64'); }

function isValidAdminKey(key) {
    if (!key) return false;
    const master = getEnv('ADMIN_API_KEY_MASTER');
    const backup = getEnv('ADMIN_API_KEY_BACKUP');
    if (!master) return false;
    return key === master || (backup && key === backup);
}

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp() {
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    app.use((req, res, next) => {
        const secret = getEnv('COOKIE_SECRET');
        if (!secret) return res.status(500).json({ error: 'Server misconfiguration: COOKIE_SECRET' });
        cookieParser(secret)(req, res, next);
    });

    // Normalise paths
    app.use((req, res, next) => {
        const publicPaths = ['/health', '/api/languages'];
        const isPublic    = publicPaths.some(p => req.path === p || req.path.startsWith(p));
        if (!isPublic && !req.path.startsWith('/api')) req.url = '/api' + req.url;
        next();
    });

    // CORS
    // FIX #9: quando não há header Origin (requests server-to-server), não enviar
    // Access-Control-Allow-Origin nem Allow-Credentials — evita violação da spec
    // que proibia o par '*' + credentials: true.
    const ALLOWED_ORIGINS = [
        'https://www.pixgo.qzz.io',    'https://pixgo.qzz.io',    'https://api.pixgo.qzz.io',
        'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
    ];
    app.use((req, res, next) => {
        const origin    = req.headers.origin || '';
        const isDynamic = /^https:\/\/([a-z0-9-]+\.)*pixgo\.qzz\.io$/.test(origin) ||
                          /^https:\/\/[a-z0-9-]+\.edgeone\.dev$/.test(origin);
        const allowed   = ALLOWED_ORIGINS.includes(origin) || isDynamic;

        if (origin && allowed) {
            // Origin presente e na allowlist: resposta completa com credentials
            res.setHeader('Access-Control-Allow-Origin',      origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        } else if (!origin) {
            // Sem header Origin (curl, server-to-server, etc.): sem CORS headers.
            // Não enviar Allow-Origin nem Credentials — não é uma request cross-origin.
        } else {
            // Origin presente mas não permitida: bloquear (não enviar headers de permissão)
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, Accept-Language, Cookie, X-Device-Fp');
        res.setHeader('Access-Control-Max-Age',       '86400');
        res.setHeader('Vary', 'Origin');

        if (req.method === 'OPTIONS') return res.status(204).end();
        next();
    });

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc:  ["'self'"],
                styleSrc:    ["'self'", "'unsafe-inline'"],
                scriptSrc:   ["'self'"],
                imgSrc:      ["'self'", 'data:', 'https:'],
                connectSrc:  ["'self'", 'https:', 'http://localhost:3000', 'http://localhost:3001'],
                mediaSrc:    ["'self'", 'https:', getEnv('CDN_DOMAIN', '')].filter(Boolean),
                frameSrc:    ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // Attach services
    app.edgeone = edgeone;
    app.jwt = {
        sign:   (payload, options = {}) => jwt.sign(payload, jwtSecret(), { expiresIn: jwtAccessTTL(), ...options }),
        verify: (token)                  => jwt.verify(token, jwtSecret()),
    };
    app.serverECDH = async (clientPubKeyBytes, videoID, userID) => {
        const { serverPubKey, contentKey } = await serverECDH(clientPubKeyBytes, videoID, userID);
        const rawKey = await globalThis.crypto.subtle.exportKey('raw', contentKey).catch(() => null);
        return {
            keyHex:       rawKey ? Buffer.from(rawKey).toString('hex') : null,
            serverPubB64: Buffer.from(serverPubKey).toString('base64'),
        };
    };

    // Global middleware
    // Headers no-store ANTES de tudo (incl. rate-limit) — ver lib/no-store.js
    app.use(noStoreMiddleware);
    app.use(languageDetector);
    app.use(optionalAuth);
    app.use(rateLimitMiddleware);

    // Routes
    authRoutes(app);
    catalogRoutes(app);
    contentRoutes(app);
    searchRoutes(app);
    channelsRoutes(app);
    progressRoutes(app);
    mylistRoutes(app);
    paymentsRoutes(app);
    adminRoutes(app);
    geoRoutes(app);
    creatorRoutes(app);
    legalRoutes(app);

    // ── Health check ─────────────────────────────────────────────────────────
    app.get('/health', async (req, res) => {
        const kvOk = await edgeone.ping().catch(() => false);
        res.json({ status: kvOk ? 'ok' : 'degraded', kv: kvOk, timestamp: new Date().toISOString() });
    });

    // ── Supported languages ───────────────────────────────────────────────────
    app.get('/api/languages', (req, res) => {
        res.json({ languages: SUPPORTED_LANGUAGES, default: DEFAULT_LANGUAGE });
    });

    // ── ECDH key exchange for stealth video delivery ──────────────────────────
    app.post('/api/auth/:videoID', async (req, res) => {
        try {
            const token   = (req.headers.authorization || '').replace('Bearer ', '').trim();
            const session = (() => { try { return app.jwt.verify(token); } catch { return null; } })();
            if (!session) return res.status(401).json({ error: 'Unauthorized' });

            const { videoID } = req.params;
            const { pubKey }  = req.body;
            if (!pubKey || !videoID) return res.status(400).json({ error: 'Missing pubKey or videoID' });

            const userID = session.userID || session.id || session.sub;
            if (!userID) return res.status(401).json({ error: 'Token missing userID' });

            const plan = await edgeone.getUserActivePlan(session.username || session.sub);
            if (!plan)  return res.status(403).json({ error: 'No active plan' });

            const clientPubBytes               = b64decode(pubKey);
            const { serverPubKey, contentKey } = await serverECDH(clientPubBytes, videoID, userID);
            const playlist                     = await edgeone.getStealthPlaylist(videoID);
            if (!playlist) return res.status(404).json({ error: 'Video not found' });

            void contentKey;
            res.json({
                serverPubKey: b64encode(serverPubKey),
                userID,
                playlist,
                plan: { id: plan.id },
            });
        } catch (err) {
            console.error('[auth/ecdh]', err.message);
            res.status(500).json({ error: 'Key exchange failed' });
        }
    });

    // ── Content registration (pipeline webhook) ───────────────────────────────
    // FONTE ÚNICA de verdade para POST /api/pipeline/register.
    // Removido de content.js e admin.js — existia em 3 sítios, causando
    // race condition no cold start serverless (ordem de registo não determinista).
    app.post('/api/pipeline/register', async (req, res) => {
        if (!isValidAdminKey(req.headers['x-api-key'])) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        try {
            const {
                contentId, title, description, type, year, lang,
                duration, thumbnail, thumbnails, qualities,
                width, height, codec, fps, bitrate,
                segmentCount, segDuration, videoID,
                encrypted, encryption, segExt, masterUrl, noncesUrl,
                rating, genres, available_langs,
                seasonNumber, episodeNumber, episodeTitle,
            } = req.body;

            if (!contentId || !title) {
                return res.status(400).json({ error: 'contentId and title required' });
            }

            // ── Rain/Relaxation/AI/Other (canais próprios, yt-dlp) — colapsados
            // num único type='video' no Turso (não multiplica tipos no
            // catálogo). A categoria original fica numa tabela própria
            // (video_categories, migration feita à mão no Turso — ver
            // setVideoCategory em edgeone.js), não em `genres`.
            const AMBIENT_TYPES = ['rain', 'relaxation', 'ai', 'other'];
            const rawType   = (type || '').toLowerCase();
            const isAmbient = AMBIENT_TYPES.includes(rawType);
            const finalType = isAmbient ? 'video' : (type || 'movie');

            // ── PixGo Creative: relacionar este content_id com quem o enviou ──
            // Consulta server-to-server ao copyright-worker (GET /creator-lookup),
            // que guardou isto no momento da aprovação em /admin (ver
            // forwardApproved() em copyright-worker.js). Nunca bloqueia o
            // registo: se a consulta falhar/expirar/vier vazia (ex.: conteúdo
            // antigo, ou canais/seed sem passar pelo formulário de upload),
            // o conteúdo é registado na mesma, só sem uploader_id.
            let uploaderId = null;
            let goCreative = false;
            try {
                const lookupBase = getEnv('COPYRIGHT_WORKER_URL', 'https://copyright.pixgo.qzz.io').replace(/\/$/, '');
                const lookupSecret = getEnv('INTERNAL_LOOKUP_SECRET', '');
                if (lookupSecret) {
                    const ctrl = new AbortController();
                    const timeoutId = setTimeout(() => ctrl.abort(), 4000);
                    const lookupRes = await fetch(`${lookupBase}/creator-lookup/${encodeURIComponent(contentId)}`, {
                        headers: { 'x-internal-key': lookupSecret },
                        signal: ctrl.signal,
                    }).finally(() => clearTimeout(timeoutId));
                    if (lookupRes.ok) {
                        const info = await lookupRes.json();
                        uploaderId = info.user_id || null;
                        goCreative = info.go_creative === true;
                    }
                }
            } catch (lookupErr) {
                console.error('[pipeline/register] creator-lookup falhou (registo continua sem uploader_id):', lookupErr.message);
            }

            await edgeone.registerContent(contentId, {
                title,
                description:     description  || '',
                type:            finalType,
                year:            parseInt(year) || new Date().getFullYear(),
                lang:            lang         || 'pt',
                duration:        duration     || 0,
                thumbnail:       thumbnail    || thumbnails?.[0] || '',
                thumbnails:      thumbnails   || [],
                qualities:       qualities    || [],
                width:           width        || 0,
                height:          height       || 0,
                codec:           codec        || 'h264',
                fps:             fps          || 24,
                bitrate:         bitrate      || 0,
                segmentCount:    segmentCount || 0,
                segDuration:     segDuration  || 4,
                videoID:         videoID      || contentId,
                encrypted:       encrypted    || false,
                encryption:      encryption   || null,
                segExt:          segExt       || 'bin',
                masterUrl:       masterUrl    || '',
                noncesUrl:       noncesUrl    || '',
                rating:          rating       || 0,
                genres:          genres       || [],
                available_langs: available_langs?.length ? available_langs : [lang || 'pt'],
                seasonNumber:    seasonNumber  ? parseInt(seasonNumber, 10)  : 0,
                episodeNumber:   episodeNumber || '',
                episodeTitle:    episodeTitle  || '',
                uploaderId,
                goCreative,
            });

            // ── Categoria (rain/relaxation/ai/other) → tabela própria.
            // Nunca bloqueia o registo principal: se falhar (ex.: tabela
            // ainda não migrada), só loga — o conteúdo já está registado.
            if (isAmbient) {
                try {
                    await edgeone.setVideoCategory(contentId, rawType);
                } catch (catErr) {
                    console.error(`[pipeline/register] setVideoCategory falhou (não fatal): ${catErr.message}`);
                }
            }

            console.log(`[pipeline/register] ok contentId=${contentId} lang=${lang} type=${finalType}${isAmbient ? ` category=${rawType}` : ''}`);
            res.json({ ok: true, contentId, lang: lang || 'pt' });

        } catch (err) {
            console.error('[pipeline/register] error:', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── Download redirect ─────────────────────────────────────────────────────
    // FIX #11: validateDownloadToken deve verificar expiração internamente.
    // Se o teu edgeone.validateDownloadToken não verificar TTL, adiciona aqui:
    //
    //   const payload = edgeone.validateDownloadToken(req.query.token);
    //   if (!payload) return res.status(401)...
    //   if (payload.exp && Date.now() / 1000 > payload.exp)
    //       return res.status(401).json({ error: 'Download token expired' });
    //
    // Assumindo que validateDownloadToken já verifica exp (padrão jwt.verify),
    // este handler está correcto. Confirmado: o token inclui `exp` se assinado
    // com jsonwebtoken — que verifica automaticamente na verify().
    app.get('/api/download/:contentId/:quality', async (req, res) => {
        const payload = edgeone.validateDownloadToken(req.query.token);
        if (!payload) return res.status(401).json({ error: 'Invalid or expired download token' });
        if (payload.cid !== req.params.contentId) return res.status(403).json({ error: 'Token mismatch' });
        res.redirect(`${getEnv('CDN_DOMAIN', '')}/dl/${req.params.contentId}/${req.params.quality}`);
    });

    // ── 404 / error handlers ─────────────────────────────────────────────────
    app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        console.error('[express]', err.message);
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    });

    return app;
}

// ── Build once and export ─────────────────────────────────────────────────────

startupChecks(); // FIX #14: fatal se JWT_SECRET ou COOKIE_SECRET ausentes
const app = buildApp();

export default app;