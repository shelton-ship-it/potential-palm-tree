// routes/services/docgen.js — DocForge
// ─────────────────────────────────────────────────────────────────────────────
// Gera PDFs de documentos comuns (recibo, fatura, contrato, proposta) 100%
// programaticamente com pdf-lib — sem motor de templates HTML/headless
// browser (inviável em serverless).
//
// v1.2: Gera PDFs de documentos comuns (recibo, fatura, contrato, proposta)
// 100% programaticamente com pdf-lib.
//
// Campos completos de emissor/destinatário, múltiplas moedas, local do
// serviço e assinatura embutida — tudo isso
// usa só pdf-lib, que já era dependência estável.
//
// REVERTIDO (temporariamente): proteção por senha via .zip AES
// (@zip.js/zip.js). Funcionava, mas somado a mammoth/docx/pdf-parse do
// ConvertAll estourou o limite de tamanho do bundle do backend e derrubou
// TODA a API (as 8 plataformas, não só o DocForge). Prioridade agora é
// estabilidade — o campo password é aceite mas ignorado por enquanto.
// ─────────────────────────────────────────────────────────────────────────────

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createHash } from 'crypto';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';
import { shortId } from '../../lib/utils.js';

const SERVICE = 'docforge';
const FREE_DAILY_LIMIT = 5;
const PAGE_W = 595.28, PAGE_H = 841.89; // A4 em pt
const MARGIN = 50;
const ACCENT = rgb(0.1, 0.35, 0.85);

const CURRENCY_SYMBOLS = {
    BRL: 'R$', USD: '$', EUR: '€', GBP: '£',
    ZAR: 'R', MZN: 'MT', AOA: 'Kz', CVE: '$',
};
function currencySymbol(code) { return CURRENCY_SYMBOLS[code] || code || 'R$'; }

async function baseDoc() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const font     = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    return { doc, page, font, fontBold };
}

function drawHeader(page, fontBold, title, issuerName) {
    page.drawText(issuerName || 'Documento', { x: MARGIN, y: PAGE_H - 60, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(title, { x: MARGIN, y: PAGE_H - 90, size: 22, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawLine({ start: { x: MARGIN, y: PAGE_H - 105 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 105 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
}

function wrapText(text, font, size, maxWidth) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
        else line = test;
    }
    if (line) lines.push(line);
    return lines;
}

/** Desenha um bloco de identificação (emissor OU destinatário) com todos os
 *  campos opcionais: nome, empresa, morada, NIF/ID, telefone, e-mail. */
function drawPartyBlock(page, font, fontBold, label, party = {}, x, yStart, width) {
    let y = yStart;
    page.drawText(label.toUpperCase(), { x, y, size: 9, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    y -= 14;
    if (party.name) { page.drawText(party.name, { x, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) }); y -= 14; }
    if (party.company) { page.drawText(party.company, { x, y, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) }); y -= 13; }
    if (party.address) {
        for (const line of wrapText(party.address, font, 9, width)) { page.drawText(line, { x, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    }
    if (party.tax_id) { page.drawText(`ID/NIF: ${party.tax_id}`, { x, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    if (party.phone) { page.drawText(`Tel: ${party.phone}`, { x, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    if (party.email) { page.drawText(party.email, { x, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
    return y;
}

/** Embute a assinatura do emissor (PNG base64) + gera trilha de auditoria
 *  (hash SHA-256 do PDF final). Retorna o audit trail; grava o hash DEPOIS
 *  de embutir a assinatura, então o hash cobre o documento assinado. */
async function embedSignature(doc, page, font, signatureBase64, issuerName, position) {
    if (!signatureBase64) return null;
    const sigBytes = Buffer.from(signatureBase64, 'base64');
    const sigImage = await doc.embedPng(sigBytes);
    const pos = position || { x: PAGE_W - MARGIN - 160, y: 70, width: 150, height: 55 };
    page.drawImage(sigImage, pos);
    page.drawLine({ start: { x: pos.x, y: pos.y - 4 }, end: { x: pos.x + pos.width, y: pos.y - 4 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    page.drawText(issuerName || 'Assinatura', { x: pos.x, y: pos.y - 16, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    return true;
}

/** Encriptação por senha está temporariamente indisponível (ver nota no
 *  topo do ficheiro) — devolve sempre o PDF puro. Mantido como função para
 *  não precisar tocar em cada rota se/quando isto voltar. */
async function finalize(pdfBytes, filename, password) {
    return { buffer: Buffer.from(pdfBytes), filename, mime: 'application/pdf', encrypted: false };
}

async function logJob(app, req, extra) {
    await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
    await app.edgeone.createJob(SERVICE, req.user.id, { status: 'completed', completed_at: new Date().toISOString(), ...extra });
}

function auditTrail(pdfBytes, req) {
    return {
        id: shortId('doc'),
        document_hash: createHash('sha256').update(pdfBytes).digest('hex'),
        generated_at: new Date().toISOString(),
        generated_by: req.user.username,
    };
}

export default function (app) {

    // ── POST /api/docforge/receipt — recibo ──────────────────────────────────
    app.post('/api/docforge/receipt', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { issuer = {}, payer = {}, amount, currency = 'BRL', description, date, receipt_no, service_location, password } = req.body;
            if (!issuer.name || !payer.name || !amount) return res.status(400).json({ error: 'Bad Request', message: 'issuer.name, payer.name and amount are required' });

            const cur = currencySymbol(currency);
            const { doc, page, font, fontBold } = await baseDoc();
            drawHeader(page, fontBold, 'Recibo', issuer.name);

            let yLeft  = drawPartyBlock(page, font, fontBold, 'Emitido por', issuer, MARGIN, PAGE_H - 135, 220);
            let yRight = drawPartyBlock(page, font, fontBold, 'Recebido de', payer, PAGE_W / 2 + 10, PAGE_H - 135, 220);
            let y = Math.min(yLeft, yRight) - 16;

            page.drawText(`Nº do recibo: ${receipt_no || `#${Date.now().toString().slice(-8)}`}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 16;
            page.drawText(`Data: ${date || new Date().toLocaleDateString('pt-BR')}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
            if (service_location) { page.drawText(`Local: ${service_location}`, { x: PAGE_W / 2 + 10, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) }); }
            y -= 24;

            page.drawText(`Valor: ${cur} ${Number(amount).toFixed(2)}`, { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
            y -= 26;

            page.drawText('Referente a:', { x: MARGIN, y, size: 11, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
            y -= 18;
            for (const line of wrapText(description || '—', font, 11, PAGE_W - MARGIN * 2)) {
                page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
                y -= 16;
            }

            await embedSignature(doc, page, font, issuer.signature_base64, issuer.name);

            const pdfBytes = await doc.save();
            const audit = auditTrail(pdfBytes, req);
            const out = await finalize(pdfBytes, 'recibo.pdf', password);

            await logJob(app, req, { type: 'receipt', input_name: `Recibo ${payer.name}`, output_size: out.buffer.length, audit });
            res.json({ ok: true, filename: out.filename, mime: out.mime, encrypted: out.encrypted, audit, data_base64: out.buffer.toString('base64') });
        } catch (err) {
            console.error('[docforge/receipt]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/docforge/invoice — fatura com itens ───────────────────────
    app.post('/api/docforge/invoice', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { issuer = {}, client = {}, invoice_no, date, due_date, items = [], currency = 'BRL', service_location, password } = req.body;
            if (!issuer.name || !client.name || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'issuer.name, client.name and items[] are required' });
            }
            const cur = currencySymbol(currency);

            const { doc, page, font, fontBold } = await baseDoc();
            drawHeader(page, fontBold, 'Fatura', issuer.name);

            let yLeft  = drawPartyBlock(page, font, fontBold, 'Emitido por', issuer, MARGIN, PAGE_H - 135, 220);
            let yRight = drawPartyBlock(page, font, fontBold, 'Cliente', client, PAGE_W / 2 + 10, PAGE_H - 135, 220);
            let y = Math.min(yLeft, yRight) - 14;

            page.drawText(`Nº: ${invoice_no || Date.now().toString().slice(-8)}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
            page.drawText(`Data: ${date || new Date().toLocaleDateString('pt-BR')}`, { x: PAGE_W / 2 + 10, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 16;
            if (due_date) page.drawText(`Vencimento: ${due_date}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
            if (service_location) page.drawText(`Local: ${service_location}`, { x: PAGE_W / 2 + 10, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

            y -= 34;
            page.drawText('Descrição', { x: MARGIN, y, size: 10, font: fontBold });
            page.drawText('Qtd', { x: PAGE_W - MARGIN - 160, y, size: 10, font: fontBold });
            page.drawText('Preço', { x: PAGE_W - MARGIN - 110, y, size: 10, font: fontBold });
            page.drawText('Total', { x: PAGE_W - MARGIN - 50, y, size: 10, font: fontBold });
            y -= 8;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
            y -= 18;

            let total = 0;
            for (const item of items) {
                const qty = Number(item.qty || 1);
                const price = Number(item.price || 0);
                const lineTotal = qty * price;
                total += lineTotal;
                page.drawText(String(item.description || '—').slice(0, 60), { x: MARGIN, y, size: 10, font });
                page.drawText(String(qty), { x: PAGE_W - MARGIN - 160, y, size: 10, font });
                page.drawText(price.toFixed(2), { x: PAGE_W - MARGIN - 110, y, size: 10, font });
                page.drawText(lineTotal.toFixed(2), { x: PAGE_W - MARGIN - 50, y, size: 10, font });
                y -= 18;
            }

            y -= 12;
            page.drawLine({ start: { x: PAGE_W - MARGIN - 160, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
            y -= 20;
            page.drawText('Total:', { x: PAGE_W - MARGIN - 160, y, size: 12, font: fontBold });
            page.drawText(`${cur} ${total.toFixed(2)}`, { x: PAGE_W - MARGIN - 90, y, size: 12, font: fontBold });

            await embedSignature(doc, page, font, issuer.signature_base64, issuer.name);

            const pdfBytes = await doc.save();
            const audit = auditTrail(pdfBytes, req);
            const out = await finalize(pdfBytes, 'fatura.pdf', password);

            await logJob(app, req, { type: 'invoice', input_name: `Fatura ${client.name}`, output_size: out.buffer.length, audit });
            res.json({ ok: true, filename: out.filename, mime: out.mime, encrypted: out.encrypted, audit, data_base64: out.buffer.toString('base64') });
        } catch (err) {
            console.error('[docforge/invoice]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/docforge/contract — contrato ──────────────────────────────
    app.post('/api/docforge/contract', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { title, party_a = {}, party_b = {}, clauses = [], date, service_location, password } = req.body;
            if (!title || !party_a.name || !party_b.name || !Array.isArray(clauses) || clauses.length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'title, party_a.name, party_b.name and clauses[] are required' });
            }

            let { doc, page, font, fontBold } = await baseDoc();
            drawHeader(page, fontBold, title, `${party_a.name} × ${party_b.name}`);

            let yLeft  = drawPartyBlock(page, font, fontBold, 'Parte A', party_a, MARGIN, PAGE_H - 135, 220);
            let yRight = drawPartyBlock(page, font, fontBold, 'Parte B', party_b, PAGE_W / 2 + 10, PAGE_H - 135, 220);
            let y = Math.min(yLeft, yRight) - 20;

            const ensureSpace = async (needed) => {
                if (y - needed < MARGIN + 90) {
                    page = doc.addPage([PAGE_W, PAGE_H]);
                    y = PAGE_H - MARGIN;
                }
            };

            for (const [i, clause] of clauses.entries()) {
                const lines = wrapText(`${i + 1}. ${clause}`, font, 11, PAGE_W - MARGIN * 2);
                await ensureSpace(lines.length * 16 + 10);
                for (const line of lines) {
                    page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
                    y -= 16;
                }
                y -= 8;
            }

            await ensureSpace(100);
            y -= 16;
            page.drawText(`${service_location || ''}, ${date || new Date().toLocaleDateString('pt-BR')}`, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
            y -= 46;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
            page.drawText(party_a.name, { x: MARGIN, y: y - 14, size: 9, font });
            page.drawLine({ start: { x: PAGE_W - MARGIN - 200, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
            page.drawText(party_b.name, { x: PAGE_W - MARGIN - 200, y: y - 14, size: 9, font });

            if (party_a.signature_base64) {
                const sig = await doc.embedPng(Buffer.from(party_a.signature_base64, 'base64'));
                page.drawImage(sig, { x: MARGIN, y: y + 4, width: 140, height: 45 });
            }
            if (party_b.signature_base64) {
                const sig = await doc.embedPng(Buffer.from(party_b.signature_base64, 'base64'));
                page.drawImage(sig, { x: PAGE_W - MARGIN - 200, y: y + 4, width: 140, height: 45 });
            }

            const pdfBytes = await doc.save();
            const audit = auditTrail(pdfBytes, req);
            const out = await finalize(pdfBytes, 'contrato.pdf', password);

            await logJob(app, req, { type: 'contract', input_name: title, output_size: out.buffer.length, audit });
            res.json({ ok: true, filename: out.filename, mime: out.mime, encrypted: out.encrypted, audit, data_base64: out.buffer.toString('base64') });
        } catch (err) {
            console.error('[docforge/contract]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    // ── POST /api/docforge/proposal — proposta comercial ────────────────────
    app.post('/api/docforge/proposal', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const { title, client = {}, issuer = {}, sections = [], valid_until, service_location, password } = req.body;
            if (!title || !client.name || !Array.isArray(sections) || sections.length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'title, client.name and sections[] are required' });
            }

            let { doc, page, font, fontBold } = await baseDoc();
            drawHeader(page, fontBold, title, issuer.name);

            let y = drawPartyBlock(page, font, fontBold, 'Para', client, MARGIN, PAGE_H - 135, 400);
            y -= 8;
            if (valid_until) { page.drawText(`Válida até: ${valid_until}`, { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 16; }
            if (service_location) { page.drawText(`Local do serviço: ${service_location}`, { x: MARGIN, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 16; }
            y -= 10;

            const ensureSpace = async (needed) => {
                if (y - needed < MARGIN) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
            };

            for (const section of sections) {
                await ensureSpace(40);
                page.drawText(section.heading || '', { x: MARGIN, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
                y -= 20;
                const lines = wrapText(section.body || '', font, 10.5, PAGE_W - MARGIN * 2);
                for (const line of lines) {
                    await ensureSpace(16);
                    page.drawText(line, { x: MARGIN, y, size: 10.5, font, color: rgb(0.2, 0.2, 0.2) });
                    y -= 15;
                }
                y -= 14;
            }

            await embedSignature(doc, page, font, issuer.signature_base64, issuer.name);

            const pdfBytes = await doc.save();
            const audit = auditTrail(pdfBytes, req);
            const out = await finalize(pdfBytes, 'proposta.pdf', password);

            await logJob(app, req, { type: 'proposal', input_name: title, output_size: out.buffer.length, audit });
            res.json({ ok: true, filename: out.filename, mime: out.mime, encrypted: out.encrypted, audit, data_base64: out.buffer.toString('base64') });
        } catch (err) {
            console.error('[docforge/proposal]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    app.get('/api/docforge/currencies', (req, res) => {
        res.json({ currencies: Object.keys(CURRENCY_SYMBOLS).map(code => ({ code, symbol: CURRENCY_SYMBOLS[code] })) });
    });

    app.get('/api/docforge/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
