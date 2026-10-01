// lib/session-cookie.js — helpers de cookie de sessão partilhada
// ─────────────────────────────────────────────────────────────────────────────
// Extraído de routes/auth.js (v2.0) para ser reaproveitado por routes/device.js
// sem duplicar a lógica de domínio/TTL do cookie pixgo_session — a sessão da
// TV tem de ter EXACTAMENTE a mesma duração que a sessão normal (365d via
// JWT_ACCESS_TTL), nunca a duração curta do código de pareamento.
// ─────────────────────────────────────────────────────────────────────────────

import { getEnv } from './env.js';

export function getRefreshDays() { return Number(getEnv('REFRESH_TOKEN_DAYS', '90')); }
export function cookieDomain()   { return getEnv('COOKIE_DOMAIN', '.pixgo.qzz.io'); }

export function accessTtlMs() {
    const ttl = getEnv('JWT_ACCESS_TTL', '365d');
    const n = parseInt(ttl, 10);
    if (ttl.endsWith('d')) return n * 86400 * 1000;
    if (ttl.endsWith('h')) return n * 3600 * 1000;
    return 365 * 86400 * 1000;
}

/** Define o cookie de sessão partilhado entre todos os subdomínios. */
export function setSessionCookie(res, token) {
    res.cookie('pixgo_session', token, {
        domain: cookieDomain(),
        httpOnly: true,
        secure: true,
        sameSite: 'none', // mesmo padrão já comprovado em produção na Pixgo
        maxAge: accessTtlMs(),
        path: '/',
    });
}

export function clearSessionCookie(res) {
    res.clearCookie('pixgo_session', { domain: cookieDomain(), path: '/' });
}

/**
 * Cookie de "TV emparelhada" — marca ESTE dispositivo (browser/WebView da TV)
 * como associado à conta via o fluxo de código de pareamento. Domain
 * partilhado, tal como pixgo_session, para que pixel_service_v1
 * (api.pixgo.qzz.io) o veja nos pedidos de streaming vindos deste mesmo
 * dispositivo, sem precisar de sincronizar nenhum device_id entre os dois
 * serviços — ver middleware/rate-limit.js (isTvPairedRequest) no
 * pixel_service_v1: uma TV com este cookie fica isenta da regra de "um
 * dispositivo activo" do plano free (não disputa o slot com o telemóvel
 * que a emparelhou, nem é ela própria expulsa).
 */
export function setTvPairedCookie(res) {
    res.cookie('pixgo_tv_paired', '1', {
        domain: cookieDomain(),
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: accessTtlMs(), // mesma duração da sessão — não expira antes dela
        path: '/',
    });
}
