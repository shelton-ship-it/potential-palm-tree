// middleware/auth.js
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../lib/env.js';

function jwtSecret() {
    const s = getEnv('JWT_SECRET');
    if (!s) throw new Error('[auth] JWT_SECRET not configured');
    return s;
}

export async function authenticate(req, res, next) {
    try {
        // FIX (cirúrgico, sem mudar semântica de segurança nenhuma):
        // `optionalAuth` já corre GLOBALMENTE (app.use, antes de qualquer
        // rota) e já faz exactamente esta mesma verificação — mesmo token,
        // mesmo getUserById(). Toda rota que aplica `authenticate` depois
        // disso repetia a consulta ao Turso do zero, sempre — 1 round-trip
        // HTTP a mais (sem connection pooling, ver lib/turso.js) em CADA
        // rota protegida (content, admin, payments, mylist, progress, geo —
        // 28 usos ao todo). Se `optionalAuth` já resolveu um req.user válido
        // pra esta mesma requisição, é seguro reaproveitar — é o mesmo
        // token/cookie, verificado agora mesmo, sem nada ter mudado no meio
        // do caminho dentro da mesma invocação.
        if (req.user) return next();

        // 1. Try JWT from Authorization header
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
                const payload = jwt.verify(token, jwtSecret());
                const user = await req.app.edgeone.getUserById(payload.id);
                if (!user || !user.is_active) throw new Error('User not found or inactive');
                req.user = { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null };
                return next();
            } catch (jwtErr) {
                // fall through to session check
            }
        }

        // 2. Try session cookie
        const sessionId = req.cookies?.sessionId;
        if (sessionId) {
            const session = await req.app.edgeone.getSession(sessionId);
            if (session) {
                if (new Date(session.expires_at) < new Date()) {
                    await req.app.edgeone.deleteSession(sessionId);
                    throw new Error('Session expired');
                }
                const user = await req.app.edgeone.getUserById(session.userId);
                if (!user || !user.is_active) throw new Error('User not found or inactive');
                req.user = { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null };
                return next();
            }
        }

        // 3. Try pixgo_session cookie — JWT partilhado entre subdomínios
        //    *.pixgo.qzz.io (hub app.pixgo.qzz.io + as 9 ferramentas). Um
        //    utilizador que fez login lá é reconhecido aqui automaticamente,
        //    sem duplicar sessão — mesma tabela `users` no Turso.
        const sharedToken = req.cookies?.pixgo_session;
        if (sharedToken) {
            try {
                const payload = jwt.verify(sharedToken, jwtSecret());
                const user = await req.app.edgeone.getUserById(payload.id);
                if (user && user.is_active) {
                    req.user = { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null };
                    return next();
                }
            } catch { /* token inválido/expirado — cai no erro geral abaixo */ }
        }

        throw new Error('No valid authentication provided');
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}

export async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const sessionId = req.cookies?.sessionId;
    const sharedToken = req.cookies?.pixgo_session;

    if (!authHeader && !sessionId && !sharedToken) {
        req.user = null;
        return next();
    }

    try {
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const payload = jwt.verify(token, jwtSecret());
            const user = await req.app.edgeone.getUserById(payload.id);
            if (user && user.is_active) {
                req.user = { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null };
            } else {
                req.user = null;
            }
            return next();
        }

        if (sessionId) {
            const session = await req.app.edgeone.getSession(sessionId);
            if (session && new Date(session.expires_at) >= new Date()) {
                const user = await req.app.edgeone.getUserById(session.userId);
                req.user = user && user.is_active
                    ? { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null }
                    : null;
                return next();
            }
        }

        // Fallback: cookie pixgo_session (SSO partilhado)
        if (sharedToken) {
            const payload = jwt.verify(sharedToken, jwtSecret());
            const user = await req.app.edgeone.getUserById(payload.id);
            req.user = user && user.is_active
                ? { id: user.id, username: user.username, role: user.role || 'user', plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null }
                : null;
            return next();
        }

        req.user = null;
    } catch {
        req.user = null;
    }

    next();
}

export async function requireAdmin(req, res, next) {
    // FIX: antes, se authenticate() falhasse, ele já mandava a resposta 401
    // sozinho — mas esta função continuava a executar e tentava mandar OUTRA
    // resposta (403) por cima, disparando ERR_HTTP_HEADERS_SENT. Numa
    // middleware async do Express 4, uma rejeição dessas NÃO é capturada
    // automaticamente pelo framework — é uma excepção não tratada de
    // verdade, ao contrário de tudo o resto investigado nesta ronda (que
    // eram só timeouts de latência, não crashes). `res.headersSent` aqui
    // detecta exactamente esse caso e sai sem tentar responder de novo.
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