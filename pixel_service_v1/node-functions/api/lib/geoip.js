// lib/geoip.js — GeoIP language detection
// FIX v2: Tencent EdgeOne Pages envia o IP real do cliente no header
// EO-Connecting-IP por defeito em todos os requests, sem configuração adicional.
// Documentação oficial: https://edgeone.ai/document/54211
//
// ATENÇÃO: NÃO usar X-Forwarded-For como primeira opção na EdgeOne.
// Quando o cliente não envia XFF, a EdgeOne preenche-o com o IP do nó edge
// (proxy da Tencent), não com o IP do cliente real.
// EO-Connecting-IP é sempre o IP real do iniciador do request.
//
// Ordem de prioridade:
//   1. EO-Connecting-IP  ← EdgeOne Pages (header nativo, sempre presente)
//   2. X-Forwarded-For   ← apenas como fallback para outros ambientes
//   3. cf-connecting-ip  ← Cloudflare
//   4. x-real-ip         ← Nginx/outros
//   5. req.ip            ← Express (último recurso)

import { getEnv } from './env.js';

const COUNTRY_LANGUAGE_MAP = {
    // Portuguese
    BR: 'pt', PT: 'pt', MZ: 'pt', AO: 'pt', CV: 'pt',
    GW: 'pt', ST: 'pt', TL: 'pt', GQ: 'pt', MO: 'pt',
    // Todos os outros países → inglês
    DEFAULT: 'en',
};

export const SUPPORTED_LANGUAGES = ['pt', 'en'];
export const DEFAULT_LANGUAGE    = 'en';

const memCache      = new Map();
const MEM_CACHE_TTL = 24 * 3600 * 1000;
// FIX (memória da instância): este Map é chaveado por IP de VISITANTE e só
// expirava logicamente (o TTL era verificado na leitura, mas a entrada nunca
// era removida) — numa instância de longa vida crescia 1 entrada por IP único,
// sem limite. Agora tem tecto (LRU simples pela ordem de inserção do Map).
// O KV continua a ser a fonte de verdade; perder uma entrada só custa uma
// leitura extra ao KV.
const MEM_CACHE_MAX = Number(process.env.GEOIP_MEM_CACHE_MAX) || 5000;
function memCacheSet(ip, value) {
    memCache.delete(ip);              // re-inserir move para o fim (mais recente)
    memCache.set(ip, value);
    while (memCache.size > MEM_CACHE_MAX) memCache.delete(memCache.keys().next().value);
}

// ── getClientIP ───────────────────────────────────────────────────────────────
// FIX v3: A documentação de EO-Connecting-IP (edgeone.ai/document/54211) descreve-o
// como um header de ORIGIN-PULL — i.e. quando a EdgeOne (CDN) busca conteúdo num
// servidor de origem externo. As nossas rotas correm como EdgeOne Pages Node
// Functions (cloud-functions/api/[[default]].js), que é um caminho de request
// diferente — a função corre diretamente no edge, não há "pull" a uma origem.
// Não há garantia documentada de que EO-Connecting-IP chegue às Node Functions.
//
// A doc oficial das Node Functions (pages.edgeone.ai/document/node-functions)
// documenta sim um campo nativo e garantido pela plataforma: `context.clientIp`
// no EventContext (modo Handler). Em modo Framework (Express, o nosso caso),
// a EdgeOne propaga esse mesmo valor para o objecto `req` do Express — por isso
// verificamos req.clientIp em primeiro lugar, com os headers como fallback.
//
// Ordem de prioridade:
//   1. req.clientIp        ← campo nativo da plataforma EdgeOne Pages (Node Functions)
//   2. EO-Connecting-IP    ← header de origin-pull da EdgeOne (pode não estar presente)
//   3. X-Forwarded-For     ← fallback universal (primeiro IP da cadeia)
//   4. cf-connecting-ip    ← Cloudflare (caso haja proxy adicional)
//   5. x-real-ip           ← Nginx/outros
//   6. req.ip              ← Express (último recurso)
export function getClientIP(req) {
    // 1. EdgeOne Pages Node Functions — campo nativo do runtime (sem dependência
    //    de configuração no console, disponível mesmo no plano free).
    if (req.clientIp && typeof req.clientIp === 'string' && req.clientIp.trim()) {
        return req.clientIp.trim();
    }

    // 2. EdgeOne — header de origin-pull (pode não existir em Pages Functions)
    const eoConnectingIP = req.headers['eo-connecting-ip'];
    if (eoConnectingIP && eoConnectingIP.trim()) return eoConnectingIP.trim();

    // 3. X-Forwarded-For — primeiro IP da cadeia (fallback universal)
    //    NOTA: se o cliente já enviar XFF, a EdgeOne só acrescenta o IP do proxy
    //    a seguir ao existente — o primeiro valor continua a ser o IP real do
    //    cliente. Só quando o cliente NÃO envia XFF é que a EdgeOne o define como
    //    o IP do nó edge — nesse caso já terá havido match no passo 1 ou 2 acima.
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const first = xff.split(',')[0].trim();
        if (first) return first;
    }

    // 4. Cloudflare
    const cfIP = req.headers['cf-connecting-ip'];
    if (cfIP) return cfIP;

    // 5. Nginx / outros reversos
    const realIP = req.headers['x-real-ip'];
    if (realIP) return realIP;

    // 6. Express req.ip (último recurso)
    return req.ip || null;
}

function isLocalIP(ip) {
    return !ip || ip === '127.0.0.1' || ip === '::1' ||
        ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.');
}

function parseAcceptLanguage(accept) {
    if (!accept) return [];
    return accept.split(',')
        .map(l => {
            const [code, q = 'q=1'] = l.trim().split(';');
            const lang    = code.split('-')[0].toLowerCase();
            const quality = parseFloat(q.split('=')[1] || '1');
            return { lang, quality };
        })
        .filter(({ lang }) => SUPPORTED_LANGUAGES.includes(lang))
        .sort((a, b) => b.quality - a.quality)
        .map(({ lang }) => lang);
}

async function lookupCountry(ip, req) {
    // 1. Cloudflare (cf-ipcountry) — fallback se usar Cloudflare como proxy adicional
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && cfCountry !== 'XX') return cfCountry.toUpperCase();

    // 2. Vercel
    const vercelCountry = req.headers['x-vercel-ip-country'];
    if (vercelCountry) return vercelCountry.toUpperCase();

    // 3. Header customizado genérico (retro-compatibilidade)
    const edgeCountry = req.headers['x-edge-country'];
    if (edgeCountry) return edgeCountry.toUpperCase();

    // 4. External fallback — dev only
    if (getEnv('NODE_ENV') !== 'production') {
        try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 800);
            try {
                const response = await fetch(`https://ipapi.co/${ip}/country/`, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'StreamPlatform/4.0' },
                });
                if (response.ok) {
                    // FIX: o timer só é limpo DEPOIS de ler o corpo (antes era
                    // limpo ao chegarem os headers, deixando o .text() sem limite).
                    const text = (await response.text()).trim().toUpperCase();
                    if (text.length === 2) return text;
                }
            } finally {
                clearTimeout(timeout);
            }
        } catch { /* timeout ou erro de rede */ }
    }

    return null;
}

export async function detectLanguage(req) {
    const ip = getClientIP(req);

    // 1. Cookie preference (prioridade máxima)
    const cookieLang = req.cookies?.preferred_language;
    if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang)) {
        return { lang: cookieLang, source: 'cookie' };
    }

    // 2. Preferência do utilizador autenticado
    if (req.user?.id && req.app?.edgeone) {
        try {
            const prefs = await req.app.edgeone.getUserPreferences(req.user.id);
            if (prefs?.language && SUPPORTED_LANGUAGES.includes(prefs.language)) {
                return { lang: prefs.language, source: 'user-preference' };
            }
        } catch { /* non-fatal */ }
    }

    if (!isLocalIP(ip)) {
        // 3. Cache em memória
        const cached = memCache.get(ip);
        if (cached && Date.now() - cached.ts < MEM_CACHE_TTL) {
            return { lang: cached.lang, source: 'cache' };
        }

        // 4. Cache KV da EdgeOne
        if (req.app?.edgeone) {
            try {
                const kvGeo = await req.app.edgeone.getGeoIP(ip);
                if (kvGeo?.language) {
                    memCacheSet(ip, { lang: kvGeo.language, ts: Date.now() });
                    return { lang: kvGeo.language, source: 'kv-cache' };
                }
            } catch { /* non-fatal */ }
        }

        // 5. Lookup GeoIP
        try {
            const country = await lookupCountry(ip, req);
            if (country) {
                const lang = COUNTRY_LANGUAGE_MAP[country] || COUNTRY_LANGUAGE_MAP.DEFAULT;
                memCacheSet(ip, { lang, ts: Date.now() });
                if (req.app?.edgeone) {
                    req.app.edgeone.setGeoIP(ip, { language: lang, country, ts: Date.now() }).catch(() => {});
                }
                return { lang, source: 'geoip' };
            }
        } catch { /* non-fatal */ }
    }

    // 6. Accept-Language header
    const acceptLangs = parseAcceptLanguage(req.headers['accept-language']);
    if (acceptLangs.length) return { lang: acceptLangs[0], source: 'accept-language' };

    // 7. Default
    return { lang: DEFAULT_LANGUAGE, source: 'default' };
}

export { COUNTRY_LANGUAGE_MAP };