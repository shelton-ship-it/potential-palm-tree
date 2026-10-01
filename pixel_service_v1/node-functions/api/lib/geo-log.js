// lib/geo-log.js — Geolocalização EdgeOne + Turso (associada ao user_id)
// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMADO POR TESTE REAL (curl autenticado em produção, não assumido):
// nem `req.eo.geo` nem `req.geo` chegam populados no Express (modo Framework
// / Node Functions, [[default]].js). A EdgeOne entrega a geo através do
// HEADER `eo-connecting-geo` — e já vem pré-parseado como objecto pela
// plataforma (não é preciso JSON.parse na prática, mas o código abaixo trata
// os dois casos por segurança, caso a plataforma mude isso).
//
// Payload real observado (Maputo, rede tmcel.mz):
//   { asn: "30619", countryName: "Mozambique", countryCodeAlpha2: "MZ",
//     countryCodeNumeric: "508", regionName: "Maputo", regionCode: "MZ-MPM",
//     cityName: "Unknown", latitude: "-25.968100", longitude: "32.580650",
//     cisp: "tmcel.mz" }
//
// Dois campos do pedido NÃO existem neste header — ficam sempre NULL,
// conforme já previsto na spec ("os demais campos devem aceitar NULL"):
//   countryCodeAlpha3, continent
//
// Campo extra que a EdgeOne fornece mas não estava no pedido nem na tabela:
//   cisp (nome da operadora/ISP, ex: "tmcel.mz") — NÃO guardado para já.
//   Avisar o user se quiser adicionar coluna própria numa próxima rodada.
//
// O IP continua a vir por eo-connecting-ip (mesmo header já confirmado
// e usado por lib/geoip.js), com fallback para a cadeia existente.
// ─────────────────────────────────────────────────────────────────────────────

import { execute, insert } from './turso.js';
import { getClientIP }     from './geoip.js';
import { getEnv }          from './env.js';

let _schemaReady = null;

// ── Schema ─────────────────────────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS é idempotente — corre uma vez por cold start
// (promise cacheada), não a cada request.
export function ensureGeoLogsTable() {
    if (_schemaReady) return _schemaReady;

    _schemaReady = (async () => {
        await execute(`
            CREATE TABLE IF NOT EXISTS geo_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                ip TEXT,
                country_name TEXT,
                country_code_alpha2 TEXT,
                country_code_alpha3 TEXT,
                country_code_numeric TEXT,
                region_name TEXT,
                region_code TEXT,
                city_name TEXT,
                latitude REAL,
                longitude REAL,
                continent TEXT,
                asn INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await execute(`CREATE INDEX IF NOT EXISTS idx_geo_logs_user_id    ON geo_logs(user_id)`);
        await execute(`CREATE INDEX IF NOT EXISTS idx_geo_logs_created_at ON geo_logs(created_at)`);
    })().catch(err => {
        // Não deixar a promise cacheada "presa" em erro — próxima chamada tenta de novo.
        _schemaReady = null;
        throw err;
    });

    return _schemaReady;
}

// ── Extração do header eo-connecting-geo ────────────────────────────────────
function parseGeoHeader(req) {
    const raw = req.headers['eo-connecting-geo'];
    if (!raw) return null;
    if (typeof raw === 'object') return raw; // já vem parseado pela EdgeOne (confirmado)
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
}

function toFloatOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

function toIntOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

// ── Extração defensiva de IP + geo do request ────────────────────────────────
// Nunca lança — devolve o máximo de informação disponível, resto a null.
export function extractGeoData(req) {
    // IP: header nativo EdgeOne, com fallback para a cadeia já testada em
    // lib/geoip.js (EO-Connecting-IP / XFF / cf-connecting-ip / etc).
    const ip = req.headers['eo-connecting-ip'] || getClientIP(req) || null;

    const raw = parseGeoHeader(req);
    const geo = raw ? {
        countryName:        raw.countryName        ?? null,
        countryCodeAlpha2:  raw.countryCodeAlpha2   ?? null,
        countryCodeAlpha3:  null, // não fornecido por este header (confirmado)
        countryCodeNumeric: raw.countryCodeNumeric  ?? null,
        regionName:         raw.regionName          ?? null,
        regionCode:         raw.regionCode          ?? null,
        cityName:           raw.cityName            ?? null,
        latitude:           toFloatOrNull(raw.latitude),
        longitude:          toFloatOrNull(raw.longitude),
        continent:          null, // não fornecido por este header (confirmado)
        asn:                toIntOrNull(raw.asn),
    } : null;

    const isLocalDev = getEnv('NODE_ENV') !== 'production';

    if (!geo && isLocalDev) {
        // Mock EXCLUSIVO de desenvolvimento local (spec secção 12) — nunca
        // usado em produção (guardado atrás do NODE_ENV !== 'production').
        return {
            ip: ip || '127.0.0.1',
            geo: {
                countryName: 'Mozambique', countryCodeAlpha2: 'MZ', countryCodeAlpha3: null,
                countryCodeNumeric: '508', regionName: 'Maputo', regionCode: 'MZ-MPM',
                cityName: 'Maputo', latitude: -25.9681, longitude: 32.5807,
                continent: null, asn: 30619,
            },
            mocked: true,
        };
    }

    return { ip, geo, mocked: false };
}

// ── Insert ─────────────────────────────────────────────────────────────────
export async function insertGeoLog(userId, ip, geo) {
    await ensureGeoLogsTable();

    const g = geo || {};
    await insert(
        `INSERT INTO geo_logs (
            user_id, ip,
            country_name, country_code_alpha2, country_code_alpha3, country_code_numeric,
            region_name, region_code, city_name,
            latitude, longitude, continent, asn
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, ip || null,
            g.countryName ?? null, g.countryCodeAlpha2 ?? null, g.countryCodeAlpha3 ?? null, g.countryCodeNumeric ?? null,
            g.regionName ?? null, g.regionCode ?? null, g.cityName ?? null,
            g.latitude ?? null, g.longitude ?? null, g.continent ?? null, g.asn ?? null,
        ],
    );
}
