import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { authenticate } from '../../middleware/auth.js';
import { requireQuota } from '../../middleware/rate-limit.js';
import compositionLayouts from './resumeforge-layouts.js';

const SERVICE = 'resumeforge';
const FREE_DAILY_LIMIT = 3;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const DEFAULT_ACCENT = rgb(0.12, 0.35, 0.78);
const DEFAULT_INK = rgb(0.12, 0.14, 0.16);
const DEFAULT_RULE = rgb(0.84, 0.86, 0.88);
const DEFAULT_SOFT = rgb(0.96, 0.97, 0.98);
const DEFAULT_SIDEBAR = rgb(0.10, 0.12, 0.17);

function parseHex(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match) return fallback;
    const hex = match[1];
    return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

function wrapText(value, font, size, maxWidth) {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
            lines.push(current);
            current = word;
        } else current = candidate;
    }
    if (current) lines.push(current);
    return lines;
}

function normalizeDesign(design, accentHex, grayscale = false) {
    const source = design && typeof design === 'object' ? design : {};
    const allowedCompositions = ['single', 'sidebar-left', 'sidebar-right', 'split', 'editorial', 'modular', 'timeline', 'framed', 'offset', 'rail'];
    const composition = allowedCompositions.includes(source.composition) ? source.composition : 'single';
    // Espelha o comportamento de CvPaper.tsx: em modo de verificação a
    // preto e branco, a app troca todas as cores por uma escala de
    // cinzentos fixa, incluindo a cor de destaque — o PDF deve fazer o
    // mesmo, não continuar a sair a cores quando a pessoa pediu para
    // verificar em escala de cinzentos.
    const GRAY_ACCENT = rgb(0.46, 0.46, 0.46);
    const GRAY_INK = rgb(0.12, 0.12, 0.12);
    const GRAY_RULE = rgb(0.82, 0.82, 0.82);
    const GRAY_SOFT = rgb(1, 1, 1);
    const GRAY_SIDEBAR = rgb(0.22, 0.22, 0.22);
    return {
        ...source,
        composition,
        ornament: source.ornament || 'none',
        headerTreatment: source.headerTreatment || 'cabeçalho compacto',
        experienceTreatment: source.experienceTreatment || 'cronologia limpa',
        skillsTreatment: source.skillsTreatment || 'lista simples',
        photoTreatment: source.photoTreatment || 'sem fotografia',
        sectionOrder: Array.isArray(source.sectionOrder) ? source.sectionOrder : ['profile', 'experience', 'education', 'projects', 'skills', 'languages'],
        sideContent: Array.isArray(source.sideContent) ? source.sideContent : ['contact'],
        accent: grayscale ? GRAY_ACCENT : parseHex(accentHex, DEFAULT_ACCENT),
        ink: grayscale ? GRAY_INK : parseHex(source.ink_hex, DEFAULT_INK),
        rule: grayscale ? GRAY_RULE : parseHex(source.rule_hex, DEFAULT_RULE),
        soft: grayscale ? GRAY_SOFT : parseHex(source.paper_hex, DEFAULT_SOFT),
        sidebarBg: grayscale ? GRAY_SIDEBAR : parseHex(source.sidebar_hex, DEFAULT_SIDEBAR),
    };
}

async function embedLinkedinQr(doc, { url, enabled, accentHex }) {
    if (!enabled || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'https:' || !(parsed.hostname === 'linkedin.com' || parsed.hostname.endsWith('.linkedin.com'))) return null;
        const dark = /^#?[0-9a-f]{6}$/i.test(accentHex || '') ? (accentHex.startsWith('#') ? accentHex : `#${accentHex}`) : '#1f2933';
        const dataUrl = await QRCode.toDataURL(parsed.toString(), { errorCorrectionLevel: 'M', margin: 1, width: 160, color: { dark, light: '#ffffff' } });
        const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
        return await doc.embedPng(bytes);
    } catch {
        return null;
    }
}

async function embedPhoto(doc, base64, mime) {
    if (!base64) return null;
    try {
        const bytes = Buffer.from(base64, 'base64');
        if (mime === 'image/png') return await doc.embedPng(bytes);
        return await doc.embedJpg(bytes);
    } catch {
        return null;
    }
}

function buildLayoutData({ page, font, bold, italic, photo, design, body }) {
    return {
        ...body,
        page,
        font,
        bold,
        italic,
        photo,
        design,
        accent: design.accent,
        ink: design.ink,
        rule: design.rule,
        soft: design.soft,
        sidebarBg: design.sidebarBg,
        wrap: wrapText,
    };
}

export default function (app) {
    app.post('/api/resumeforge/generate', authenticate, requireQuota(SERVICE, FREE_DAILY_LIMIT), async (req, res) => {
        try {
            const {
                name, title, photo_base64, photo_mime, accent_hex, design = {}, grayscale,
                linkedin_url, include_linkedin_qr,
                contact = {}, personal = {}, summary = '', experience = [], education = [], skills = [],
                languages = [], certifications = [], projects = [], references = [], references_available,
            } = req.body;
            if (!name) return res.status(400).json({ error: 'Bad Request', message: 'name is required' });

            // "Verificação em escala de cinzentos" existe no editor (o botão
            // por baixo da pré-visualização) mas nunca chegava ao PDF deste
            // botão — a exportação saía sempre a cores, mesmo que a pessoa
            // tivesse ativado a verificação a preto e branco antes de exportar.
            const recipe = normalizeDesign(design, accent_hex, Boolean(grayscale));
            const doc = await PDFDocument.create();
            const page = doc.addPage([PAGE_W, PAGE_H]);
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const bold = await doc.embedFont(StandardFonts.HelveticaBold);
            const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
            const photo = await embedPhoto(doc, photo_base64, photo_mime);
            // O código QR do LinkedIn aparecia no ecrã (opção "Incluir QR code
            // no currículo") mas nunca era desenhado no PDF gerado aqui.
            const linkedinQr = await embedLinkedinQr(doc, { url: linkedin_url, enabled: Boolean(include_linkedin_qr), accentHex: accent_hex });
            const layout = compositionLayouts[recipe.composition] || compositionLayouts.single;
            layout(doc, buildLayoutData({
                page, font, bold, italic, photo, design: recipe,
                body: { name, title, contact, personal, summary, experience, education, skills, languages, certifications, projects, references, references_available, id: req.body.style_id || '', styleName: req.body.style_name || '', category: 'Currículo', linkedinQr },
            }));

            const outBytes = await doc.save();
            await app.edgeone.incrementDailyUsage(req.user.id, SERVICE);
            await app.edgeone.createJob(SERVICE, req.user.id, { type: 'resume', input_name: `CV ${name}`, output_size: outBytes.length, status: 'completed', completed_at: new Date().toISOString() });
            res.json({ ok: true, filename: `cv_${name.replace(/\s+/g, '_').toLowerCase()}.pdf`, mime: 'application/pdf', data_base64: Buffer.from(outBytes).toString('base64') });
        } catch (err) {
            console.error('[resumeforge/generate]', err.message);
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    });

    app.get('/api/resumeforge/jobs', authenticate, async (req, res) => {
        res.json({ jobs: await app.edgeone.listUserJobs(req.user.id, SERVICE) });
    });
}
