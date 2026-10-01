// lib/edgeone.js — EdgeOne KV Client (Core genérico multi-plataforma) v2.0
// ─────────────────────────────────────────────────────────────────────────────
// v2.0 — INTEGRAÇÃO COM PIXGO.QZZ.IO
//
// Users e subscriptions passaram de EdgeOne KV para TURSO — a MESMA base de
// dados (mesmas tabelas `users` e `subscription`) já usada pela plataforma
// de streaming (pixgo.qzz.io). Não é só compatibilidade de cookie: é
// literalmente a mesma linha na tabela `users`. Um utilizador registado em
// qualquer uma das 8 ferramentas, no hub (app.pixgo.qzz.io), ou na Pixgo
// (pixgo.qzz.io), é o MESMO registo — por isso assinar em qualquer uma
// activa premium em todas, sem sincronização manual nenhuma.
//
// Motivo da migração: KV é adequado para dados efémeros (rate-limit, cache,
// histórico de jobs de ferramentas) mas não para identidade/faturação —
// pedido explícito para não confiar nisso em produção. Turso continua a
// ser a fonte de verdade single-source, tal como já era na Pixgo.
//
// O que continua em KV (CACHE_NS / JOBS_NS): rate-limit, cache de geoip,
// índice de QR dinâmico, histórico de jobs por ferramenta. Nada disto é
// dado de identidade ou faturação — perfeitamente aceitável em KV.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getEnv, getEnvFloat } from './env.js';
import { execute, getOne, getAll, json, fromJson, bool } from './turso.js';

// ── Key sanitization (para o que continua em KV — jobs/cache) ──────────────
function sanitizeKeyPart(part) {
    return String(part).replace(/[^a-zA-Z0-9_]/g, c =>
        'X' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
    );
}
export function kvKey(...parts) {
    return parts.map(sanitizeKeyPart).join('_');
}

function ns(name) {
    const binding = globalThis[name];
    if (!binding) throw new Error(`[edgeone] KV namespace "${name}" not bound. Configure no dashboard EdgeOne Pages → Storage → KV Storage.`);
    return binding;
}
async function kvGet(nsName, key) {
    const raw = await ns(nsName).get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
}
async function kvPut(nsName, key, value) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    await ns(nsName).put(key, raw);
}
async function kvDelete(nsName, key) { await ns(nsName).delete(key); }
async function kvList(nsName, opts = {}) { return ns(nsName).list(opts); }

// ── Planos ───────────────────────────────────────────────────────────────
// IDs mantidos (free/monthly/quarterly/annual) — a Pixgo tem os seus
// próprios (free/premium/premium_quarterly/premium_annual) e passou a
// reconhecer ESTES também como alias, em vez de renomear tudo aqui.
export const PLANS = {
    free: {
        id: 'free', name: 'Free', price: 0, is_free: true,
        features: ['10 min/dia por ferramenta', 'Até 5 trabalhos/dia por ferramenta'],
    },
    monthly: {
        id: 'monthly', name: 'Mensal',
        price: getEnvFloat('PLAN_MONTHLY_PRICE', 9),
        duration_days: 30,
        // Uso ilimitado é igual nos 3 planos pagos — não há diferenciação de
        // capacidade entre mensal/trimestral/anual aqui (ao contrário da
        // Pixgo, que diferencia perfis/downloads por tier).
        features: ['Uso ilimitado de todas as ferramentas', 'Sem limites diários'],
    },
    quarterly: {
        id: 'quarterly', name: 'Trimestral',
        price: getEnvFloat('PLAN_QUARTERLY_PRICE', 18),
        duration_days: 90,
        features: ['Uso ilimitado de todas as ferramentas', 'Sem limites diários'],
    },
    annual: {
        id: 'annual', name: 'Anual',
        price: getEnvFloat('PLAN_ANNUAL_PRICE', 40),
        duration_days: 365,
        features: ['Uso ilimitado de todas as ferramentas', 'Sem limites diários', 'Melhor valor'],
    },
};

function rowToUser(row) {
    if (!row) return null;
    return {
        id: row.id, username: row.username, email: row.email || null,
        password_hash: row.password, name: row.name || '',
        role: row.role || 'user', plan_id: row.plan_id || 'free',
        plan_expires_at: row.plan_expires_at || null,
        is_active: row.is_active == 1 || row.is_active === true,
        preferred_lang: (fromJson(row.preferences) || {}).language || 'en',
        // Identidade Google ("Continuar com Google") — null para contas
        // tradicionais e para contas ainda não vinculadas.
        google_sub: row.google_sub || null,
        created_at: row.created_at, updated_at: row.updated_at || null,
    };
}

class EdgeOneClient {

    async ping() {
        try { await execute('SELECT 1'); return true; }
        catch { return false; }
    }

    // ── Users — TURSO (tabela `users`, partilhada com a Pixgo) ─────────────
    async getUser(username)     { return rowToUser(await getOne('SELECT * FROM users WHERE username = ?', [username.toLowerCase()])); }
    async getUserById(id)       { return rowToUser(await getOne('SELECT * FROM users WHERE id = ?', [id])); }
    async getUserByEmail(email) { return rowToUser(await getOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])); }

    // Login "Continuar com Google" — busca pelo identificador estável do
    // Google (sub), nunca por e-mail (ver routes/auth.js para o motivo).
    async getUserByGoogleSub(googleSub) { return rowToUser(await getOne('SELECT * FROM users WHERE google_sub = ?', [googleSub])); }

    async createUser({ username, password, name, email, preferred_lang = 'en', google_sub = null }) {
        const id           = randomUUID();
        const passwordHash = await bcrypt.hash(password, 12);
        const now = new Date().toISOString();
        await execute(`
            INSERT INTO users (id, username, password, name, email, role, plan_id, plan_expires_at, is_active, failed_logins, locked_until, preferences, google_sub, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'user', 'free', NULL, 1, 0, NULL, ?, ?, ?, NULL)
        `, [id, username.toLowerCase(), passwordHash, name, email || null, json({ language: preferred_lang }), google_sub, now]);

        return { id, username: username.toLowerCase(), name, email: email || null, password_hash: passwordHash, role: 'user', plan_id: 'free', preferred_lang, google_sub, is_active: true, created_at: now };
    }

    async verifyPassword(user, password) { return bcrypt.compare(password, user.password_hash); }

    async updateUser(username, patch) {
        const user = await this.getUser(username);
        if (!user) return null;
        const fields = [], args = [];
        const setIf = (col, val) => { fields.push(`${col} = ?`); args.push(val); };

        if ('name' in patch) setIf('name', patch.name);
        if ('email' in patch) setIf('email', patch.email);
        if ('password_hash' in patch) setIf('password', patch.password_hash);
        if ('plan_id' in patch) setIf('plan_id', patch.plan_id);
        if ('plan_expires_at' in patch) setIf('plan_expires_at', patch.plan_expires_at);
        if ('preferred_lang' in patch) setIf('preferences', json({ language: patch.preferred_lang }));
        if ('google_sub' in patch) setIf('google_sub', patch.google_sub);

        if (fields.length > 0) {
            fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
            args.push(username.toLowerCase());
            await execute(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, args);
        }
        return this.getUser(username);
    }

    async changePassword(username, newPassword) {
        const hash = await bcrypt.hash(newPassword, 12);
        return this.updateUser(username, { password_hash: hash });
    }

    async getUserPreferences(userId) {
        const user = await this.getUserById(userId);
        return user ? { language: user.preferred_lang } : null;
    }

    // ── Refresh tokens — continuam em KV (efémero, não é identidade) ────────
    async storeRefreshToken(token, userId, expiresAt) { await kvPut('CACHE_NS', kvKey('refresh', token), { userId, expires_at: expiresAt }); }
    async getRefreshToken(token)    { return kvGet('CACHE_NS', kvKey('refresh', token)); }
    async deleteRefreshToken(token) { await kvDelete('CACHE_NS', kvKey('refresh', token)); }

    // ── Device pairing (login TV por código) — v3, fluxo invertido ─────────
    // O TELEMÓVEL (já autenticado) pede o código; a TV envia-o de volta numa
    // ÚNICA requisição e recebe sessão de imediato — sem polling, sem
    // WebSocket, sem segundo registo por device_id (ver routes/device.js
    // para o porquê). Efémero em KV, mesmo padrão dos refresh tokens: uma
    // única entrada `device_code:{code}` → { userId, expires_at, used }.
    async storeDeviceCode(code, userId, expiresAt) {
        await kvPut('CACHE_NS', kvKey('device_code', code), { userId, expires_at: expiresAt, used: false });
    }
    async getDeviceCode(code) { return kvGet('CACHE_NS', kvKey('device_code', code)); }
    async markDeviceCodeUsed(code) {
        const current = await this.getDeviceCode(code);
        if (!current) return null;
        const updated = { ...current, used: true };
        await kvPut('CACHE_NS', kvKey('device_code', code), updated);
        return updated;
    }
    async deleteDeviceCode(code) { await kvDelete('CACHE_NS', kvKey('device_code', code)); }

    // ── Subscriptions / Plans — TURSO (users.plan_id/plan_expires_at é a
    //     mesma fonte de verdade que a Pixgo já usa) ────────────────────────
    async getUserPlan(username) {
        const user = await this.getUser(username);
        if (!user) return null;
        const isActive = user.plan_id !== 'free' && (!user.plan_expires_at || new Date(user.plan_expires_at) > new Date());
        const planId = isActive ? user.plan_id : 'free';
        const def = PLANS[planId] || PLANS.free;
        return { ...def, is_active: isActive, expires_at: user.plan_expires_at || null };
    }

    async updateUserPlan(username, planId, expiresAt = null) {
        return this.updateUser(username, { plan_id: planId, plan_expires_at: expiresAt });
    }

    /** Activa uma assinatura a partir do webhook da Hotmart — escreve
     *  directamente em users.plan_id/plan_expires_at (fonte de verdade
     *  partilhada) e regista uma linha em `subscription` para auditoria,
     *  seguindo a mesma convenção que a Pixgo já usa para USDT. */
    async activateSubscriptionFromHotmart(username, { planId, hotmartTransactionId, durationDays }) {
        const user = await this.getUser(username);
        if (!user) return null;
        const expiresAt = new Date(Date.now() + durationDays * 86400 * 1000).toISOString();

        await this.updateUserPlan(username, planId, expiresAt);

        await execute(`
            INSERT INTO subscription (id, user_id, plan_id, tx_hash, network, amount_usdt, status, started_at, expires_at, created_at)
            VALUES (?, ?, ?, ?, 'hotmart', NULL, 'active', ?, ?, ?)
        `, [randomUUID(), user.id, planId, hotmartTransactionId || null, new Date().toISOString(), expiresAt, new Date().toISOString()]).catch(err => {
            console.error('[activateSubscriptionFromHotmart] falha ao gravar em subscription (não bloqueante):', err.message);
        });

        return { plan_id: planId, status: 'active', expires_at: expiresAt, hotmart_transaction_id: hotmartTransactionId };
    }

    /** Activa uma assinatura a partir do webhook do ZumboPay — mesmo padrão
     *  de activateSubscriptionFromHotmart, só muda a proveniência (network). */
    async activateSubscriptionFromZumbopay(userId, { planId, zumbopayReference, durationDays }) {
        const user = await this.getUserById(userId);
        if (!user) return null;
        const expiresAt = new Date(Date.now() + durationDays * 86400 * 1000).toISOString();

        await this.updateUserPlan(user.username, planId, expiresAt);

        await execute(`
            INSERT INTO subscription (id, user_id, plan_id, tx_hash, network, amount_usdt, status, started_at, expires_at, created_at)
            VALUES (?, ?, ?, ?, 'zumbopay', NULL, 'active', ?, ?, ?)
        `, [randomUUID(), user.id, planId, zumbopayReference || null, new Date().toISOString(), expiresAt, new Date().toISOString()]).catch(err => {
            console.error('[activateSubscriptionFromZumbopay] falha ao gravar em subscription (não bloqueante):', err.message);
        });

        return { plan_id: planId, status: 'active', expires_at: expiresAt, zumbopay_reference: zumbopayReference };
    }

    async cancelSubscription(username) {
        const user = await this.getUser(username);
        if (!user) return null;
        await execute("UPDATE subscription SET status = 'cancelled' WHERE user_id = ? AND status = 'active'", [user.id]).catch(() => {});
        await this.updateUserPlan(username, 'free', null);
        return { status: 'cancelled' };
    }

    async getSubscription(userId) {
        return getOne('SELECT * FROM subscription WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
    }

    // ── Jobs genéricos (compress/convert/pdf/etc.) — continuam em KV ────────
    async createJob(service, userId, data) {
        const id  = randomUUID();
        const job = { id, service, user_id: userId, status: 'pending', created_at: new Date().toISOString(), ...data };
        await kvPut('JOBS_NS', kvKey('job', service, id), job);
        await this._appendUserJobIndex(userId, service, id);
        return job;
    }
    async getJob(service, jobId) { return kvGet('JOBS_NS', kvKey('job', service, jobId)); }
    async updateJob(service, jobId, patch) {
        const job = await this.getJob(service, jobId);
        if (!job) return null;
        const updated = { ...job, ...patch, updated_at: new Date().toISOString() };
        await kvPut('JOBS_NS', kvKey('job', service, jobId), updated);
        return updated;
    }
    async _appendUserJobIndex(userId, service, jobId) {
        const key = kvKey('userjobs', userId);
        const list = (await kvGet('JOBS_NS', key)) || [];
        list.unshift({ service, id: jobId, ts: Date.now() });
        await kvPut('JOBS_NS', key, list.slice(0, 100));
    }
    async listUserJobs(userId, service = null) {
        const list = (await kvGet('JOBS_NS', kvKey('userjobs', userId))) || [];
        const filtered = service ? list.filter(j => j.service === service) : list;
        const jobs = await Promise.all(filtered.slice(0, 30).map(j => this.getJob(j.service, j.id)));
        return jobs.filter(Boolean);
    }

    // ── Daily usage quota — CACHE_NS ─────────────────────────────────────────
    async getDailyUsage(userId, service) {
        const day = new Date().toISOString().slice(0, 10);
        return (await kvGet('CACHE_NS', kvKey('usage', service, userId, day))) || 0;
    }
    async incrementDailyUsage(userId, service) {
        const day = new Date().toISOString().slice(0, 10);
        const key = kvKey('usage', service, userId, day);
        const current = (await kvGet('CACHE_NS', key)) || 0;
        await kvPut('CACHE_NS', key, current + 1);
        return current + 1;
    }

    // ── GeoIP cache — CACHE_NS ──────────────────────────────────────────────
    async getGeoIP(ip)       { return kvGet('CACHE_NS', kvKey('geo', ip)); }
    async setGeoIP(ip, data) { await kvPut('CACHE_NS', kvKey('geo', ip), data); }

    // ── KV genérico (rate-limit, QR dinâmico, etc.) — CACHE_NS ──────────────
    async get(namespaceAlias, key)        { return kvGet('CACHE_NS', kvKey(namespaceAlias, key)); }
    async put(namespaceAlias, key, value) { return kvPut('CACHE_NS', kvKey(namespaceAlias, key), value); }
}

export const edgeone = new EdgeOneClient();
