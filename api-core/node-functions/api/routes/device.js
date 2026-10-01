// routes/device.js — Login de TV por código (fluxo invertido, v3)
// ─────────────────────────────────────────────────────────────────────────────
// Pedido explícito do utilizador: evitar QR/polling/WebSocket na TV. O
// TELEMÓVEL (já com sessão pixgo_session) pede o código; a TV introduz-o e
// autentica-se numa ÚNICA requisição. Sem estado "waiting/authenticated" a
// consultar — o código já nasce ligado ao utilizador, a TV só o resgata:
//
//   Telemóvel   POST /api/auth/device/code      (autenticado) → { code, expires_in }
//   TV          POST /api/auth/device/activate  (sem sessão)  → { token, user } | 4xx
//
// O código de 6 dígitos é uso único e expira em poucos minutos — nunca
// carrega o token, só um índice até /activate resolver o utilizador e emitir
// um JWT novo (mesmo helper/TTL de 365d que o login normal — a sessão da TV
// não é "mais curta" por ter nascido de um código; ver lib/session-cookie.js).
//
// Ao autenticar com sucesso, a TV recebe também o cookie pixgo_tv_paired
// (mesmo domínio partilhado de pixgo_session). É isto que permite ao
// pixel_service_v1 (api.pixgo.qzz.io) tratar telemóvel+TV emparelhados como
// uma excepção à regra de "um dispositivo activo" do plano free, sem
// precisar de sincronizar nenhum device_id entre os dois serviços.
// ─────────────────────────────────────────────────────────────────────────────

import { randomInt } from 'crypto';
import { getEnvInt } from '../lib/env.js';
import { setSessionCookie, setTvPairedCookie } from '../lib/session-cookie.js';

function codeTtlMs() { return getEnvInt('DEVICE_CODE_TTL_SECONDS', 300) * 1000; } // 5 min

function generateCode() {
    // 6 dígitos, só numérico — mais fácil de digitar num telecomando sem
    // teclado físico do que alfanumérico; espaço 000000–999999 é mais do
    // que suficiente para uma janela de 5 min de vida.
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export default function (app) {

    // ── POST /api/auth/device/code — o TELEMÓVEL (autenticado) pede o código
    //     a mostrar/ditar para a pessoa introduzir na TV ─────────────────────
    app.post('/api/auth/device/code', async (req, res) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Login required to connect a TV' });
        try {
            let code = generateCode();
            // Colisão é extremamente improvável (6 dígitos, TTL de 5 min),
            // mesmo cuidado que generateUsernameFromGoogle() em auth.js.
            // eslint-disable-next-line no-await-in-loop
            while (await app.edgeone.getDeviceCode(code)) code = generateCode();

            const expiresAt = new Date(Date.now() + codeTtlMs()).toISOString();
            await app.edgeone.storeDeviceCode(code, req.user.id, expiresAt);

            res.status(201).json({ code, expires_in: Math.floor(codeTtlMs() / 1000) });
        } catch (err) {
            console.error('[device/code]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/auth/device/activate — a TV envia o código e recebe sessão
    //     de imediato. Sem sessão prévia — é este pedido que a cria ─────────
    app.post('/api/auth/device/activate', async (req, res) => {
        try {
            const { code } = req.body || {};
            if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
                return res.status(400).json({ error: 'Bad Request', message: 'A valid 6-digit code is required' });
            }

            const record = await app.edgeone.getDeviceCode(code);
            if (!record) return res.status(404).json({ error: 'Not Found', message: 'Invalid or already used code' });
            if (record.used) return res.status(409).json({ error: 'Conflict', message: 'Code already used' });
            if (new Date(record.expires_at) < new Date()) {
                await app.edgeone.deleteDeviceCode(code);
                return res.status(410).json({ error: 'Gone', message: 'Code expired' });
            }

            const user = await app.edgeone.getUserById(record.userId);
            if (!user || !user.is_active) return res.status(403).json({ error: 'Forbidden' });

            // Uso único a partir daqui — mesmo que a TV repita o pedido por
            // engano, uma segunda tentativa cai no 409 acima.
            await app.edgeone.markDeviceCodeUsed(code);

            // Mesmo helper/TTL (365d) que o login normal e o mesmo shape de
            // resposta ({user, plan, token}) que /api/auth/login — a TV usa o
            // MESMO fluxo de "sessão iniciada" do resto da app, só chega lá
            // por um caminho diferente.
            const token = app.jwt.sign({ id: user.id, username: user.username });
            const plan  = await app.edgeone.getUserPlan(user.username);

            setSessionCookie(res, token);
            setTvPairedCookie(res);

            res.json({
                user: {
                    id: user.id, username: user.username, name: user.name,
                    role: user.role, email: user.email, plan_id: user.plan_id || 'free',
                },
                plan,
                token, // WebViews de TV (Tizen/webOS/Bubblewrap) que não confiem só no
                       // cookie guardam isto directamente (ex.: Authorization: Bearer),
                       // o middleware de auth já aceita ambos — ver middleware/auth.js.
            });
        } catch (err) {
            console.error('[device/activate]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });
}
