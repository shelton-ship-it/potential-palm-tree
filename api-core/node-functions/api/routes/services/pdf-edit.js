// routes/services/pdf-edit.js — EditPDF
// Todas as operações são síncronas — pdf-lib é puro JS, sem binário externo,
// e ficheiros PDF de uso típico (contratos, relatórios) processam em
// milissegundos dentro do limite de tempo de uma Node Function.

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';

const SERVICE = 'editpdf';
const FREE_DAILY_LIMIT = 5;
const MAX_BYTES = 25 * 1024 * 1024;

function bufFromB64(b64) { return Buffer.from(b64, 'base64'); }

async function logJob(app, req, extra) {
    await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
    await app.edgeone.createJob(SERVICE, req.user.id, { status: 'completed', completed_at: new Date().toISOString(), ...extra });
}

export default function (app) {

    // ── POST /api/editpdf/merge — junta vários PDFs num só ─────────────────
    app.post('/api/editpdf/merge', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { files } = req.body; // [{ filename, data_base64 }]
            if (!Array.isArray(files) || files.length < 2) {
                return res.status(400).json({ error: 'Bad Request', message: 'Envie pelo menos 2 ficheiros' });
            }
            const totalSize = files.reduce((s, f) => s + Buffer.byteLength(f.data_base64, 'base64'), 0);
            if (totalSize > MAX_BYTES) return res.status(413).json({ error: 'Payload Too Large' });

            const merged = await PDFDocument.create();
            for (const f of files) {
                const src = await PDFDocument.load(bufFromB64(f.data_base64));
                const pages = await merged.copyPages(src, src.getPageIndices());
                pages.forEach(p => merged.addPage(p));
            }
            const outBytes = await merged.save();

            await logJob(app, req, { type: 'merge', input_name: `${files.length} ficheiros`, input_size: totalSize, output_size: outBytes.length });
            res.json({ ok: true, filename: 'merged.pdf', mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/merge]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/split — extrai um intervalo de páginas ────────────
    app.post('/api/editpdf/split', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, data_base64, from, to } = req.body;
            if (!filename || !data_base64) return res.status(400).json({ error: 'Bad Request' });

            const inputBuffer = bufFromB64(data_base64);
            if (inputBuffer.byteLength > MAX_BYTES) return res.status(413).json({ error: 'Payload Too Large' });

            const src = await PDFDocument.load(inputBuffer);
            const pageCount = src.getPageCount();
            const start = Math.max(1, from || 1) - 1;
            const end   = Math.min(pageCount, to || pageCount) - 1;
            if (start > end) return res.status(400).json({ error: 'Bad Request', message: 'Intervalo de páginas inválido' });

            const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            const out = await PDFDocument.create();
            const pages = await out.copyPages(src, indices);
            pages.forEach(p => out.addPage(p));
            const outBytes = await out.save();

            await logJob(app, req, { type: 'split', input_name: filename, input_size: inputBuffer.byteLength, output_size: outBytes.length });
            res.json({ ok: true, filename: filename.replace(/\.pdf$/i, '') + `_p${start + 1}-${end + 1}.pdf`, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/split]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/rotate — roda todas as páginas ou um subconjunto ──
    app.post('/api/editpdf/rotate', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, data_base64, degrees: deg = 90, pages: pageList } = req.body;
            if (!filename || !data_base64) return res.status(400).json({ error: 'Bad Request' });

            const inputBuffer = bufFromB64(data_base64);
            const doc = await PDFDocument.load(inputBuffer);
            const targets = Array.isArray(pageList) && pageList.length ? pageList.map(p => p - 1) : doc.getPageIndices();

            targets.forEach(i => {
                const page = doc.getPage(i);
                page.setRotation(degrees((page.getRotation().angle + deg) % 360));
            });
            const outBytes = await doc.save();

            await logJob(app, req, { type: 'rotate', input_name: filename, input_size: inputBuffer.byteLength, output_size: outBytes.length });
            res.json({ ok: true, filename, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/rotate]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/watermark — texto em marca d'água diagonal ────────
    app.post('/api/editpdf/watermark', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, data_base64, text, opacity = 0.25, size = 48 } = req.body;
            if (!filename || !data_base64 || !text) return res.status(400).json({ error: 'Bad Request', message: 'filename, data_base64 and text are required' });

            const inputBuffer = bufFromB64(data_base64);
            const doc  = await PDFDocument.load(inputBuffer);
            const font = await doc.embedFont(StandardFonts.HelveticaBold);

            doc.getPages().forEach(page => {
                const { width, height } = page.getSize();
                const textWidth = font.widthOfTextAtSize(text, size);
                page.drawText(text, {
                    x: (width - textWidth) / 2, y: height / 2,
                    size, font, color: rgb(0.5, 0.5, 0.5), opacity,
                    rotate: degrees(45),
                });
            });
            const outBytes = await doc.save();

            await logJob(app, req, { type: 'watermark', input_name: filename, input_size: inputBuffer.byteLength, output_size: outBytes.length });
            res.json({ ok: true, filename, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/watermark]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/page-numbers — numeração de páginas no rodapé ─────
    app.post('/api/editpdf/page-numbers', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, data_base64 } = req.body;
            if (!filename || !data_base64) return res.status(400).json({ error: 'Bad Request' });

            const inputBuffer = bufFromB64(data_base64);
            const doc  = await PDFDocument.load(inputBuffer);
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const pages = doc.getPages();

            pages.forEach((page, i) => {
                const { width } = page.getSize();
                const label = `${i + 1} / ${pages.length}`;
                const textWidth = font.widthOfTextAtSize(label, 10);
                page.drawText(label, { x: (width - textWidth) / 2, y: 24, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
            });
            const outBytes = await doc.save();

            await logJob(app, req, { type: 'page-numbers', input_name: filename, input_size: inputBuffer.byteLength, output_size: outBytes.length });
            res.json({ ok: true, filename, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/page-numbers]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/edit-text — edita texto: cobre uma área com um
    //     retângulo branco (opcional) e escreve texto novo por cima. É a
    //     técnica padrão usada por editores de PDF sem OCR/reflow: o PDF não
    //     guarda "parágrafos editáveis", então "editar" = tapar + reescrever
    //     na mesma posição. Suporta múltiplas edições numa só chamada.
    app.post('/api/editpdf/edit-text', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { filename, data_base64, edits = [] } = req.body;
            if (!filename || !data_base64 || !Array.isArray(edits) || edits.length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'filename, data_base64 and edits[] are required' });
            }

            const inputBuffer = bufFromB64(data_base64);
            if (inputBuffer.byteLength > MAX_BYTES) return res.status(413).json({ error: 'Payload Too Large' });

            const doc  = await PDFDocument.load(inputBuffer);
            const font = await doc.embedFont(StandardFonts.Helvetica);

            for (const edit of edits) {
                const { page: pageNum = 1, x, y, width, height, text, size = 12, color = [0, 0, 0], cover = true } = edit;
                if (x === undefined || y === undefined) continue;

                const page = doc.getPage(Math.max(0, Math.min(pageNum - 1, doc.getPageCount() - 1)));

                // Cobre a área do texto antigo com um retângulo branco antes
                // de escrever o novo texto por cima (simula "apagar").
                if (cover && width && height) {
                    page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1) });
                }
                if (text) {
                    page.drawText(text, { x, y, size, font, color: rgb(color[0], color[1], color[2]) });
                }
            }

            const outBytes = await doc.save();
            await logJob(app, req, { type: 'edit-text', input_name: filename, input_size: inputBuffer.byteLength, output_size: outBytes.length });
            res.json({ ok: true, filename, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[editpdf/edit-text]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/editpdf/page-info — devolve nº de páginas + dimensões,
    //     usado pelo frontend pra desenhar a caixa de edição na posição certa
    app.post('/api/editpdf/page-info', authenticate, async (req, res) => {
        try {
            const { data_base64 } = req.body;
            if (!data_base64) return res.status(400).json({ error: 'Bad Request' });
            const doc = await PDFDocument.load(bufFromB64(data_base64));
            const pages = doc.getPages().map((p, i) => ({ page: i + 1, width: p.getWidth(), height: p.getHeight() }));
            res.json({ ok: true, page_count: doc.getPageCount(), pages });
        } catch (err) {
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    app.get('/api/editpdf/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
