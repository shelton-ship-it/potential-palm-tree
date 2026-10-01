// middleware/rate-limit.js — Core genérico multi-plataforma
//
// Duas camadas:
//   1. Rate-limit geral por IP/utilizador (anti-abuso, igual em todas as rotas)
//   2. Quota diária de jobs no plano Free por serviço (aplicada nas rotas de
//      cada serviço via requireQuota(), não aqui — este middleware só cuida
//      do rate-limit de requests).
//
// RATE LIMITS:
//   • Utilizadores autenticados: 3000 req/h
//   • Admin:                     5000 req/h
//   • Auth endpoints (login/register): 30 req/h por IP (anti-brute-force)
//   • Anónimo / IP:               600 req/h

import { getClientIP } from '../lib/geoip.js';

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora

const RATE_LIMITS = {
    anon:  600,
    user:  3000,
    admin: 5000,
    auth:  30,
};

const PUBLIC_PATHS = ['/health'];
const AUTH_PATHS   = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/google', '/api/auth/link-google'];

async function checkAndIncrement(edgeone, category, id, limit) {
    try {
        const now  = Date.now();
        const data = await edgeone.get(category, id);

        if (!data || (now - data.last_request) > RATE_WINDOW_MS) {
            await edgeone.put(category, id, { requests: 1, last_request: now });
            return { allowed: true, remaining: limit - 1 };
        }

        const remaining = limit - data.requests;
        if (remaining <= 0) {
            return { allowed: false, remaining: 0, reset: data.last_request + RATE_WINDOW_MS };
        }

        await edgeone.put(category, id, { requests: data.requests + 1, last_request: data.last_request });
        return { allowed: true, remaining: remaining - 1, reset: data.last_request + RATE_WINDOW_MS };
    } catch {
        return { allowed: true, remaining: limit };
    }
}

function applyHeaders(res, limit, result) {
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining || 0)));
}

function tooMany(res, result, message) {
    const resetSec = result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : 3600;
    res.set('Retry-After', String(resetSec));
    return res.status(429).json({ error: 'Too Many Requests', message });
}

export async function rateLimitMiddleware(req, res, next) {
    const path = req.path;
    if (PUBLIC_PATHS.some(p => path === p)) return next();
    if (!req.app.edgeone) return next();

    const ip = getClientIP(req);

    if (AUTH_PATHS.some(p => path.startsWith(p))) {
        const result = await checkAndIncrement(req.app.edgeone, 'rate_auth', ip, RATE_LIMITS.auth);
        applyHeaders(res, RATE_LIMITS.auth, result);
        if (!result.allowed) return tooMany(res, result, 'Demasiadas tentativas. Tente novamente mais tarde.');
        return next();
    }

    if (path.startsWith('/api/admin')) {
        const result = await checkAndIncrement(req.app.edgeone, 'rate_admin', req.user?.id || ip, RATE_LIMITS.admin);
        applyHeaders(res, RATE_LIMITS.admin, result);
        if (!result.allowed) return tooMany(res, result, 'Limite admin atingido.');
        return next();
    }

    if (req.user) {
        const result = await checkAndIncrement(req.app.edgeone, 'rate_user', req.user.id, RATE_LIMITS.user);
        applyHeaders(res, RATE_LIMITS.user, result);
        if (!result.allowed) return tooMany(res, result, 'Limite de pedidos atingido.');
        return next();
    }

    const result = await checkAndIncrement(req.app.edgeone, 'rate_ip', ip, RATE_LIMITS.anon);
    applyHeaders(res, RATE_LIMITS.anon, result);
    if (!result.allowed) return tooMany(res, result, 'Muitos pedidos. Tente novamente mais tarde.');
    next();
}

/**
 * Quota diária de jobs para o plano Free — usado dentro de cada rota de
 * serviço (compress, convert, etc.) antes de aceitar um novo job.
 * Utilizadores com plano pago (monthly/annual) não têm limite.
 */
export function requireQuota(service, freeLimitPerDay = 5) {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const plan = await req.app.edgeone.getUserPlan(req.user.username);
        if (plan?.is_active && plan.id !== 'free') return next();

        const used = await req.app.edgeone.getDailyUsage(req.user.id, service);
        if (used >= freeLimitPerDay) {
            return res.status(403).json({
                error: 'Quota Exceeded',
                message: `Limite diário do plano gratuito atingido (${freeLimitPerDay}/dia). Faça upgrade para uso ilimitado.`,
                upgrade_url: '/main/plans',
            });
        }
        next();
    };
}
