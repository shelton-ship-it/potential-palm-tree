import { degrees, rgb } from 'pdf-lib';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 30;

const colors = {
  ink: rgb(0.12, 0.14, 0.16),
  muted: rgb(0.40, 0.43, 0.46),
  rule: rgb(0.84, 0.86, 0.88),
  soft: rgb(0.96, 0.97, 0.98),
  white: rgb(1, 1, 1),
};

function text(ctx, value, x, y, size = 10, font = ctx.font, color = colors.ink, options = {}) {
  if (!value) return y;
  const lines = ctx.wrap(String(value), font, size, options.width ?? 300);
  for (const line of lines) {
    ctx.page.drawText(line, { x, y, size, font, color, maxWidth: options.width });
    y -= options.lineHeight ?? size + 3;
  }
  return y;
}

function line(ctx, x1, y, x2, color = ctx.accent, thickness = 0.8) {
  ctx.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, color, thickness });
}

function heading(ctx, label, x, y, width, style = {}) {
  const title = String(label).toUpperCase();
  ctx.page.drawText(title, { x, y, size: style.size ?? 10, font: ctx.bold, color: style.color ?? ctx.accent, maxWidth: width });
  if (style.rule !== false) line(ctx, x, y - 5, x + width, style.ruleColor ?? ctx.rule, style.thickness ?? 0.7);
  return y - (style.gap ?? 20);
}

function drawPhoto(ctx, x, y, width, height, treatment = '') {
  if (!ctx.photo) {
    if (treatment && treatment !== 'sem fotografia') {
      ctx.page.drawRectangle({ x, y: y - height, width, height, color: ctx.soft, borderColor: ctx.accent, borderWidth: 1 });
      const initials = ctx.data.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      ctx.page.drawText(initials, { x: x + width / 2 - 10, y: y - height / 2 - 8, size: Math.min(24, width / 3), font: ctx.bold, color: ctx.accent });
    }
    return;
  }
  ctx.page.drawImage(ctx.photo, { x, y: y - height, width, height });
  if (treatment === 'círculo técnico' || treatment === 'medalhão') {
    ctx.page.drawCircle({ x: x + width / 2, y: y - height / 2, size: Math.min(width, height) / 2 + 2, borderColor: ctx.accent, borderWidth: 2 });
  } else if (treatment === 'moldura alta' || treatment === 'retrato quadrado') {
    ctx.page.drawRectangle({ x: x - 3, y: y - height - 3, width: width + 6, height: height + 6, borderColor: ctx.accent, borderWidth: 1.2 });
  }
}

function drawIdentity(ctx, x, y, width, photoTreatment = '', opts = {}) {
  const dark = Boolean(opts.dark);
  const headerTreatment = opts.headerTreatment || '';
  // No ecrã (CvPaper.tsx), uma fotografia já carregada aparece SEMPRE,
  // mesmo em arquétipos com photoTreatment "sem fotografia" — esse valor só
  // controla se aparece um placeholder de iniciais quando NÃO há foto real.
  // Aqui só se decidia por "treatment", por isso uma foto real enviada pelo
  // utilizador desaparecia do PDF sempre que o arquétipo era "sem fotografia"
  // (rail, algumas variantes de editorial/timeline/sidebar-right).
  const showPhotoBox = ctx.photo || photoTreatment !== 'sem fotografia';
  const photoWidth = showPhotoBox ? Math.min(92, width * 0.22) : 0;
  if (photoWidth) drawPhoto(ctx, x, y + 4, photoWidth, photoWidth, photoTreatment);
  const tx = x + (photoWidth ? photoWidth + 16 : 0);
  const tw = width - (tx - x);
  ctx.page.drawText(ctx.data.name, { x: tx, y, size: headerTreatment === 'nome em escala' ? 27 : 22, font: ctx.bold, color: dark ? colors.white : ctx.ink, maxWidth: tw });
  let next = y - (headerTreatment === 'nome em escala' ? 32 : 27);
  next = text(ctx, ctx.data.title, tx, next, 11, ctx.font, ctx.accent, { width: tw, lineHeight: 14 });
  // O bloco de texto (nome + cargo) pode ser mais baixo do que a própria foto
  // quando esta é grande — sem isto, o título/rubrica seguinte (ex.: "PERFIL")
  // ficava desenhado por cima da moldura da foto.
  const photoBottom = photoWidth ? y + 4 - photoWidth - 10 : next;
  return Math.min(next, photoBottom) - 8;
}

function drawContact(ctx, x, y, width, dark = false) {
  const values = [ctx.contact.email, ctx.contact.phone, ctx.contact.address || ctx.contact.city, ctx.contact.linkedin, ctx.contact.website].filter(Boolean);
  if (!values.length) return y;
  y = heading(ctx, 'Contacto', x, y, width, { color: dark ? colors.white : ctx.accent, ruleColor: dark ? rgb(0.4, 0.42, 0.48) : ctx.rule });
  for (const value of values) y = text(ctx, value, x, y, 8.5, ctx.font, dark ? rgb(0.88, 0.89, 0.92) : ctx.muted, { width, lineHeight: 12 });
  return y - 8;
}

function drawSkills(ctx, x, y, width, dark = false) {
  if (!ctx.skills.length) return y;
  y = heading(ctx, 'Competências', x, y, width, { color: dark ? colors.white : ctx.accent, ruleColor: dark ? rgb(0.4, 0.42, 0.48) : ctx.rule });
  for (const skill of ctx.skills) y = text(ctx, ctx.skillsTreatment === 'badges' || ctx.skillsTreatment === 'chips' ? `• ${skill}` : skill, x, y, 8.5, ctx.font, dark ? rgb(0.88, 0.89, 0.92) : ctx.muted, { width, lineHeight: 12 });
  return y - 8;
}

function drawLanguages(ctx, x, y, width, dark = false) {
  if (!ctx.languages.length) return y;
  y = heading(ctx, 'Idiomas', x, y, width, { color: dark ? colors.white : ctx.accent, ruleColor: dark ? rgb(0.4, 0.42, 0.48) : ctx.rule });
  for (const item of ctx.languages) y = text(ctx, `${item.name}${item.level ? ` — ${item.level}` : ''}`, x, y, 8.5, ctx.font, dark ? rgb(0.88, 0.89, 0.92) : ctx.muted, { width, lineHeight: 12 });
  return y - 8;
}

function drawSection(ctx, key, x, y, width, opts = {}) {
  const label = { profile: 'Perfil', experience: 'Experiência profissional', education: 'Formação académica', projects: 'Projetos', skills: 'Competências', languages: 'Idiomas', contact: 'Contacto' }[key] ?? key;
  if (key === 'contact') return drawContact(ctx, x, y, width, opts.dark);
  if (key === 'skills') return drawSkills(ctx, x, y, width, opts.dark);
  if (key === 'languages') return drawLanguages(ctx, x, y, width, opts.dark);
  y = heading(ctx, label, x, y, width, { color: opts.dark ? colors.white : ctx.accent, ruleColor: opts.dark ? rgb(0.4, 0.42, 0.48) : ctx.rule, rule: opts.rule !== false });
  if (key === 'profile') return text(ctx, ctx.summary, x, y, 9.5, ctx.font, opts.dark ? rgb(0.9, 0.91, 0.93) : ctx.muted, { width, lineHeight: 13 }) - 12;
  const items = key === 'experience' ? ctx.experience : key === 'education' ? ctx.education : ctx.projects;
  for (const item of items) {
    const title = item.role || item.degree || item.name || '';
    const subtitle = item.company || item.school || item.link || '';
    const description = item.description || '';
    ctx.page.drawText(title, { x, y, size: opts.itemSize ?? 10.5, font: ctx.bold, color: opts.dark ? colors.white : ctx.ink, maxWidth: width });
    y -= 13;
    // A data era desenhada por cima do texto do subtítulo sempre que este
    // era comprido o suficiente para chegar perto da margem direita. Agora
    // reserva-se primeiro o espaço da data e só depois se desenha o
    // subtítulo, com a largura já reduzida por essa reserva.
    let periodWidth = 0;
    if (item.period) periodWidth = ctx.italic.widthOfTextAtSize(item.period, 8);
    const subtitleWidth = item.period ? Math.max(60, width - periodWidth - 12) : width;
    if (subtitle) { y = text(ctx, subtitle, x, y, 8.8, ctx.font, ctx.accent, { width: subtitleWidth, lineHeight: 11 }); }
    if (item.period) { ctx.page.drawText(item.period, { x: x + width - periodWidth, y: y + 11, size: 8, font: ctx.italic, color: opts.dark ? rgb(0.75, 0.77, 0.82) : ctx.muted }); }
    if (description) y = text(ctx, description, x, y - 2, 9, ctx.font, opts.dark ? rgb(0.86, 0.87, 0.9) : ctx.muted, { width, lineHeight: 12 });
    y -= opts.itemGap ?? 10;
  }
  return y;
}

function createContext(doc, data) {
  const ctx = {};
  ctx.page = data.page;
  ctx.font = data.font;
  ctx.bold = data.bold;
  ctx.italic = data.italic;
  ctx.wrap = data.wrap;
  ctx.data = data;
  ctx.photo = data.photo || null;
  ctx.contact = data.contact || {};
  ctx.experience = data.experience || [];
  ctx.education = data.education || [];
  ctx.skills = data.skills || [];
  ctx.languages = data.languages || [];
  ctx.projects = data.projects || [];
  ctx.summary = data.summary || '';
  ctx.skillsTreatment = data.design?.skillsTreatment || '';
  ctx.photoTreatment = data.design?.photoTreatment || '';
  ctx.accent = data.accent;
  ctx.ink = data.ink || colors.ink;
  ctx.rule = data.rule || colors.rule;
  ctx.soft = data.soft || colors.soft;
  ctx.ornament = data.design?.ornament || 'none';
  return ctx;
}

function drawOrnament(ctx, type) {
  if (type === 'dot') ctx.page.drawCircle({ x: PAGE_W - 36, y: PAGE_H - 36, size: 7, color: ctx.accent });
  if (type === 'block') ctx.page.drawRectangle({ x: PAGE_W - 55, y: PAGE_H - 55, width: 24, height: 24, color: ctx.accent });
  if (type === 'corner') { line(ctx, 30, PAGE_H - 30, 90, ctx.accent, 2); ctx.page.drawLine({ start: { x: 30, y: PAGE_H - 30 }, end: { x: 30, y: PAGE_H - 90 }, color: ctx.accent, thickness: 2 }); }
  if (type === 'grid') { for (let i = 0; i < 3; i++) ctx.page.drawLine({ start: { x: PAGE_W - 66 + i * 10, y: PAGE_H - 35 }, end: { x: PAGE_W - 66 + i * 10, y: PAGE_H - 65 }, color: ctx.accent, thickness: 0.7 }); }
  if (type === 'frame') ctx.page.drawRectangle({ x: 18, y: 18, width: PAGE_W - 36, height: PAGE_H - 36, borderColor: ctx.accent, borderWidth: 1.2 });
  if (type === 'axis') ctx.page.drawLine({ start: { x: 28, y: PAGE_H - 110 }, end: { x: 28, y: 45 }, color: ctx.accent, thickness: 1.5 });
  if (type === 'rule') line(ctx, PAGE_W - 90, PAGE_H - 40, PAGE_W - 30, ctx.accent, 2);
}

function drawFooter(ctx, xStart = 30) {
  line(ctx, xStart, 38, PAGE_W - 30, ctx.rule, 0.6);
  // No ecrã, o rodapé mostra o ID e o NOME DO ESTILO escolhido (ex.: "CV-0132
  // · Thesis Studio"), não o nome da pessoa — e mostra o código QR do
  // LinkedIn ao centro quando a opção está ativada. Nenhuma das duas coisas
  // era desenhada aqui antes.
  const footerLabel = [ctx.data.id, ctx.data.styleName].filter(Boolean).join(' · ');
  ctx.page.drawText(footerLabel, { x: xStart, y: 25, size: 7, font: ctx.font, color: ctx.muted, maxWidth: 260 });
  if (ctx.data.linkedinQr) {
    const size = 34;
    const qx = PAGE_W / 2 - size / 2;
    ctx.page.drawImage(ctx.data.linkedinQr, { x: qx, y: 18, width: size, height: size });
    ctx.page.drawText('LinkedIn', { x: qx, y: 12, size: 5.5, font: ctx.font, color: ctx.muted });
  }
  ctx.page.drawText('A4 · 210 × 297 mm', { x: PAGE_W - 120, y: 25, size: 7, font: ctx.font, color: ctx.muted });
}

function standardBody(ctx, x, y, width, order, opts = {}) {
  const sections = order?.length ? order : ['profile', 'experience', 'education', 'projects', 'skills', 'languages'];
  for (const key of sections) y = drawSection(ctx, key, x, y, width, opts);
  return y;
}

// Em composições de coluna única (single, framed, offset, rail, timeline),
// o "sideContent" da receita (normalmente perfil/contacto/idiomas) não tinha
// nenhuma coluna própria para ser desenhado, e ficava simplesmente por
// desenhar — o conteúdo desaparecia do PDF por completo. Esta função combina
// sideContent + sectionOrder numa única lista, sem repetir chaves, para essas
// composições de uma coluna só.
function splitOrders(data, fallbackMain) {
  const side = data.design?.sideContent || [];
  const sideSet = new Set(side);
  const main = (data.design?.sectionOrder?.length ? data.design.sectionOrder : fallbackMain).filter(k => !sideSet.has(k));
  return { side, main };
}

function baseData(doc, data) { return createContext(doc, data); }

export function drawSingle(doc, data) {
  const ctx = baseData(doc, data); drawOrnament(ctx, ctx.ornament);
  let y = PAGE_H - 52; y = drawIdentity(ctx, 48, y, PAGE_W - 96, data.design?.photoTreatment, { headerTreatment: data.design?.headerTreatment }); line(ctx, 48, y, PAGE_W - 48, ctx.accent, 1.2); y -= 22;
  const { side, main } = splitOrders(data, ['profile', 'experience', 'education', 'projects', 'skills', 'languages']);
  y = standardBody(ctx, 48, y, PAGE_W - 96, side, { itemGap: 9 });
  standardBody(ctx, 48, y, PAGE_W - 96, main, { itemGap: 9 }); drawFooter(ctx);
}

export function drawSidebarLeft(doc, data) {
  const ctx = baseData(doc, data); const sideW = 178; ctx.page.drawRectangle({ x: 0, y: 0, width: sideW, height: PAGE_H, color: data.sidebarBg }); drawOrnament(ctx, ctx.ornament);
  let sy = PAGE_H - 42; drawPhoto(ctx, 28, sy, 120, 120, data.design?.photoTreatment); sy -= 142; sy = text(ctx, data.name, 28, sy, 17, ctx.bold, colors.white, { width: 122, lineHeight: 20 }); sy = text(ctx, data.title, 28, sy - 4, 9.5, ctx.font, ctx.accent, { width: 122, lineHeight: 12 }); sy -= 16;
  sy = drawContact(ctx, 28, sy, 122, true); sy = drawSkills(ctx, 28, sy, 122, true); drawLanguages(ctx, 28, sy, 122, true);
  let y = PAGE_H - 52; y = drawIdentity(ctx, sideW + 30, y, PAGE_W - sideW - 60, 'sem fotografia'); line(ctx, sideW + 30, y, PAGE_W - 30, ctx.accent); y -= 22; standardBody(ctx, sideW + 30, y, PAGE_W - sideW - 60, data.design?.sectionOrder, { itemGap: 8 }); drawFooter(ctx, sideW + 20);
}

export function drawSidebarRight(doc, data) {
  const ctx = baseData(doc, data); const sideW = 178; ctx.page.drawRectangle({ x: PAGE_W - sideW, y: 0, width: sideW, height: PAGE_H, color: data.sidebarBg });
  let y = PAGE_H - 52; y = drawIdentity(ctx, 36, y, PAGE_W - sideW - 66, data.design?.photoTreatment); line(ctx, 36, y, PAGE_W - sideW - 30, ctx.accent); y -= 22; standardBody(ctx, 36, y, PAGE_W - sideW - 66, data.design?.sectionOrder, { itemGap: 8 });
  let sy = PAGE_H - 42; drawPhoto(ctx, PAGE_W - sideW + 27, sy, 120, 120, data.design?.photoTreatment); sy -= 142; sy = drawContact(ctx, PAGE_W - sideW + 27, sy, 124, true); sy = drawSkills(ctx, PAGE_W - sideW + 27, sy, 124, true); drawLanguages(ctx, PAGE_W - sideW + 27, sy, 124, true); drawFooter(ctx);
}

export function drawSplit(doc, data) {
  const ctx = baseData(doc, data); const splitX = PAGE_W * 0.53; ctx.page.drawRectangle({ x: 0, y: PAGE_H - 126, width: PAGE_W, height: 126, color: data.sidebarBg });
  drawIdentity(ctx, 38, PAGE_H - 48, PAGE_W - 76, data.design?.photoTreatment, { dark: true }); line(ctx, 38, PAGE_H - 140, PAGE_W - 38, ctx.accent, 1.2);
  let ly = PAGE_H - 174; const leftOrder = (data.design?.sideContent || ['profile', 'skills', 'languages']).filter(k => k !== 'contact'); for (const key of leftOrder) ly = drawSection(ctx, key, 38, ly, splitX - 58, { itemGap: 8 }); drawContact(ctx, 38, ly, splitX - 58);
  let ry = PAGE_H - 174; const rightOrder = data.design?.sectionOrder || ['experience', 'education', 'projects']; for (const key of rightOrder) ry = drawSection(ctx, key, splitX + 24, ry, PAGE_W - splitX - 62, { itemGap: 8 }); drawFooter(ctx);
}

export function drawEditorial(doc, data) {
  const ctx = baseData(doc, data); drawOrnament(ctx, ctx.ornament); let y = PAGE_H - 58;
  ctx.page.drawText((data.category || 'CURRÍCULO').toUpperCase(), { x: 54, y, size: 8, font: ctx.bold, color: ctx.accent }); y -= 25; y = drawIdentity(ctx, 54, y, PAGE_W - 108, data.design?.photoTreatment); line(ctx, 54, y, PAGE_W - 54, ctx.ink, 1.8); y -= 26;
  const { side, main } = splitOrders(data, ['profile', 'experience', 'projects', 'education', 'skills']);
  const col = (PAGE_W - 132) / 2;
  standardBody(ctx, 54, y, col, main.slice(0, 3), { itemGap: 8 });
  standardBody(ctx, 78 + col, y, col, [...main.slice(3), ...side], { itemGap: 8 });
  drawFooter(ctx);
}

export function drawModular(doc, data) {
  const ctx = baseData(doc, data); drawOrnament(ctx, 'grid'); let y = PAGE_H - 48; ctx.page.drawRectangle({ x: 36, y: y - 70, width: 190, height: 70, color: data.sidebarBg }); text(ctx, data.name, 50, y - 24, 19, ctx.bold, colors.white, { width: 160, lineHeight: 22 }); text(ctx, data.title, 50, y - 48, 9, ctx.font, ctx.accent, { width: 160 }); y -= 100;
  const left = 36, gap = 18, col = (PAGE_W - 72 - gap) / 2; standardBody(ctx, left, y, col, data.design?.sideContent, { itemGap: 7 }); standardBody(ctx, left + col + gap, y, col, data.design?.sectionOrder, { itemGap: 7 }); drawFooter(ctx);
}

export function drawTimeline(doc, data) {
  const ctx = baseData(doc, data); let y = PAGE_H - 54; y = drawIdentity(ctx, 54, y, PAGE_W - 108, data.design?.photoTreatment, { headerTreatment: data.design?.headerTreatment }); line(ctx, 54, y, PAGE_W - 54, ctx.accent, 1.2); y -= 24;
  // Perfil/contacto/idiomas (sideContent) não fazem sentido pendurados no
  // eixo cronológico (não são "acontecimentos" com data) — por isso
  // desenham-se primeiro, num bloco normal, e só depois começa o eixo com
  // as secções que fazem sentido em linha do tempo.
  const { side, main } = splitOrders(data, ['experience', 'projects', 'education', 'skills']);
  y = standardBody(ctx, 54, y, PAGE_W - 108, side, { itemGap: 9 });
  if (side.length) y -= 6;
  const axis = 104; ctx.page.drawLine({ start: { x: axis, y }, end: { x: axis, y: 62 }, color: ctx.accent, thickness: 1.4 }); for (const key of main) { ctx.page.drawCircle({ x: axis, y: y - 3, size: 4, color: ctx.accent }); ctx.page.drawText(key.toUpperCase(), { x: 54, y: y - 6, size: 7, font: ctx.bold, color: ctx.accent }); y = drawSection(ctx, key, axis + 22, y, PAGE_W - axis - 76, { rule: false, itemGap: 9 }); y -= 4; } drawFooter(ctx);
}

export function drawFramed(doc, data) {
  const ctx = baseData(doc, data); drawOrnament(ctx, 'frame'); let y = PAGE_H - 58; ctx.page.drawText('CV', { x: 52, y, size: 9, font: ctx.bold, color: ctx.accent }); y -= 22; y = drawIdentity(ctx, 52, y, PAGE_W - 104, data.design?.photoTreatment, { headerTreatment: data.design?.headerTreatment }); line(ctx, 52, y, PAGE_W - 52, ctx.accent); y -= 24;
  const { side, main } = splitOrders(data, ['profile', 'experience', 'education', 'skills', 'projects']);
  y = standardBody(ctx, 52, y, PAGE_W - 104, side, { itemGap: 9 });
  standardBody(ctx, 52, y, PAGE_W - 104, main, { itemGap: 9 }); drawFooter(ctx);
}

export function drawOffset(doc, data) {
  const ctx = baseData(doc, data); ctx.page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: ctx.soft }); drawPhoto(ctx, PAGE_W - 134, PAGE_H - 34, 82, 82, data.design?.photoTreatment); let y = PAGE_H - 48; y = text(ctx, data.name, 48, y, 27, ctx.bold, ctx.ink, { width: 330, lineHeight: 30 }); y = text(ctx, data.title, 48, y - 2, 10, ctx.font, ctx.accent, { width: 330 }); y -= 52;
  const { side, main } = splitOrders(data, ['experience', 'profile', 'education', 'projects', 'skills']);
  y = standardBody(ctx, 48, y, PAGE_W - 96, side, { itemGap: 8 });
  standardBody(ctx, 48, y, PAGE_W - 96, main, { itemGap: 8 }); drawFooter(ctx);
}

export function drawRail(doc, data) {
  const ctx = baseData(doc, data); const rail = 44; ctx.page.drawRectangle({ x: 0, y: 0, width: rail, height: PAGE_H, color: data.sidebarBg }); ctx.page.drawText('CV', { x: 15, y: PAGE_H - 44, size: 11, font: ctx.bold, color: colors.white, rotate: degrees(90) }); ctx.page.drawLine({ start: { x: 22, y: PAGE_H - 100 }, end: { x: 22, y: 45 }, color: ctx.accent, thickness: 2 });
  let y = PAGE_H - 54; y = drawIdentity(ctx, rail + 28, y, PAGE_W - rail - 58, data.design?.photoTreatment); line(ctx, rail + 28, y, PAGE_W - 30, ctx.accent); y -= 22;
  const { side, main } = splitOrders(data, ['experience', 'projects', 'education', 'skills']);
  y = standardBody(ctx, rail + 28, y, PAGE_W - rail - 58, side, { itemGap: 8 });
  standardBody(ctx, rail + 28, y, PAGE_W - rail - 58, main, { itemGap: 8 }); drawFooter(ctx, rail + 20);
}

export const compositionLayouts = { single: drawSingle, 'sidebar-left': drawSidebarLeft, 'sidebar-right': drawSidebarRight, split: drawSplit, editorial: drawEditorial, modular: drawModular, timeline: drawTimeline, framed: drawFramed, offset: drawOffset, rail: drawRail };
export default compositionLayouts;
