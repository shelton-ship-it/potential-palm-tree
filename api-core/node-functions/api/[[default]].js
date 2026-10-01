// node-functions/api/[[default]].js — Core Multi-Plataforma v1.0
// ─────────────────────────────────────────────────────────────────────────────
// EdgeOne Pages Node Functions — Framework mode (Express).
// Mesma estrutura obrigatória do serviço original (não alterar):
//   • Não iniciar servidor HTTP nem chamar app.listen()
//   • Não usar handlers estilo Cloudflare Worker (export fetch)
//   • Exportar a instância Express como `export default app`
//   • Variáveis de ambiente via process.env
//   • KV bindings são globais — globalThis[bindingName]
//
// Este backend é ÚNICO e serve TODAS as plataformas (CompressHub, ConvertAll,
// EditPDF, BackCut, RecCast, DocForge, QRForge, ResumeForge).
// Cada plataforma tem o seu próprio subdomínio/frontend, mas fala com a
// mesma API — CORS validado por origem (ALLOWED_ORIGINS no env), rotas
// namespaced por serviço (/api/compresshub/*, /api/convertall/*, ...).
// ─────────────────────────────────────────────────────────────────────────────

import express      from 'express';
import helmet        from 'helmet';
import cookieParser  from 'cookie-parser';
import jwt           from 'jsonwebtoken';

import { getEnv, getEnvList }                    from './lib/env.js';
import { edgeone }                               from './lib/edgeone.js';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lib/geoip.js';
import { noStoreMiddleware }                     from './lib/no-store.js';
import { rateLimitMiddleware }                   from './middleware/rate-limit.js';
import { languageDetector }                      from './middleware/language.js';
import { optionalAuth }                          from './middleware/auth.js';

import authRoutes  from './routes/auth.js';
import plansRoutes from './routes/plans.js';
import zumbopayRoutes from './routes/zumbopay.js';

// ── Rotas por serviço — cada plataforma regista o seu módulo aqui ──────────
import compressRoutes   from './routes/services/compress.js';
import convertRoutes    from './routes/services/convert.js';
import pdfEditRoutes    from './routes/services/pdf-edit.js';
import reccastRoutes    from './routes/services/reccast.js';
import docGenRoutes     from './routes/services/docgen.js';
import qrForgeRoutes    from './routes/services/qrforge.js';
import resumeRoutes     from './routes/services/resumeforge.js';
import resumeStudioRoutes from './routes/services/resumeforge-studio.js';
import usageRoutes from './routes/usage.js';

// ── Startup checks ──────────────────────────────────────────────────────────
function startupChecks() {
    const fatal = [];
    for (const key of ['JWT_SECRET', 'COOKIE_SECRET']) {
        if (!getEnv(key)) fatal.push(key);
    }
    if (!getEnv('HOTMART_HOTTOK'))       console.warn('[startup] WARNING: HOTMART_HOTTOK is not set — webhook Hotmart ficará inacessível.');
    if (!getEnv('ZUMBOPAY_API_KEY'))        console.warn('[startup] WARNING: ZUMBOPAY_API_KEY is not set — cobranças ZumboPay ficarão inacessíveis.');
    if (!getEnv('ZUMBOPAY_WEBHOOK_SECRET')) console.warn('[startup] WARNING: ZUMBOPAY_WEBHOOK_SECRET is not set — webhook ZumboPay será sempre rejeitado.');
    if (fatal.length > 0) {
        throw new Error(`[startup] FATAL: variáveis obrigatórias não configuradas: ${fatal.join(', ')}.`);
    }
}

function jwtSecret()    { const s = getEnv('JWT_SECRET'); if (!s) throw new Error('[auth] JWT_SECRET not configured'); return s; }
function jwtAccessTTL() { return getEnv('JWT_ACCESS_TTL', '30d'); }

function buildApp() {
    const app = express();
    app.set('trust proxy', true);
    app.use(express.json({
        limit: '30mb', // uploads de imagem em base64 passam por aqui
        verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); }, // corpo bruto p/ HMAC do webhook ZumboPay
    }));
    app.use(express.urlencoded({ extended: true, limit: '30mb' }));

    app.use((req, res, next) => {
        const secret = getEnv('COOKIE_SECRET');
        if (!secret) return res.status(500).json({ error: 'Server misconfiguration: COOKIE_SECRET' });
        cookieParser(secret)(req, res, next);
    });

    app.use((req, res, next) => {
        const publicPaths = ['/api/languages']; // /api/health já começa com /api, não precisa de caso especial
        const isPublic    = publicPaths.some(p => req.path === p || req.path.startsWith(p));
        if (!isPublic && !req.path.startsWith('/api')) req.url = '/api' + req.url;
        next();
    });

    // ── CORS multi-plataforma ────────────────────────────────────────────
    // Qualquer origem sob *.pixgo.qzz.io (e o próprio pixgo.qzz.io/www.)
    // é aceite automaticamente por regex — não depende de manter uma
    // lista manual actualizada cada vez que se adiciona um subdomínio
    // novo (foi exactamente isto que causou o CORS a bloquear
    // app.pixgo.qzz.io e pixgo.qzz.io antes desta correcção).
    // ALLOWED_ORIGINS continua a existir para domínios FORA de
    // pixgo.qzz.io, caso alguma vez sejam precisos.
    const PIXGO_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?pixgo\.qzz\.io$/;
    const allowedOrigins = getEnvList('ALLOWED_ORIGINS', [
        'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000',
    ]);
    app.use((req, res, next) => {
        const origin    = req.headers.origin || '';
        const isPreview = /^https:\/\/[a-z0-9-]+\.edgeone\.dev$/.test(origin);
        const isPixgo   = PIXGO_ORIGIN_RE.test(origin);
        const allowed   = isPixgo || allowedOrigins.includes(origin) || isPreview;

        if (origin && allowed) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, Accept-Language, Cookie, X-Hotmart-Hottok');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Vary', 'Origin');

        if (req.method === 'OPTIONS') return res.status(204).end();
        next();
    });

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc:   ["'self'", "'unsafe-inline'"],
                scriptSrc:  ["'self'"],
                imgSrc:     ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https:', 'http://localhost:3000', 'http://localhost:3001'],
                frameSrc:   ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    app.edgeone = edgeone;
    app.jwt = {
        sign:   (payload, options = {}) => jwt.sign(payload, jwtSecret(), { expiresIn: jwtAccessTTL(), ...options }),
        verify: (token)                  => jwt.verify(token, jwtSecret()),
    };

    // Headers no-store ANTES de tudo (incl. rate-limit) — ver lib/no-store.js
    app.use(noStoreMiddleware);
    app.use(languageDetector);
    app.use(optionalAuth);
    app.use(rateLimitMiddleware);

    // ── Rotas core (partilhadas por todas as plataformas) ───────────────────
    authRoutes(app);
    plansRoutes(app);
    zumbopayRoutes(app);

    // ── Rotas por serviço (namespaced) ───────────────────────────────────────
    compressRoutes(app);
    convertRoutes(app);
    pdfEditRoutes(app);
    reccastRoutes(app);
    docGenRoutes(app);
    qrForgeRoutes(app);
    resumeRoutes(app);
    resumeStudioRoutes(app);
    usageRoutes(app);

    // ── Health check ─────────────────────────────────────────────────────
    // Versão explícita — visita https://pixel.pixgo.qzz.io/health depois de
    // um deploy pra confirmar que o código novo está mesmo no ar (evita
    // ficar testando contra uma versão antiga sem saber).
    const BACKEND_VERSION = '2.2.0-google-auth-8plataformas';

    app.get('/api/health', async (req, res) => {
        let tursoOk = false, tursoError = null;
        try { await edgeone.ping(); tursoOk = true; }
        catch (err) { tursoError = err.message; }

        const kvBound = typeof globalThis['CACHE_NS'] !== 'undefined' && typeof globalThis['JOBS_NS'] !== 'undefined';
        res.json({
            status: (tursoOk && kvBound) ? 'ok' : 'degraded',
            version: BACKEND_VERSION,
            turso: tursoOk,           // fonte de verdade: users/subscriptions
            turso_error: tursoError,  // mensagem real, se falhar — diagnóstico directo
            kv_bound: kvBound,        // CACHE_NS/JOBS_NS: rate-limit, jobs, cache (não identidade)
            timestamp: new Date().toISOString(),
        });
    });

    app.get('/api/languages', (req, res) => {
        res.json({ languages: SUPPORTED_LANGUAGES, default: DEFAULT_LANGUAGE });
    });

    // ── 404 / error handlers ─────────────────────────────────────────────
    app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        console.error('[express]', err.message);
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    });

    return app;
}

startupChecks();
const app = buildApp();

export default app;
