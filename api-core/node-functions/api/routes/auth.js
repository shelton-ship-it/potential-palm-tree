// routes/auth.js — Core genérico multi-plataforma
// ─────────────────────────────────────────────────────────────────────────────
// v2.0 — SSO entre subdomínios via cookie de sessão.
//
// Login/registo feitos em app.pixgo.qzz.io (hub central) setam um cookie
// HttpOnly com Domain=.pixgo.qzz.io — o browser passa a enviar esse cookie
// automaticamente em qualquer pedido para pixel.pixgo.qzz.io feito a partir
// de QUALQUER subdomínio (compresshub.pixgo.qzz.io, convertall..., etc.).
// É assim que "logar uma vez, usar em todas as 8" funciona sem duplicar
// páginas de login em cada ferramenta.
//
// O token continua também a ser devolvido no corpo da resposta — mantém
// compatibilidade com quem ainda usa Authorization: Bearer (testes,
// scripts, apps mobile futuros). O middleware de auth aceita AMBOS: cookie
// primeiro, header como fallback.
//
// Sem refresh-token rotativo no frontend: JWT_ACCESS_TTL está a 365d, então
// a complexidade de refresh silencioso deixou de valer a pena. O endpoint
// /refresh continua a existir (API completa), mas nenhum frontend precisa
// de o chamar no dia a dia.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { validateOrThrow, schemas } from '../lib/validation.js';
import { getEnv } from '../lib/env.js';
import { getRefreshDays, setSessionCookie, clearSessionCookie } from '../lib/session-cookie.js';

// ── Google Sign-In ("Continuar com Google") ────────────────────────────────
let _googleClient = null;
function getGoogleClient() {
    if (_googleClient) return _googleClient;
    const clientId = getEnv('GOOGLE_CLIENT_ID');
    if (!clientId) return null;
    _googleClient = new OAuth2Client(clientId);
    return _googleClient;
}

function sanitizeUsernameCandidate(raw) {
    let s = String(raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    if (s.length < 3) s = `usr${s}`.slice(0, 20);
    return s || 'user';
}

async function generateUsernameFromGoogle(edgeone, email, name) {
    const base = sanitizeUsernameCandidate(email ? email.split('@')[0] : name);
    let candidate = base;
    let suffix = 0;
    // eslint-disable-next-line no-await-in-loop
    while (await edgeone.getUser(candidate)) {
        suffix += 1;
        candidate = `${base}${suffix}`.slice(0, 30);
    }
    return candidate;
}

async function buildUserResponse(edgeone, user) {
    const plan = await edgeone.getUserPlan(user.username);
    return {
        user: {
            id: user.id, username: user.username, name: user.name,
            role: user.role, email: user.email, plan_id: user.plan_id || 'free',
        },
        plan,
    };
}

export default function (app) {

    // ── POST /api/auth/register ────────────────────────────────────────────
    app.post('/api/auth/register', async (req, res) => {
        try {
            const data = validateOrThrow(schemas.register, req.body);

            const existing = await app.edgeone.getUser(data.username);
            if (existing) return res.status(409).json({ error: 'Conflict', message: 'Username already taken' });

            if (data.email) {
                const byEmail = await app.edgeone.getUserByEmail(data.email);
                if (byEmail) return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
            }

            const user  = await app.edgeone.createUser(data);
            const token = app.jwt.sign({ id: user.id, username: user.username });

            const refreshToken = randomBytes(32).toString('hex');
            const refreshExp   = new Date(Date.now() + getRefreshDays() * 86400 * 1000).toISOString();
            // Não-bloqueante: o refresh token é conveniência (rotação de
            // sessão), não é crítico — a sessão real dura 365d via cookie/JWT.
            // Uma falha no KV aqui NUNCA deve derrubar o registo/login em si
            // (foi exactamente isto que causou 500 mesmo com o Turso a
            // funcionar correctamente).
            await app.edgeone.storeRefreshToken(refreshToken, user.id, refreshExp).catch(err => {
                console.error('[auth/register] falha ao gravar refresh token (não bloqueante):', err.message);
            });

            setSessionCookie(res, token);
            const payload = await buildUserResponse(app.edgeone, user);
            res.status(201).json({ ...payload, token, refresh_token: refreshToken });
        } catch (err) {
            if (err.errors) return res.status(400).json({ error: 'Validation Error', message: err.errors[0]?.message, errors: err.errors });
            console.error('[auth/register]', err.message);
            // DIAGNÓSTICO TEMPORÁRIO: expor err.message no corpo, mesmo padrão
            // já usado em /api/health (turso_error) e /api/pipeline/register
            // (message: err.message) — reverter depois de identificar a causa.
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/auth/login ───────────────────────────────────────────────
    app.post('/api/auth/login', async (req, res) => {
        try {
            const data = validateOrThrow(schemas.login, req.body);

            const user = await app.edgeone.getUser(data.username);
            if (!user || !user.is_active) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });

            const valid = await app.edgeone.verifyPassword(user, data.password);
            if (!valid) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });

            const token = app.jwt.sign({ id: user.id, username: user.username });

            const refreshToken = randomBytes(32).toString('hex');
            const refreshExp   = new Date(Date.now() + getRefreshDays() * 86400 * 1000).toISOString();
            await app.edgeone.storeRefreshToken(refreshToken, user.id, refreshExp).catch(err => {
                console.error('[auth/login] falha ao gravar refresh token (não bloqueante):', err.message);
            });

            setSessionCookie(res, token);
            const payload = await buildUserResponse(app.edgeone, user);
            res.json({ ...payload, token, refresh_token: refreshToken });
        } catch (err) {
            if (err.errors) return res.status(400).json({ error: 'Validation Error', message: err.errors[0]?.message });
            console.error('[auth/login]', err.message);
            // DIAGNÓSTICO TEMPORÁRIO (ver nota em /api/auth/register acima).
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/auth/google ────────────────────────────────────────────────
    // Login/registo via "Continuar com o Google" (usado no LoginPage e no
    // RegisterPage — o mesmo endpoint serve as duas telas, o resultado é
    // sempre "sessão iniciada" ou um erro claro). Recebe a credential (ID
    // token) do Google Identity Services, valida criptograficamente no
    // servidor (google-auth-library), localiza/cria a conta partilhada
    // (mesma tabela `users` do Turso) e cria a MESMA sessão (cookie
    // pixgo_session) que login/register já criam.
    //
    // FIX (bug relatado — "utilizador impossibilitado de aceder"): a versão
    // anterior devolvia 409 AccountExistsUnlinked sempre que já existia uma
    // conta com aquele e-mail, MESMO quando era a própria pessoa a voltar
    // (ex.: conta cujo google_sub nunca chegou a ser gravado, ou criada
    // antes da coluna existir). A pessoa ficava numa cela sem saída: não
    // sabia a password (nunca a definiu, porque só usa Google) e o Google
    // era recusado por "já existe". Agora, se o e-mail devolvido pelo
    // Google já pertence a uma conta e o Google confirma email_verified,
    // ligamos automaticamente o google_sub a essa conta e entramos — não é
    // preciso pedir password de novo, porque a verificação do Google já
    // prova a posse do e-mail (aliás, mais forte do que a verificação de
    // e-mail que o registo tradicional exige, que é nenhuma). Continuamos a
    // registar isto explicitamente (não é um "silencioso"): a resposta
    // inclui a conta linkada como qualquer login normal.
    app.post('/api/auth/google', async (req, res) => {
        try {
            const { credential } = req.body || {};
            if (!credential || typeof credential !== 'string') {
                return res.status(400).json({ error: 'Bad Request', message: 'credential is required' });
            }

            const googleClient = getGoogleClient();
            if (!googleClient) {
                console.error('[auth/google] GOOGLE_CLIENT_ID not configured');
                return res.status(500).json({ error: 'Internal Server Error', message: 'Google sign-in not configured' });
            }

            let payload;
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken:  credential,
                    audience: getEnv('GOOGLE_CLIENT_ID'),
                });
                payload = ticket.getPayload();
            } catch (verifyErr) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google credential' });
            }

            if (!payload?.sub) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google credential' });
            }
            if (payload.email && payload.email_verified === false) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Google email is not verified' });
            }

            const googleSub = payload.sub;
            const email     = payload.email || null;
            const name      = payload.name || (email ? email.split('@')[0] : 'User');

            // Caso 1 — google_sub já ligado a uma conta: login directo,
            // independentemente de quantas vezes a pessoa já fez logout.
            let user = await app.edgeone.getUserByGoogleSub(googleSub);

            if (!user && email) {
                // Caso 2 — não encontrado por google_sub, mas já existe conta
                // com este e-mail (password tradicional OU Google antigo sem
                // google_sub gravado). Google já verificou o e-mail — ligamos
                // e entramos, em vez de bloquear (era aqui que a pessoa
                // ficava presa — ver nota acima).
                const existingByEmail = await app.edgeone.getUserByEmail(email);
                if (existingByEmail) {
                    if (!existingByEmail.is_active) {
                        return res.status(403).json({ error: 'Forbidden', message: 'Account is disabled' });
                    }
                    user = await app.edgeone.updateUser(existingByEmail.username, { google_sub: googleSub });
                }
            }

            if (!user) {
                // Caso 3 — conta nova. Password aleatória (nunca usada) —
                // não exige alteração de schema.
                const randomPassword = randomBytes(32).toString('hex');
                const username       = await generateUsernameFromGoogle(app.edgeone, email, name);

                user = await app.edgeone.createUser({
                    username, password: randomPassword, name, email, google_sub: googleSub,
                });
            }

            if (!user.is_active) {
                return res.status(403).json({ error: 'Forbidden', message: 'Account is disabled' });
            }

            const token = app.jwt.sign({ id: user.id, username: user.username });

            const refreshToken = randomBytes(32).toString('hex');
            const refreshExp   = new Date(Date.now() + getRefreshDays() * 86400 * 1000).toISOString();
            await app.edgeone.storeRefreshToken(refreshToken, user.id, refreshExp).catch(err => {
                console.error('[auth/google] falha ao gravar refresh token (não bloqueante):', err.message);
            });

            setSessionCookie(res, token);
            const responsePayload = await buildUserResponse(app.edgeone, user);
            res.json({ ...responsePayload, token, refresh_token: refreshToken });

        } catch (err) {
            console.error('[auth/google]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Google authentication failed' });
        }
    });

    // ── POST /api/auth/link-google ──────────────────────────────────────────
    // Liga proactivamente a conta já autenticada a um google_sub — chamada a
    // partir de Conta › Definições. Complementar ao auto-link do caso 2
    // acima (que só acontece no momento de um login/registo via Google);
    // isto serve para quem quer ligar a conta sem esperar por isso.
    app.post('/api/auth/link-google', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const { credential } = req.body || {};
            if (!credential || typeof credential !== 'string') {
                return res.status(400).json({ error: 'Bad Request', message: 'credential is required' });
            }

            const googleClient = getGoogleClient();
            if (!googleClient) return res.status(500).json({ error: 'Internal Server Error', message: 'Google sign-in not configured' });

            const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: getEnv('GOOGLE_CLIENT_ID') });
            const payload = ticket.getPayload();
            if (!payload?.sub) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google credential' });

            const already = await app.edgeone.getUserByGoogleSub(payload.sub);
            if (already && already.username !== req.user.username) {
                return res.status(409).json({ error: 'Conflict', message: 'Esta conta Google já está ligada a outro utilizador' });
            }

            const updated = await app.edgeone.updateUser(req.user.username, { google_sub: payload.sub });
            res.json(await buildUserResponse(app.edgeone, updated));
        } catch (err) {
            console.error('[auth/link-google]', err.message);
            res.status(400).json({ error: 'Bad Request', message: err.message });
        }
    });

    // ── POST /api/auth/refresh — mantido por completude da API; nenhum
    //     frontend precisa de o chamar rotineiramente (token dura 365d) ─────
    app.post('/api/auth/refresh', async (req, res) => {
        try {
            const { refresh_token } = req.body;
            if (!refresh_token) return res.status(400).json({ error: 'Bad Request', message: 'Missing refresh_token' });

            const record = await app.edgeone.getRefreshToken(refresh_token);
            if (!record || new Date(record.expires_at) < new Date()) {
                if (record) await app.edgeone.deleteRefreshToken(refresh_token);
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
            }

            const user = await app.edgeone.getUserById(record.userId);
            if (!user || !user.is_active) return res.status(401).json({ error: 'Unauthorized' });

            await app.edgeone.deleteRefreshToken(refresh_token);
            const newRefresh = randomBytes(32).toString('hex');
            const refreshExp = new Date(Date.now() + getRefreshDays() * 86400 * 1000).toISOString();
            await app.edgeone.storeRefreshToken(newRefresh, user.id, refreshExp);

            const token = app.jwt.sign({ id: user.id, username: user.username });
            setSessionCookie(res, token);
            res.json({ token, refresh_token: newRefresh });
        } catch (err) {
            console.error('[auth/refresh]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── GET /api/auth/me — chamado por CADA subdomínio pra saber se há
    //     sessão válida (cookie partilhado); é o coração do SSO ────────────
    app.get('/api/auth/me', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const user = await app.edgeone.getUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Not Found' });
        res.json(await buildUserResponse(app.edgeone, user));
    });

    // ── PUT /api/auth/me ────────────────────────────────────────────────────
    app.put('/api/auth/me', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const data = validateOrThrow(schemas.userUpdate, req.body);
            const updated = await app.edgeone.updateUser(req.user.username, data);
            res.json(await buildUserResponse(app.edgeone, updated));
        } catch (err) {
            if (err.errors) return res.status(400).json({ error: 'Validation Error', message: err.errors[0]?.message });
            console.error('[auth/me:PUT]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/auth/change-password ──────────────────────────────────────
    app.post('/api/auth/change-password', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const data = validateOrThrow(schemas.changePassword, req.body);
            const user = await app.edgeone.getUserById(req.user.id);
            const valid = await app.edgeone.verifyPassword(user, data.current_password);
            if (!valid) return res.status(401).json({ error: 'Unauthorized', message: 'Current password is incorrect' });

            await app.edgeone.changePassword(user.username, data.new_password);
            res.json({ ok: true });
        } catch (err) {
            if (err.errors) return res.status(400).json({ error: 'Validation Error', message: err.errors[0]?.message });
            console.error('[auth/change-password]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/auth/language ─────────────────────────────────────────────
    app.post('/api/auth/language', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const { lang } = req.body;
        if (!lang) return res.status(400).json({ error: 'Bad Request' });
        await app.edgeone.updateUser(req.user.username, { preferred_lang: lang });
        res.json({ ok: true });
    });

    // ── POST /api/auth/logout — limpa o cookie partilhado ────────────────────
    app.post('/api/auth/logout', async (req, res) => {
        const { refresh_token } = req.body || {};
        if (refresh_token) await app.edgeone.deleteRefreshToken(refresh_token).catch(() => {});
        clearSessionCookie(res);
        res.json({ ok: true });
    });
}
