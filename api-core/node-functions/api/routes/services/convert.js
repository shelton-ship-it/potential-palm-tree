// routes/services/convert.js — ConvertAll
// ─────────────────────────────────────────────────────────────────────────────
// Escopo: conversão entre formatos de imagem, síncrona com `jimp` (JS puro,
// sem binário nativo).
//
// NOTA (revertido): tentámos adicionar conversão real DOCX↔PDF via
// mammoth+docx+pdf-parse. Funcionava localmente, mas essas 3 libs somadas
// aumentaram o bundle do backend em ~110MB, o que derrubou TODO o backend
// (API única para as 8 plataformas) no deploy da EdgeOne — não só o
// ConvertAll, mas login/registo de todas as outras 8 também, porque é a
// mesma função. Prioridade agora é estabilidade: revertido até termos uma
// forma de isolar dependências pesadas (ex: função separada só pra
// conversão de documentos, com o seu próprio deploy).
// ─────────────────────────────────────────────────────────────────────────────

import Jimp from 'jimp';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';

const SERVICE = 'convertall';
const FREE_DAILY_LIMIT = 5;
const MAX_BYTES = 25 * 1024 * 1024;

const MIME_TO_JIMP = {
    jpeg: Jimp.MIME_JPEG,
    png:  Jimp.MIME_PNG,
    bmp:  Jimp.MIME_BMP,
};
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/bmp']);

export default function (app) {

    // ── POST /api/convertall/image — conversão síncrona entre formatos ──────
    app.post('/api/convertall/image', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, mime, data_base64, target_format } = req.body;

            if (!filename || !mime || !data_base64 || !target_format) {
                return res.status(400).json({ error: 'Bad Request', message: 'filename, mime, data_base64 and target_format are required' });
            }
            if (!ACCEPTED_MIME.has(mime)) {
                return res.status(415).json({ error: 'Unsupported Media Type', message: `Origem deve ser uma das: ${[...ACCEPTED_MIME].join(', ')}` });
            }
            if (!MIME_TO_JIMP[target_format]) {
                return res.status(400).json({ error: 'Bad Request', message: `target_format deve ser um de: ${Object.keys(MIME_TO_JIMP).join(', ')}` });
            }

            const inputBuffer = Buffer.from(data_base64, 'base64');
            if (inputBuffer.byteLength > MAX_BYTES) {
                return res.status(413).json({ error: 'Payload Too Large', message: 'Máximo 25MB por ficheiro' });
            }

            const image = await Jimp.read(inputBuffer);
            const outMime = MIME_TO_JIMP[target_format];
            const outputBuffer = await image.getBufferAsync(outMime);
            const outName = filename.replace(/\.[^.]+$/, '') + '.' + (target_format === 'jpeg' ? 'jpg' : target_format);

            await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
            await app.edgeone.createJob(SERVICE, req.user.id, {
                type: 'image', input_name: filename, input_size: inputBuffer.byteLength,
                output_size: outputBuffer.byteLength, status: 'completed', completed_at: new Date().toISOString(),
            });

            res.json({ ok: true, filename: outName, mime: outMime, original_size: inputBuffer.byteLength, output_size: outputBuffer.byteLength, data_base64: outputBuffer.toString('base64') });
        } catch (err) {
            console.error('[convertall/image]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    app.get('/api/convertall/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
