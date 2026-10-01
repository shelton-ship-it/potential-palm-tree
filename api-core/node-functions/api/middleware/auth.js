// middleware/auth.js
// v2.0 — aceita o token por 3 vias, nesta ordem:
//   1. Authorization: Bearer <jwt>      (scripts, testes, apps mobile)
//   2. Cookie pixgo_session=<jwt>       (SSO entre subdomínios — o caso
//                                         normal do dia a dia das 8
//                                         plataformas + app.pixgo.qzz.io)
//   3. Cookie sessionId (legado)        (mecanismo antigo de sessão opaca
//                                         em KV, mantido só por completude)
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../lib/env.js';

function jwtSecret() {
    const s = getEnv('JWT_SECRET');
    if (!s) throw new Error('[auth] JWT_SECRET not configured');
    return s;
}

function userFrom(user) {
    return { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null };
}

async function tryBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;
    const payload = jwt.verify(authHeader.slice(7), jwtSecret());
    const user = await req.app.edgeone.getUserById(payload.id);
    if (!user || !user.is_active) return null;
    return userFrom(user);
}

async function trySessionCookie(req) {
    const token = req.cookies?.pixgo_session;
    if (!token) return null;
    const payload = jwt.verify(token, jwtSecret());
    const user = await req.app.edgeone.getUserById(payload.id);
    if (!user || !user.is_active) return null;
    return userFrom(user);
}

async function tryLegacySession(req) {
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) return null;
    const session = await req.app.edgeone.getSession(sessionId);
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
        await req.app.edgeone.deleteSession(sessionId);
        return null;
    }
    const user = await req.app.edgeone.getUserById(session.userId);
    if (!user || !user.is_active) return null;
    return userFrom(user);
}

export async function authenticate(req, res, next) {
    try {
        // FIX (cirúrgico — mesmo problema encontrado no pixel_service_v1):
        // `optionalAuth` corre GLOBALMENTE (app.use, antes de qualquer rota)
        // e já faz esta mesma verificação. As 33 rotas de serviço
        // (compresshub/convertall/docforge/editpdf/qrforge/reccast/
        // resumeforge) TODAS aplicam `authenticate` por cima — cada uma
        // repetindo o mesmo getUserById() no Turso do zero, mesmo já tendo
        // sido resolvido. São rotas pesadas (compressão/conversão/geração de
        // ficheiro) — tempo × memória altos, exactamente o que consome
        // Cloud Functions GB-s — e estavam a pagar essa consulta 2x sempre.
        // Se `optionalAuth` já resolveu um req.user válido pra esta mesma
        // requisição, é seguro reaproveitar sem repetir a verificação.
        if (req.user) return next();

        const user = (await tryBearerToken(req).catch(() => null))
                  || (await trySessionCookie(req).catch(() => null))
                  || (await tryLegacySession(req).catch(() => null));
        if (!user) throw new Error('No valid authentication provided');
        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}

export async function optionalAuth(req, res, next) {
    try {
        req.user = (await tryBearerToken(req).catch(() => null))
                || (await trySessionCookie(req).catch(() => null))
                || (await tryLegacySession(req).catch(() => null));
    } catch {
        req.user = null;
    }
    next();
}

export async function requireAdmin(req, res, next) {
    // FIX: mesmo bug de dupla-resposta do pixel_service_v1 — se authenticate()
    // já respondeu 401, esta função continuava e tentava responder 403 por
    // cima (ERR_HTTP_HEADERS_SENT, não capturado automaticamente pelo Express
    // 4 em middleware async).
    await authenticate(req, res, () => {});
    if (res.headersSent) return;
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    next();
}

export function createSession(edgeoneClient) {
    return async function (user, ip, userAgent) {
        const sessionId = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const session = {
            userId: user.id,
            username: user.username,
            ip,
            userAgent: userAgent || '',
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
        };

        await edgeoneClient.createSession(sessionId, session);
        return { sessionId, session };
    };
}

export function destroySession(edgeoneClient) {
    return async function (sessionId) {
        await edgeoneClient.deleteSession(sessionId);
    };
}
