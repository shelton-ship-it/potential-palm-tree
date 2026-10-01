// routes/content.js — StreamPlatform v5.5
// FIX v5.5:
//   • CDN_DOMAIN eliminado por completo. /stream e /download já não
//     constroem nenhuma URL a partir de uma base fixa — dependem inteiramente
//     de playlist.masterUrl/noncesUrl (gravados pelo pipeline em
//     stealth_playlist, já como URL absoluta raw.githubusercontent.com).
//     Sem playlist, a rota devolve 404 explícito em vez de uma URL morta
//     construída a partir de uma base que já não existe.
// FIX v5.4:
//   • POST /api/pipeline/register removido deste ficheiro.
//     A rota existe APENAS em __default__.js (entrada única, sem duplicação).
//     Remover a duplicata eliminava a race condition de cold start que causava
//     500 intermitente no runner e no /stream.
// FIX v5.3:
//   • POST /api/content/:id/heartbeat — rota de acumulação de tempo de visualização.
//   • /stream passou a ser read-only no middleware.

import { authenticate, optionalAuth } from '../middleware/auth.js';
import { getEnv }                     from '../lib/env.js';
import { kvKey }                       from '../lib/edgeone.js';
import { getAll }                      from '../lib/turso.js';
import { resolveProfile }              from './mylist.js';

export default function (app) {

    // ── GET /api/content/:id ─────────────────────────────────────────────────
    app.get('/api/content/:id', async (req, res) => {
        const { id } = req.params;
        const lang   = req.query.lang || req.language || 'en';

        try {
            const content = await app.edgeone.getContent(id, lang);
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: 'Content not found' });
            }

            const [rawMeta, tags] = await Promise.all([
                app.edgeone.getContentMeta(id),
                app.edgeone.getContentTags(id),
            ]);

            const meta = {
                title:       content.title       ?? null,
                poster:      content.poster      ?? null,
                description: content.description ?? null,
                rating:      rawMeta?.rating     ?? content.rating ?? 0,
                genres:      rawMeta?.genres     ?? content.genres ?? [],
            };

            let seasons = [];
            if (['series', 'anime', 'dorama'].includes(content.type)) {
                const seasonRows = await getAll(
                    'SELECT * FROM season WHERE content_id = ? ORDER BY number ASC',
                    [id]
                );

                if (seasonRows.length > 0) {
                    const seasonIds    = seasonRows.map(s => s.id);
                    const placeholders = seasonIds.map(() => '?').join(', ');
                    const episodeRows  = await getAll(
                        `SELECT * FROM episode WHERE season_id IN (${placeholders}) ORDER BY season_id, number ASC`,
                        seasonIds
                    );

                    const episodesBySeason = {};
                    for (const ep of episodeRows) {
                        if (!episodesBySeason[ep.season_id]) episodesBySeason[ep.season_id] = [];
                        episodesBySeason[ep.season_id].push({
                            id:         ep.id,
                            content_id: ep.content_id,
                            season_id:  ep.season_id,
                            number:     ep.number,
                            title:      ep.title || null,
                            duration:   ep.duration || 0,
                        });
                    }

                    seasons = seasonRows.map(s => ({
                        id:            s.id,
                        content_id:    s.content_id,
                        number:        s.number,
                        episode_count: s.episode_count || 0,
                        episodes:      episodesBySeason[s.id] || [],
                    }));
                }
            }

            let downloadInfo = null;
            if (req.user) {
                const perm = await app.edgeone.canDownload(req.user.username);
                downloadInfo = {
                    available:     perm.allowed,
                    quality:       perm.quality,
                    plan_required: perm.allowed ? null : 'daily',
                    upgrade_url:   perm.allowed ? null : '/plans',
                };
            } else {
                downloadInfo = { available: false, plan_required: 'daily', upgrade_url: '/api/payments/plans' };
            }

            // PixGo Creative / likes ("Amei") — só consultado quando há sessão;
            // Rodada extra (set/2026): likes ("Amei") e o incremento
            // automático de `views` foram DESATIVADOS por decisão explícita
            // — cada GET /api/content/:id fazia 1 leitura extra (hasUserLiked)
            // e, para utilizadores logados, 1 ESCRITA extra no Turso
            // (setContent com views+1) a CADA carregamento de página, sem
            // exceção. Isso é o oposto do objetivo das rodadas anteriores
            // (reduzir pedidos ao máximo). progress/continue foi poupado
            // porque o limite do plano free depende dele; views/likes não
            // têm essa dependência, por isso ficam bloqueados por completo.
            //
            // `views`/`likes` continuam a ser devolvidos (valor histórico
            // congelado, tal como já estava gravado na BD) — só deixam de
            // ser lidos/escritos a cada pedido. Nada foi apagado da BD.

            // in_list (Rodada 3, inalterado) — continua a evitar o pedido
            // separado GET /api/mylist/check/:id quando ?profile_id= vem
            // no pedido.
            let inList;
            if (req.user && req.query.profile_id) {
                try {
                    const resolved = await resolveProfile(app, req, req.query.profile_id);
                    if (resolved) {
                        const list = await app.edgeone.getMyList(resolved.profileId, 500);
                        inList = list.some(item => item.content_id === id);
                    }
                } catch { /* omite in_list, cliente cai no fallback */ }
            }

            res.json({ ...content, meta, tags, seasons, download: downloadInfo, in_list: inList });

        } catch (err) {
            console.error('Content error:', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load content' });
        }
    });

    // ── GET /api/content/:id/stream ──────────────────────────────────────────
    // Read-only no middleware a partir de v5.3 — não acumula tempo de visualização.
    // Só verifica se o IP já esgotou a quota free (exhausted flag no KV).
    app.get('/api/content/:id/stream', authenticate, async (req, res) => {
        const { id }                                    = req.params;
        const { lang = 'en', episode, clientPubKey }   = req.query;

        try {
            const content = await app.edgeone.getContent(id, lang);
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: 'Content not found' });
            }

            const videoId = episode ? episode : id;

            const playlist = await app.edgeone.getStealthPlaylist(videoId);
            if (!playlist?.masterUrl) {
                return res.status(404).json({ error: 'Not Found', message: 'Stream metadata not found for this content' });
            }

            const masterUrl    = playlist.masterUrl;
            const noncesUrl    = playlist.noncesUrl || null;
            const isEncrypted  = playlist.encrypted === true || playlist.segExt === 'bin';

            if (!isEncrypted) {
                return res.json({
                    url:         masterUrl,
                    master_url:  masterUrl,
                    nonces_url:  null,
                    type:        'hls',
                    seg_ext:     playlist.segExt || 'ts',
                    content_id:  id,
                    episode_id:  episode || null,
                    lang,
                    drm_key_hex: null,
                    playlist,
                    quality:     playlist.qualities?.[0] || null,
                });
            }

            if (!clientPubKey) {
                return res.status(400).json({
                    error:   'ECDH Required',
                    message: 'clientPubKey is required for encrypted content. Upgrade your player.',
                });
            }

            if (!app.serverECDH) {
                return res.status(503).json({
                    error:   'Service Unavailable',
                    message: 'Key exchange service not initialised.',
                });
            }

            let clientPubBytes;
            try {
                clientPubBytes = Buffer.from(decodeURIComponent(clientPubKey), 'base64');
                if (clientPubBytes.length === 0) throw new Error('empty');
            } catch {
                return res.status(400).json({
                    error:   'Invalid clientPubKey',
                    message: 'clientPubKey must be a valid base64-encoded public key.',
                });
            }

            try {
                const chachaKey = getEnv('CHACHA_KEY', '');
                if (!chachaKey) {
                    console.error('[stream] CHACHA_KEY não configurada no servidor');
                    return res.status(503).json({
                        error:   'Service Unavailable',
                        message: 'Decryption key not configured on server.',
                    });
                }

                const { serverPubB64 } = await app.serverECDH(
                    clientPubBytes,
                    videoId,
                    req.user.id
                );

                return res.json({
                    url:          masterUrl,
                    master_url:   masterUrl,
                    nonces_url:   noncesUrl,
                    type:         'hls',
                    seg_ext:      playlist.segExt || 'bin',
                    content_id:   id,
                    episode_id:   episode || null,
                    lang,
                    drm_key_hex:  chachaKey,
                    server_pub:   serverPubB64,
                    playlist,
                    quality:      playlist.qualities?.[0] || null,
                    resolution:   `${playlist.width || ''}x${playlist.height || ''}`,
                });
            } catch (ecdhErr) {
                console.error('[stream] ECDH failed:', ecdhErr.message, ecdhErr.stack);
                return res.status(500).json({
                    error:   'Key Exchange Failed',
                    message: 'Unable to establish secure key exchange. Please retry.',
                });
            }

        } catch (err) {
            console.error('Stream error:', err.message, err.stack);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get stream URL' });
        }
    });

    // ── POST /api/content/:id/heartbeat ──────────────────────────────────────
    // Chamado pelo player a cada 30s apenas enquanto o vídeo está a ser reproduzido.
    // O rateLimitMiddleware (global, já aplicado antes desta rota) trata de:
    //   • Verificar autenticação (401 se não autenticado)
    //   • Utilizadores pagos → pass-through imediato (res.json + return)
    //   • Utilizadores free  → acumular 30s no KV, devolver 429 se quota esgotada
    // Se o middleware chamar next(), o utilizador é pago e chegou aqui → confirmar.
    app.post('/api/content/:id/heartbeat', authenticate, async (req, res) => {
        // Utilizador pago — middleware deixou passar, confirmar apenas.
        // O position é registado no KV de progresso para "continue watching".
        const { id }       = req.params;
        const { position } = req.body;

        // Aproveitar o heartbeat para actualizar progresso silenciosamente
        // (sem throttle — o heartbeat já é a cada 30s, intervalo razoável)
        if (position !== undefined && req.user) {
            const profileKey = `progress:hb:${req.user.id}:${id}`;
            app.edgeone.put('progress', profileKey, JSON.stringify({
                content_id: id,
                user_id:    req.user.id,
                position:   Math.floor(position),
                updated_at: new Date().toISOString(),
            })).catch(() => {});
        }

        res.json({ allowed: true, paid: true });
    });

    // ── GET /api/content/:id/chunks ──────────────────────────────────────────
    app.get('/api/content/:id/chunks', authenticate, async (req, res) => {
        const { id }                   = req.params;
        const { lang = 'en', quality } = req.query;

        try {
            const content = await app.edgeone.getContent(id, lang);
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: 'Content not found' });
            }

            const prefix = kvKey('chunk_content', id, lang) + (quality ? '_' + kvKey(quality) : '_');
            const keys   = await app.edgeone.list('chunks', prefix);
            const chunks = [];

            for (const key of keys) {
                const hash = await app.edgeone.get('chunks', key);
                if (!hash) continue;
                const chunk = await app.edgeone.getChunkByHash(hash);
                if (!chunk) continue;
                chunks.push(chunk);
            }

            chunks.sort((a, b) => a.chunk_index - b.chunk_index);
            res.json({ content_id: id, title: content.title, lang, chunks });

        } catch (err) {
            console.error('Chunks error:', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load chunks' });
        }
    });

    // ── GET /api/content/:id/download ─────────────────────────────────────────
    app.get('/api/content/:id/download', authenticate, async (req, res) => {
        const { id }                   = req.params;
        const { lang = 'en', episode } = req.query;

        try {
            const contentId = episode || id;
            const content   = await app.edgeone.getContent(id, lang);
            if (!content) {
                return res.status(404).json({ error: 'Not Found', message: 'Content not found' });
            }

            const { allowed, plan, remaining, max } = await app.edgeone.canDownload(req.user.username, req.user.id);
            if (!allowed) {
                return res.status(403).json({
                    error:        'Download Not Available',
                    message:      plan === 'free'
                        ? 'Download disponível nos planos pagos'
                        : `Limite mensal de ${max} downloads atingido para o plano ${app.edgeone.PLANS[plan]?.name || plan}.`,
                    current_plan: plan,
                    exhausted:    plan !== 'free',
                    upgrade_url:  'https://app.pixgo.qzz.io/main/plans',
                    plans: ['monthly', 'quarterly', 'annual']
                        .map(id => app.edgeone.PLANS[id])
                        .map(p => ({ id: p.id, name: p.name, price: p.price, label: p.label, features: p.features })),
                });
            }

            const playlist = await app.edgeone.getStealthPlaylist(contentId);
            if (!playlist?.masterUrl) {
                return res.status(404).json({ error: 'Not Found', message: 'Stream metadata not found' });
            }

            const crypto    = await import('crypto');
            const secret    = getEnv('DOWNLOAD_TOKEN_SECRET') || getEnv('JWT_SECRET') || '';
            const expiresIn = 30 * 24 * 3600;
            const licPayload = {
                cid:  contentId,
                uid:  req.user.id,
                exp:  Math.floor(Date.now() / 1000) + expiresIn,
                type: 'offline',
            };
            const licData  = Buffer.from(JSON.stringify(licPayload)).toString('base64url');
            const licSig   = crypto.createHmac('sha256', secret).update(licData).digest('hex');
            const license  = `${licData}.${licSig}`;

            // rawBase derivado directamente do masterUrl já gravado — sem
            // depender de nenhuma base fixa (CDN_DOMAIN eliminado).
            // masterUrl: https://raw.githubusercontent.com/{owner}/{repo}/storage-main/{job_id}/master.m3u8
            const rawBase  = playlist.masterUrl.replace(/\/master\.m3u8$/, '');
            const segCount = playlist.segmentCount || 0;
            const segUrls  = [];
            for (let i = 0; i < segCount; i++) {
                const seg = String(i).padStart(5, '0');
                segUrls.push(`${rawBase}/hls/seg${seg}.bin`);
            }
            // FIX: faltava o segmento de inicialização (init.bin, moov/ftyp fMP4)
            // no manifesto de download — sem ele o MSE nunca consegue inicializar
            // o SourceBuffer para reproduzir os segmentos gravados offline, por
            // mais que estes estejam todos descarregados. Mesma convenção de
            // path usada pelo BinLoader do player (ver comentário no topo de
            // ShakaPlayer.tsx: "#EXT-X-MAP:URI=\"init.bin\"").
            const initUrl = `${rawBase}/hls/init.bin`;

            // FIX: o manifesto de download nunca incluía a chave de decifragem
            // (drm_key_hex) — sem ela o cliente descarrega os segmentos .bin
            // cifrados mas não tem como os decifrar offline, e a reprodução
            // offline nunca poderia funcionar. CHACHA_KEY é uma única chave
            // global do servidor (não é por sessão/ECDH) — é a MESMA chave já
            // devolvida em claro por GET /api/content/:id/stream para qualquer
            // assinante autenticado; incluí-la aqui não expõe nada que um
            // utilizador com acesso ao conteúdo já não conseguisse obter.
            const encrypted  = playlist.encrypted ?? true;
            const drmKeyHex  = encrypted ? (getEnv('CHACHA_KEY', '') || null) : null;

            app.edgeone.put('progress', kvKey('download_request', req.user.id, String(Date.now())), JSON.stringify({
                content_id: id,
                episode_id: episode || null,
                user_id:    req.user.id,
                lang,
                at:         new Date().toISOString(),
            })).catch(() => {});

            // Conta para a quota mensal (20/mês, 200/mês, ilimitado no anual —
            // ver canDownload). Fire-and-forget, igual ao log acima.
            app.edgeone.incrementMonthlyDownloadCount(req.user.id).catch(() => {});

            res.json({
                license,
                expires_in: expiresIn,
                expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                drm_key_hex: drmKeyHex,
                manifest: {
                    contentId,
                    segmentCount: segCount,
                    noncesUrl:    playlist.noncesUrl,
                    masterUrl:    playlist.masterUrl,
                    initUrl,
                    segUrls,
                    encrypted,
                    segExt:       playlist.segExt || 'bin',
                },
                content: {
                    id:       content.id,
                    title:    content.title,
                    type:     content.type,
                    poster:   content.poster,
                    duration: content.duration,
                },
                plan,
                downloads_remaining: remaining, // null = ilimitado (anual)
                downloads_max:       max,       // null = ilimitado (anual)
            });

        } catch (err) {
            console.error('Download error:', err.message, err.stack);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to prepare offline download' });
        }
    });

    // ── GET /download/:contentId/:quality — legado ────────────────────────────
    app.get('/download/:contentId/:quality', (req, res) => {
        res.status(410).json({
            error:   'Gone',
            message: 'Este endpoint foi descontinuado. Use GET /api/content/:id/download.',
            docs:    '/api/content/:id/download',
        });
    });

    // ── PixGo Creative — likes ("Amei") — DESATIVADO (rodada extra, set/2026) ─
    // Decisão explícita: likes geravam requests/escritas desnecessárias
    // (objetivo das rodadas era reduzir isso ao máximo). Os endpoints ficam
    // aqui só como 410 Gone — nunca chegam a tocar no Turso — em vez de
    // removidos, para qualquer chamada antiga (cache de app mobile, aba já
    // aberta, etc.) receber uma resposta clara em vez de um 404 confuso.
    // `app.edgeone.likeContent`/`unlikeContent` continuam a existir em
    // lib/edgeone.js (não removidos), só deixaram de ter rota que os chame.
    app.post('/api/content/:id/like', (req, res) => {
        res.status(410).json({ error: 'Gone', message: 'A funcionalidade de likes foi desativada.' });
    });

    app.delete('/api/content/:id/like', (req, res) => {
        res.status(410).json({ error: 'Gone', message: 'A funcionalidade de likes foi desativada.' });
    });
}
