// middleware/tool-usage.js — Limite diário de USO (tempo), não de jobs.
//
// requireQuota() (rate-limit.js) já limita CONTAGEM de jobs/dia por serviço
// — continua a aplicar-se nas rotas de processamento de cada ferramenta,
// sem alterações. Isto aqui é uma coisa diferente: as ferramentas processam
// no CLIENT (browser), não há "job" no servidor a cada uso — por isso o
// limite é por TEMPO ACTIVO, medido por heartbeats que o frontend de cada
// ferramenta chama periodicamente enquanto está a ser usada.
//
// POST /api/usage/heartbeat  { service: 'compresshub' }
//   → credita um "tick" FIXO de tempo por chamada (nunca confia numa duração
//     enviada pelo cliente — anti-cheat) à conta do dia, por (user_id, service).
//   → bloqueia (403) quando os 10min/dia dessa ferramenta esgotam.
//   → planos pagos sem limite (mesmo critério de requireQuota: is_active && id!=='free').
//
// INTEGRAÇÃO PENDENTE: o frontend de cada uma das 8 ferramentas precisa de
// chamar este endpoint a cada ~15s enquanto a pessoa está a usá-la — esse
// código não estava disponível para alterar nesta rodada, só o backend.
//
// Armazenamento: CACHE_NS via edgeone.get/put genérico (mesma família de
// getDailyUsage, que guarda CONTAGEM de jobs — isto guarda SEGUNDOS
// acumulados). Eventual consistency do KV é aceitável aqui: um atraso de
// alguns segundos a aplicar o limite não é vector de fraude (ao contrário
// do kick de sessão do player em api.rar, que precisou de Turso).
//
// SERVIÇOS: strings confirmadas nos SERVICE de routes/services/*.js deste
// bundle — 'backcut' não aparece como serviço registado aqui (só citado em
// comentário), por isso não foi incluído; adicionar se/quando tiver rota própria.

const HEARTBEAT_TICK_SECONDS  = 15;       // tempo creditado por heartbeat (fixo, não vem do cliente)
const FREE_TOOL_LIMIT_SECONDS = 10 * 60;  // 10 min/dia por ferramenta

const KNOWN_SERVICES = [
    'compresshub', 'convertall', 'docforge', 'editpdf',
    'qrforge', 'reccast', 'resumeforge', 'resumeforge-studio',
];

function todayStr() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export function toolUsageHeartbeat() {
    return async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const service = String(req.body?.service || '').toLowerCase().trim();
        if (!KNOWN_SERVICES.includes(service)) {
            return res.status(400).json({
                error:   'Bad Request',
                message: `service inválido ou em falta. Esperado um de: ${KNOWN_SERVICES.join(', ')}`,
            });
        }

        // Mesmo critério de plano usado em requireQuota() — pagos sem limite.
        const plan = await req.app.edgeone.getUserPlan(req.user.username);
        if (plan?.is_active && plan.id !== 'free') {
            return res.json({ allowed: true, paid: true });
        }

        const day = todayStr();
        const key = `${service}_${req.user.id}_${day}`;

        let usedSeconds = 0;
        try {
            usedSeconds = (await req.app.edgeone.get('toolusage', key)) || 0;
        } catch {
            usedSeconds = 0; // falha de KV nunca bloqueia (fail-open)
        }

        if (usedSeconds >= FREE_TOOL_LIMIT_SECONDS) {
            return res.status(403).json({
                allowed:           false,
                exhausted:         true,
                remaining_seconds: 0,
                error:             'Daily Limit Reached',
                message:           `Limite diário de ${FREE_TOOL_LIMIT_SECONDS / 60} minutos atingido para esta ferramenta no plano gratuito.`,
                upgrade_url:       `/main/plans?limit_reached=1&service=${service}`,
            });
        }

        const newUsed = usedSeconds + HEARTBEAT_TICK_SECONDS;
        try {
            await req.app.edgeone.put('toolusage', key, newUsed);
        } catch (err) {
            console.error('[tool-usage] falha ao gravar uso:', err.message);
        }

        return res.json({
            allowed:           true,
            paid:              false,
            remaining_seconds: Math.max(0, FREE_TOOL_LIMIT_SECONDS - newUsed),
        });
    };
}
