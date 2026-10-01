// routes/services/compress.js — CompressHub
// ─────────────────────────────────────────────────────────────────────────────
// Processamento 100% em JavaScript puro com `jimp` — sem binário nativo
// (.node), compatível com o bundler da EdgeOne Pages. Isto restringe o
// formato suportado a JPEG/PNG/BMP (jimp não codifica WEBP/AVIF); é a
// troca necessária para não depender de nenhum binário nem serviço
// externo.
// ─────────────────────────────────────────────────────────────────────────────

import Jimp from 'jimp';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';

const SERVICE = 'compresshub';
const FREE_DAILY_LIMIT = 5;
const MAX_BYTES = 25 * 1024 * 1024;

const MIME_TO_JIMP = {
    'image/jpeg': Jimp.MIME_JPEG,
    'image/png':  Jimp.MIME_PNG,
    'image/bmp':  Jimp.MIME_BMP,
};

export default function (app) {

    // ── POST /api/compresshub/image — compressão síncrona de imagem ────────
    app.post('/api/compresshub/image', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, mime, data_base64, quality = 75, max_width } = req.body;

            if (!filename || !mime || !data_base64) {
                return res.status(400).json({ error: 'Bad Request', message: 'filename, mime and data_base64 are required' });
            }
            if (!MIME_TO_JIMP[mime]) {
                return res.status(415).json({ error: 'Unsupported Media Type', message: `mime must be one of: ${Object.keys(MIME_TO_JIMP).join(', ')}` });
            }

            const inputBuffer = Buffer.from(data_base64, 'base64');
            if (inputBuffer.byteLength > MAX_BYTES) {
                return res.status(413).json({ error: 'Payload Too Large', message: 'Máximo 25MB por ficheiro' });
            }

            const image = await Jimp.read(inputBuffer);
            if (max_width && image.getWidth() > max_width) {
                image.resize(max_width, Jimp.AUTO);
            }
            if (mime === 'image/jpeg') {
                image.quality(Math.min(Math.max(Math.round(quality), 1), 100));
            }

            const outputBuffer = await image.getBufferAsync(MIME_TO_JIMP[mime]);

            await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
            await app.edgeone.createJob(SERVICE, req.user.id, {
                type: 'image', input_name: filename, input_size: inputBuffer.byteLength,
                output_size: outputBuffer.byteLength, status: 'completed', completed_at: new Date().toISOString(),
            });

            res.json({
                ok: true,
                filename,
                original_size: inputBuffer.byteLength,
                compressed_size: outputBuffer.byteLength,
                saved_pct: Math.round((1 - outputBuffer.byteLength / inputBuffer.byteLength) * 100),
                data_base64: outputBuffer.toString('base64'),
            });
        } catch (err) {
            console.error('[compresshub/image]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    app.get('/api/compresshub/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
