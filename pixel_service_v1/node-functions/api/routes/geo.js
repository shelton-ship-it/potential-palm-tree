// routes/geo.js — GET /api/geo
// Regista IP + geolocalização (EdgeOne) associados ao user_id autenticado.
// user_id é a identidade principal; IP/ASN/geo são só informação complementar
// (nunca usados como identificador nem para limitar/bloquear o utilizador).

import { authenticate }               from '../middleware/auth.js';
import { extractGeoData, insertGeoLog } from '../lib/geo-log.js';

export default function (app) {

    // ── GET /api/geo ──────────────────────────────────────────────────────────
    app.get('/api/geo', authenticate, async (req, res) => {
        try {
            const { ip, geo } = extractGeoData(req);

            // user_id é o único campo obrigatório — os restantes aceitam NULL
            // quando a EdgeOne não os fornecer (spec secção 4).
            await insertGeoLog(req.user.id, ip, geo);

            res.json({
                user_id:              req.user.id,
                ip:                   ip || null,
                countryName:          geo?.countryName          ?? null,
                countryCodeAlpha2:    geo?.countryCodeAlpha2    ?? null,
                countryCodeAlpha3:    geo?.countryCodeAlpha3    ?? null,
                countryCodeNumeric:   geo?.countryCodeNumeric   ?? null,
                regionName:           geo?.regionName           ?? null,
                regionCode:           geo?.regionCode           ?? null,
                cityName:             geo?.cityName             ?? null,
                latitude:             geo?.latitude             ?? null,
                longitude:            geo?.longitude            ?? null,
                continent:            geo?.continent            ?? null,
                asn:                  geo?.asn                  ?? null,
            });
        } catch (err) {
            console.error('[geo] error:', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to register geo data' });
        }
    });
}
