// lib/geo-country.js — País do utilizador para RESOLUÇÃO DE GATEWAY DE PAGAMENTO
// ─────────────────────────────────────────────────────────────────────────────
// PORTADO de pixel_service_v1/node-functions/api/lib/geo-log.js — mesma extração
// já CONFIRMADA POR TESTE REAL em produção (curl autenticado, Maputo/tmcel.mz):
// a EdgeOne entrega a geolocalização através do header `eo-connecting-geo`,
// já pré-parseado como objecto pela plataforma (tratamos os dois casos —
// objecto ou string JSON — por segurança, caso isso mude).
//
// PORQUÊ UM FICHEIRO NOVO EM VEZ DE REUTILIZAR lib/geoip.js DESTE PROJECTO:
// o lookupCountry() que já existe em lib/geoip.js NUNCA leu o header
// `eo-connecting-geo` — só cf-ipcountry / x-vercel-ip-country / x-edge-country
// / fallback externo (ipapi.co, só em dev). Ou seja, a deteção "testada" de
// que fala o pedido nunca esteve realmente em uso aqui — só no
// pixel_service_v1. Para não arriscar o comportamento de idioma já em
// produção (geoip.js/detectLanguage), este ficheiro é aditivo: reutiliza
// getClientIP() (import, não duplicado) e acrescenta a MESMA leitura do
// header já validada no pixel_service_v1, só para decidir gateway/preço.
//
// Payload real observado (Maputo, rede tmcel.mz), igual ao confirmado no
// pixel_service_v1:
//   { asn: "30619", countryName: "Mozambique", countryCodeAlpha2: "MZ",
//     countryCodeNumeric: "508", regionName: "Maputo", regionCode: "MZ-MPM",
//     cityName: "Unknown", latitude: "-25.968100", longitude: "32.580650",
//     cisp: "tmcel.mz" }
// ─────────────────────────────────────────────────────────────────────────────

import { getClientIP } from './geoip.js';
import { getEnv }      from './env.js';

function parseGeoHeader(req) {
    const raw = req.headers['eo-connecting-geo'];
    if (!raw) return null;
    if (typeof raw === 'object') return raw; // já vem parseado pela EdgeOne (confirmado)
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
}

/**
 * Devolve o código de país ISO alpha-2 (ex.: "MZ") do pedido actual, ou null
 * se não for possível determinar. NUNCA lança.
 *
 * Ordem de prioridade (mesma lógica testada no pixel_service_v1 + fallback
 * já existente neste projecto para não perder cobertura fora da EdgeOne):
 *   1. header `eo-connecting-geo` → countryCodeAlpha2   (fonte testada)
 *   2. cf-ipcountry / x-vercel-ip-country / x-edge-country (já existentes
 *      em lib/geoip.js — reaproveitados via fallback simples aqui, sem
 *      duplicar a função: se precisares deles, chama lookupCountryFallback)
 *   3. mock de desenvolvimento (NODE_ENV !== 'production'), devolve 'MZ' —
 *      mesma convenção já usada em geo-log.js do pixel_service_v1, para que
 *      testar localmente o fluxo ZumboPay não exija headers reais.
 */
export function getCountry(req) {
    try {
        const geo = parseGeoHeader(req);
        const fromHeader = geo?.countryCodeAlpha2;
        if (fromHeader && typeof fromHeader === 'string' && fromHeader.length === 2) {
            return fromHeader.toUpperCase();
        }

        // Fallbacks simples (mesmos headers que lib/geoip.js já conhece,
        // sem depender de detectLanguage/lookupCountry — puramente síncrono).
        const cfCountry = req.headers['cf-ipcountry'];
        if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase();

        const vercelCountry = req.headers['x-vercel-ip-country'];
        if (vercelCountry) return vercelCountry.toUpperCase();

        const edgeCountry = req.headers['x-edge-country'];
        if (edgeCountry) return edgeCountry.toUpperCase();

        if (getEnv('NODE_ENV') !== 'production') {
            // Mock EXCLUSIVO de desenvolvimento local — nunca usado em
            // produção (guardado atrás do NODE_ENV !== 'production'), mesma
            // convenção do mock em geo-log.js do pixel_service_v1.
            return getEnv('DEV_MOCK_COUNTRY', 'MZ').toUpperCase();
        }

        return null;
    } catch (err) {
        console.error('[geo-country] falha ao determinar país (não bloqueante):', err.message);
        return null;
    }
}

/** Only used for logging/diagnostics — never for identification/blocking. */
export function getClientIPForLog(req) {
    return req.headers['eo-connecting-ip'] || getClientIP(req) || null;
}
