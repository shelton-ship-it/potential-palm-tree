// routes/channels.js
// ── Arquitetura (pedido explícito do dono da plataforma) ───────────────────
//
// Playlist.m3u/logos.json são servidos via jsDelivr (CDN público, mirror do
// repo GitHub shelton-ship-it/assets-main) — já é um CDN, não precisa de um
// backend a fazer de intermediário. A versão anterior desta rota baixava o
// M3U inteiro DENTRO da função serverless, fazia parsing e guardava tudo em
// memória por instância (_memCache) só para depois paginar/filtrar e reenviar
// como JSON ao frontend — desperdício de memória/CPU/tempo de execução numa
// função serverless para servir um ficheiro que já é público.
//
// Agora: o browser busca playlist.m3u + logos.json DIRECTAMENTE ao jsDelivr
// e faz o parsing/paginação/pesquisa no cliente (ver
// frontend_web/src/lib/channels-source.ts) — o backend deixa de tocar nesses
// ficheiros por completo.
//
// O que continua aqui (e TEM de continuar — não é sobre os dados do canal,
// é sobre anti-abuso, que só pode ser aplicado no servidor):
//   • GET /api/channels/:id — deixou de devolver dados do canal (o cliente
//     já os tem, vindos do jsDelivr). Serve APENAS como "gate": passa pelo
//     middleware/rate-limit.js (isChannelPlay), que faz o mesmo
//     enforceScreenLimit + checkFreeStreamAccess que o /stream do VOD faz
//     antes de deixar reproduzir. Se o middleware deixar passar, devolve só
//     { ok: true } — o handler nunca precisa de saber QUAL canal é.
//   • POST /api/channels/:id/heartbeat — idem; a quota/anti-fraude real
//     também é tratada inteiramente no middleware antes de chegar aqui.
// ─────────────────────────────────────────────────────────────────────────

export default function (app) {

    // GET /api/channels/:id — gate de anti-abuso antes de reproduzir (ver
    // nota acima). Autenticação + limite de ecrãs/quota diária são tratados
    // pelo middleware/rate-limit.js (isChannelPlay) ANTES de chegar aqui;
    // se chegou aqui, já passou em tudo.
    app.get('/api/channels/:id', (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Faça login para aceder ao canal.' });
        res.set('Cache-Control', 'private, no-store');
        res.json({ ok: true });
    });

    // POST /api/channels/:id/heartbeat — mesma quota de 1h/dia do VOD. Na
    // prática o middleware (rate-limit.js) já responde antes de chegar aqui
    // (igual ao /api/content/:id/heartbeat) — existe só para o path não dar
    // 404 se algum dia o middleware deixar passar.
    app.post('/api/channels/:id/heartbeat', (req, res) => {
        res.json({ allowed: true, paid: true });
    });
}
