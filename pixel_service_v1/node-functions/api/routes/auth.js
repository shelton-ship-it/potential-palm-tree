// routes/auth.js
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { validateOrThrow, schemas } from '../lib/validation.js';
import { createSession } from '../middleware/auth.js';
import { getEnv, getEnvInt, getEnvBool } from '../lib/env.js';

// ── Google Sign-In ("Continuar com Google") ────────────────────────────────
// Segundo método de autenticação, aditivo ao login tradicional. O Google só
// prova identidade — quem cria a sessão continua a ser o PixGo (mesmo
// createSession/setSharedSessionCookie usados no login por senha).
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

// Gera um username único (schema exige 3-30 chars, [a-zA-Z0-9_]) a partir
// do e-mail/nome devolvido pelo Google — o Google não dá "username".
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

const BCRYPT_ROUNDS = 12;
function getRefreshDays() { return getEnvInt('REFRESH_TOKEN_DAYS', 364); }
function isProduction()   { return getEnv('NODE_ENV') === 'production'; }

const SESSION_COOKIE_OPTS = (remember) => ({
  httpOnly: true,
  secure:   true,
  sameSite: 'none',
  path:     '/',
  domain:   '.pixgo.qzz.io',
  maxAge:   remember ? getRefreshDays() * 86400 * 1000 : 7 * 86400 * 1000,
});

// Cookie JWT partilhado entre subdomínios *.pixgo.qzz.io — reconhecido
// pelo hub (app.pixgo.qzz.io) e pelas 9 ferramentas (SSO). Aditivo: não
// substitui o sessionId acima, que continua a ser o mecanismo próprio
// desta plataforma.
const SHARED_SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'none',
  path:     '/',
  domain:   '.pixgo.qzz.io',
  maxAge:   365 * 86400 * 1000,
};
function setSharedSessionCookie(res, token) {
  res.cookie('pixgo_session', token, SHARED_SESSION_COOKIE_OPTS);
}
function clearSharedSessionCookie(res) {
  res.clearCookie('pixgo_session', { path: '/', domain: '.pixgo.qzz.io', sameSite: 'none', secure: true });
}

// ── Helper: sincronizar plano expirado → regredir para free ───────────────
async function syncPlanExpiry(edgeone, username) {
  try {
    const planData = await edgeone.getUserPlan(username);
    // getUserPlan.is_active é calculado como plan_id !== 'free' — não verifica a data.
    // Comparar expires_at directamente para detectar planos pagos já expirados.
    if (
      planData &&
      planData.id !== 'free' &&
      planData.expires_at &&
      new Date(planData.expires_at) <= new Date()
    ) {
      await edgeone.updateUserPlan(username, 'free');

      const user = await edgeone.getUser(username);
      if (user) {
        const sub = await edgeone.getSubscription(user.id);
        if (sub && sub.status === 'active') {
          sub.status     = 'expired';
          sub.expired_at = new Date().toISOString();
          await edgeone.setSubscription(user.id, sub);
        }
      }
      console.log(`[auth] Plano expirado para ${username} — regredido para free`);
    }
  } catch {
    // non-fatal
  }
}

// ── Helper: construir perfil de utilizador completo para resposta ──────────
async function buildUserResponse(edgeone, user) {
  await syncPlanExpiry(edgeone, user.username);
  const plan     = await edgeone.getUserPlan(user.username);
  const profiles = await edgeone.getProfiles(user.username);

  return {
    user: {
      id:       user.id,
      username: user.username,
      name:     user.name,
      role:     user.role,
      email:    user.email,
      plan_id:  user.plan_id || 'free',
    },
    plan,
    profiles,
  };
}

export default function (app) {

  const makeSession = createSession(app.edgeone);

  // ── POST /api/auth/register ──────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    try {
      const data = validateOrThrow(schemas.register, req.body);

      const existing = await app.edgeone.getUser(data.username);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'Username already taken' });
      }

      if (data.email) {
        const byEmail = await app.edgeone.getUserByEmail(data.email);
        if (byEmail) {
          return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
        }
      }

      const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

      const user = await app.edgeone.createUser({
        username:    data.username,
        password:    hashedPassword,
        name:        data.name,
        email:       data.email,
        preferences: { language: data.preferred_lang || 'en' },
      });

      const token = app.jwt.sign(
        { id: user.id, username: user.username, role: user.role, plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null }
      );
      const refreshToken = randomBytes(40).toString('hex');

      const [sessionResult, refreshResult] = await Promise.allSettled([
        makeSession(user, req.ip, req.headers['user-agent']),
        app.edgeone.setRefreshToken(user.id, refreshToken, getRefreshDays()),
      ]);

      const sessionId = sessionResult.status === 'fulfilled' ? sessionResult.value.sessionId : null;

      const profile = await app.edgeone.createProfileFromUser(user, {
        name:     user.name,
        language: data.preferred_lang || 'en',
        is_kid:   false,
      }).catch(() => null);

      if (sessionId) {
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTS(false));
      }
      setSharedSessionCookie(res, token);

      const plan     = app.edgeone.PLANS[user.plan_id] || app.edgeone.PLANS.free;
      const profiles = profile ? [profile] : [];

      res.status(201).json({
        user: {
          id:       user.id,
          username: user.username,
          name:     user.name,
          role:     user.role,
          email:    user.email,
          plan_id:  user.plan_id || 'free',
        },
        plan: { ...plan, expires_at: null, is_active: true },
        profiles,
        token,
        refresh_token: refreshToken,
      });

    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Register error:', err);
      res.status(500).json({
        error:   'Internal Server Error',
        message: err?.message || 'Registration failed',
      });
    }
  });

  // ── POST /api/auth/login ─────────────────────────────────────────────
  // FIXES:
  //   #1 makeSession em Promise.allSettled — nunca rebenta o login se KV falhar
  //   #2 updateUser (last_login/login_count) em try/catch — colunas podem não existir
  //   #3 usar rawUser directamente — evita 2ª query e possível null no destructuring
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, remember } = validateOrThrow(schemas.login, req.body);

      const rawUser = await app.edgeone.getUserWithPassword(username);
      if (!rawUser) {
        // Constant-time response — don't reveal whether username exists
        await bcrypt.hash(password, BCRYPT_ROUNDS);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      if (!rawUser.is_active) {
        return res.status(403).json({ error: 'Forbidden', message: 'Account is disabled' });
      }

      const lockStatus = app.edgeone.isAccountLocked(rawUser);
      if (lockStatus.locked) {
        const remainingSec = Math.ceil(lockStatus.remaining_ms / 1000);
        return res.status(429).json({
          error:       'Too Many Requests',
          message:     `Conta temporariamente bloqueada. Tente novamente em ${remainingSec} segundos.`,
          retry_after: remainingSec,
        });
      }

      const valid = await bcrypt.compare(password, rawUser.password);
      if (!valid) {
        await app.edgeone.recordFailedLogin(rawUser.id, req.ip);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      await app.edgeone.resetFailedLogins(username);
      await syncPlanExpiry(app.edgeone, username);

      // FIX #2: last_login/login_count podem não existir no schema Turso — non-fatal
      try {
        await app.edgeone.updateUser(username, {
          last_login:  new Date().toISOString(),
          login_count: (rawUser.login_count || 0) + 1,
        });
      } catch (e) { /* non-fatal */ }

      // FIX #3: usar rawUser directamente em vez de 2ª query que pode retornar null
      const { password: _, ...user } = rawUser;

      const refreshToken = randomBytes(40).toString('hex');

      // FIX #1: allSettled — makeSession ou setRefreshToken não quebram o login
      const [sessionResult] = await Promise.allSettled([
        makeSession(user, req.ip, req.headers['user-agent']),
        app.edgeone.setRefreshToken(user.id, refreshToken, getRefreshDays()),
      ]);

      const sessionId = sessionResult.status === 'fulfilled' ? sessionResult.value?.sessionId : null;

      if (sessionResult.status === 'rejected') {
        console.warn('[login] makeSession falhou:', sessionResult.reason?.message);
      }

      const token = app.jwt.sign(
        { id: user.id, username: user.username, role: user.role, plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null }
      );

      if (sessionId) {
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTS(remember));
      }
      setSharedSessionCookie(res, token);

      const response = await buildUserResponse(app.edgeone, user);
      res.json({ ...response, token, refresh_token: refreshToken });

    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Login error:', err);
      res.status(500).json({
        error:   'Internal Server Error',
        message: err?.message || 'Login failed',
      });
    }
  });

  // ── POST /api/auth/google ────────────────────────────────────────────
  // Recebe a credential (ID token) do Google Identity Services, valida
  // criptograficamente no servidor, localiza/cria a conta PixGo e cria a
  // MESMA sessão do login tradicional. Nunca confia em dados de identidade
  // enviados fora do token.
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
        // Nunca expor detalhes internos do erro de verificação
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

      let user = await app.edgeone.getUserByGoogleSub(googleSub);

      if (!user) {
        // Não encontrado por google_sub. Se já existir conta tradicional com
        // este e-mail, NÃO vincular automaticamente (account linking inseguro)
        // — o utilizador tem de entrar com a senha e vincular em Definições.
        if (email) {
          const existingByEmail = await app.edgeone.getUserByEmail(email);
          if (existingByEmail) {
            return res.status(409).json({
              error:   'AccountExistsUnlinked',
              message: 'Já existe uma conta com este e-mail. Entra com a tua senha e vincula o Google em Definições.',
            });
          }
        }

        // Nenhuma conta correspondente — criar conta PixGo nova.
        // Password aleatória (nunca usada) para não exigir alteração de
        // schema — a conta fica "só Google" até o utilizador definir senha.
        const randomPassword = randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);
        const username        = await generateUsernameFromGoogle(app.edgeone, email, name);

        user = await app.edgeone.createUser({
          username,
          password:    hashedPassword,
          name,
          email,
          google_sub:  googleSub,
          preferences: { language: 'en' },
        });

        await app.edgeone.createProfileFromUser(user, {
          name:     user.name,
          language: 'en',
          is_kid:   false,
        }).catch(() => null);
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Forbidden', message: 'Account is disabled' });
      }

      await syncPlanExpiry(app.edgeone, user.username);

      try {
        await app.edgeone.updateUser(user.username, {
          last_login:  new Date().toISOString(),
          login_count: (user.login_count || 0) + 1,
        });
      } catch (e) { /* non-fatal — mesmo padrão do login tradicional */ }

      const refreshToken = randomBytes(40).toString('hex');

      const [sessionResult] = await Promise.allSettled([
        makeSession(user, req.ip, req.headers['user-agent']),
        app.edgeone.setRefreshToken(user.id, refreshToken, getRefreshDays()),
      ]);
      const sessionId = sessionResult.status === 'fulfilled' ? sessionResult.value?.sessionId : null;

      if (sessionResult.status === 'rejected') {
        console.warn('[auth/google] makeSession falhou:', sessionResult.reason?.message);
      }

      const token = app.jwt.sign(
        { id: user.id, username: user.username, role: user.role, plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null }
      );

      if (sessionId) {
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTS(true));
      }
      setSharedSessionCookie(res, token);

      const response = await buildUserResponse(app.edgeone, user);
      res.json({ ...response, token, refresh_token: refreshToken });

    } catch (err) {
      console.error('Google auth error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Google authentication failed' });
    }
  });

  // ── POST /api/auth/logout ────────────────────────────────────────────
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        await app.edgeone.deleteSession(sessionId);
        res.clearCookie('sessionId', { path: '/', domain: '.pixgo.qzz.io', sameSite: 'none', secure: true });
      }
      clearSharedSessionCookie(res);
      const refreshToken = req.body?.refresh_token;
      if (refreshToken) {
        const userId = req.user?.id || await app.edgeone.validateRefreshToken(refreshToken);
        if (userId) {
          await app.edgeone.deleteRefreshToken(userId, refreshToken);
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Logout failed' });
    }
  });

  // ── POST /api/auth/refresh ───────────────────────────────────────────
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: 'Bad Request', message: 'refresh_token required' });
      }

      const userId = await app.edgeone.validateRefreshToken(refresh_token);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
      }

      const user = await app.edgeone.getUserById(userId);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User not found or inactive' });
      }

      await syncPlanExpiry(app.edgeone, user.username);
      const updatedUser = await app.edgeone.getUserById(userId);

      const token = app.jwt.sign(
        { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, plan_id: updatedUser.plan_id || 'free', plan_expires_at: updatedUser.plan_expires_at || null }
      );
      const newRefreshToken = randomBytes(40).toString('hex');

      await app.edgeone.deleteRefreshToken(userId, refresh_token);
      await app.edgeone.setRefreshToken(userId, newRefreshToken, getRefreshDays());
      setSharedSessionCookie(res, token);

      res.json({ token, refresh_token: newRefreshToken });

    } catch (err) {
      console.error('Refresh error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Token refresh failed' });
    }
  });

  // ── GET /api/auth/me ─────────────────────────────────────────────────
  app.get('/api/auth/me', async (req, res) => {
    try {
      // req.user já vem preenchido pelo optionalAuth global (Bearer,
      // sessionId OU pixgo_session — os 3 métodos, sem duplicar lógica).
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      }

      const user = await app.edgeone.getUserById(req.user.id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      }

      const response = await buildUserResponse(app.edgeone, user);

      // Token stateless (sem escrita em DB) — permite que uma ferramenta
      // autenticada só pelo cookie partilhado (pixgo_session) obtenha um
      // Bearer token local quando precisar (ex: URLs de stream de vídeo
      // que não conseguem enviar cookies cross-domain).
      const token = app.jwt.sign({
        id: user.id, username: user.username, role: user.role,
        plan_id: user.plan_id || 'free', plan_expires_at: user.plan_expires_at || null,
      });

      res.json({ ...response, token });

    } catch (err) {
      console.error('Auth/me error:', err);
      return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    }
  });

  // ── PUT /api/auth/me ─────────────────────────────────────────────────
  app.put('/api/auth/me', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });

    try {
      const updates = validateOrThrow(schemas.userUpdate, req.body);
      const user    = await app.edgeone.getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

      const updated = await app.edgeone.updateUser(user.username, {
        name:  updates.name,
        email: updates.email,
        ...(updates.preferred_lang && {
          preferences: { ...(user.preferences || {}), language: updates.preferred_lang },
        }),
      });

      res.json({ user: { id: updated.id, username: updated.username, name: updated.name, email: updated.email } });

    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Update failed' });
    }
  });

  // ── POST /api/auth/change-password ───────────────────────────────────
  app.post('/api/auth/change-password', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });

    try {
      const { current_password, new_password } = validateOrThrow(schemas.changePassword, req.body);
      const user    = await app.edgeone.getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found' });

      const rawUser = await app.edgeone.getUserWithPassword(user.username);
      if (!rawUser) return res.status(404).json({ error: 'Not Found', message: 'User not found' });
      const valid   = await bcrypt.compare(current_password, rawUser.password);
      if (!valid) {
        return res.status(400).json({ error: 'Bad Request', message: 'Current password is incorrect' });
      }

      const hashed = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
      await app.edgeone.updateUser(user.username, { password: hashed });

      await app.edgeone.deleteAllUserSessions(user.id);
      res.clearCookie('sessionId', { path: '/', domain: '.pixgo.qzz.io', sameSite: 'none', secure: true });
      clearSharedSessionCookie(res);

      res.json({ success: true, message: 'Password changed. Please log in again.' });

    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Password change failed' });
    }
  });

  // ── POST /api/auth/profiles ──────────────────────────────────────────
  app.post('/api/auth/profiles', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    try {
      const profileData = validateOrThrow(schemas.profile, req.body);
      const profile     = await app.edgeone.createProfile(req.user.username, profileData);
      res.status(201).json(profile);
    } catch (err) {
      if (err.message?.includes('máximo')) {
        return res.status(403).json({ error: 'Forbidden', message: err.message });
      }
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Create profile error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create profile' });
    }
  });

  // ── PUT /api/auth/profiles/:id ───────────────────────────────────────
  app.put('/api/auth/profiles/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    try {
      const profile = await app.edgeone.getProfile(req.params.id);
      if (!profile || profile.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
      }
      const updates = validateOrThrow(schemas.profile.partial(), req.body);
      const updated = await app.edgeone.updateProfile(req.params.id, updates);
      res.json(updated);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error:   'Validation Error',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update profile' });
    }
  });

  // ── DELETE /api/auth/profiles/:id ───────────────────────────────────
  app.delete('/api/auth/profiles/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    try {
      const profile = await app.edgeone.getProfile(req.params.id);
      if (!profile || profile.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden', message: 'Profile not found or access denied' });
      }
      await app.edgeone.deleteProfile(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete profile error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete profile' });
    }
  });

  // ── POST /api/auth/language ──────────────────────────────────────────
  app.post('/api/auth/language', async (req, res) => {
    try {
      const { lang } = req.body;
      const { SUPPORTED_LANGUAGES } = await import('../lib/geoip.js');

      if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) {
        return res.status(400).json({ error: 'Invalid language', supported: SUPPORTED_LANGUAGES });
      }

      res.cookie('preferred_language', lang, {
        path:     '/',
        maxAge:   365 * 24 * 3600 * 1000,
        httpOnly: false,
        secure:   isProduction(),
        sameSite: 'lax',
      });

      if (req.user?.id) {
        app.edgeone.setUserPreference(req.user.id, 'language', lang).catch(() => {});
      }

      res.json({ success: true, language: lang });
    } catch (err) {
      console.error('Set language error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to set language' });
    }
  });
}