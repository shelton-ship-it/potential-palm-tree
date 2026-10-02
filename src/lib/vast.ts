// lib/vast.ts
// ── Helper VAST compartilhado — usado pelo AdPrerollGate e MidRollOverlay ──
// Parsing simples via DOMParser nativo, sem SDK externo (IMA, etc.). Suporta
// VAST 2.0/3.0 InLine e Wrapper (segue VASTAdTagURI, com limite de saltos),
// Ad Pods (múltiplos <Ad sequence="N"> num único documento VAST — usado pelo
// mid-roll pra até MAX_ADS_PER_MIDROLL anúncios, ver MidRollOverlay.tsx),
// tracking events (start/firstQuartile/midpoint/thirdQuartile/complete/skip),
// skipoffset (segundos ou percentagem) e os Error URIs.

export interface VastAd {
  mediaUrl:          string;
  impressions:       string[];
  tracking:          Record<string, string[]>; // start, firstQuartile, midpoint, thirdQuartile, complete, skip, pause, resume...
  errorUrls:         string[];                 // <Error> — a fire com [ERRORCODE] substituído
  skipOffsetSeconds: number | null;             // null = não pulável
  durationSeconds:   number | null;
}

const MAX_WRAPPER_DEPTH = 3;

function parseSkipOffset(raw: string | null, durationSeconds: number | null): number | null {
  if (!raw) return null;
  if (raw.endsWith('%')) {
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || !durationSeconds) return null;
    return Math.max(0, Math.round((pct / 100) * durationSeconds));
  }
  const parts = raw.split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const parts = raw.split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

async function fetchXml(url: string, timeoutMs: number): Promise<Document | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res   = await fetch(url, { signal: ctrl.signal }).catch(() => null);
    clearTimeout(timer);
    if (!res?.ok) return null;

    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    return doc;
  } catch {
    return null;
  }
}

function mergeTracking(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = { ...a };
  for (const [ev, urls] of Object.entries(b)) out[ev] = [...(out[ev] || []), ...urls];
  return out;
}

// Extrai impressões/erros/tracking ESCOPADOS a um único elemento <Ad> — crítico
// pra Ad Pods, onde vários <Ad> convivem no mesmo documento e cada um tem os
// seus próprios trackers (usar getElementsByTagName no documento inteiro
// misturaria os trackers de anúncios diferentes do mesmo pod).
function extractLevelData(scope: Element | Document) {
  const impressions = Array.from(scope.getElementsByTagName('Impression'))
    .map(n => n.textContent?.trim()).filter((u): u is string => !!u);
  const errorUrls = Array.from(scope.getElementsByTagName('Error'))
    .map(n => n.textContent?.trim()).filter((u): u is string => !!u);
  const tracking: Record<string, string[]> = {};
  Array.from(scope.getElementsByTagName('Tracking')).forEach(n => {
    const ev = n.getAttribute('event');
    const url = n.textContent?.trim();
    if (!ev || !url) return;
    (tracking[ev] ||= []).push(url);
  });
  return { impressions, errorUrls, tracking };
}

// Segue Wrapper (VASTAdTagURI) ESCOPADO a um único <Ad> (não ao documento
// inteiro — importante em pods) até encontrar um InLine com MediaFile, ou
// esgotar MAX_WRAPPER_DEPTH.
async function parseAdElement(adEl: Element, timeoutMs: number, depth: number): Promise<VastAd | null> {
  if (depth > MAX_WRAPPER_DEPTH) return null;

  const level = extractLevelData(adEl);

  const wrapperTagUri = adEl.querySelector('Wrapper > VASTAdTagURI, Wrapper VASTAdTagURI')?.textContent?.trim();
  if (wrapperTagUri) {
    const innerDoc = await fetchXml(wrapperTagUri, timeoutMs);
    const innerAdEl = innerDoc?.getElementsByTagName('Ad')[0] || null;
    if (!innerAdEl) return null; // wrapper aponta pra nada útil — trata como ausência de anúncio
    const inner = await parseAdElement(innerAdEl, timeoutMs, depth + 1);
    if (!inner) return null;
    return {
      mediaUrl:          inner.mediaUrl,
      impressions:       [...level.impressions, ...inner.impressions],
      errorUrls:         [...level.errorUrls, ...inner.errorUrls],
      skipOffsetSeconds: inner.skipOffsetSeconds,
      durationSeconds:   inner.durationSeconds,
      tracking:          mergeTracking(level.tracking, inner.tracking),
    };
  }

  const mediaFiles = Array.from(adEl.getElementsByTagName('MediaFile'));
  if (!mediaFiles.length) return null;
  // prioriza mp4 progressive — toca directo num <video>, sem hls.js
  const mp4 = mediaFiles.find(m => (m.getAttribute('type') || '').includes('mp4'));
  const mediaUrl = (mp4 || mediaFiles[0])?.textContent?.trim();
  if (!mediaUrl) return null;

  const linear = adEl.getElementsByTagName('Linear')[0] || null;
  const durationSeconds = parseDuration(linear?.getElementsByTagName('Duration')[0]?.textContent?.trim() || null);
  const skipOffsetSeconds = parseSkipOffset(linear?.getAttribute('skipoffset') || null, durationSeconds);

  return { mediaUrl, ...level, skipOffsetSeconds, durationSeconds };
}

// Pre-roll (e qualquer outro uso de anúncio único): pega o PRIMEIRO <Ad> do
// documento VAST.
export async function fetchVastAd(vastUrl: string, timeoutMs = 4000): Promise<VastAd | null> {
  const doc = await fetchXml(vastUrl, timeoutMs);
  const adEl = doc?.getElementsByTagName('Ad')[0] || null;
  if (!adEl) return null;
  return parseAdElement(adEl, timeoutMs, 0);
}

// Mid-roll com Ad Pod: UMA única requisição a vastUrl — se a resposta trouxer
// vários <Ad> (pod real, ordenados por @sequence quando presente), devolve
// até maxAds deles já parseados. Nunca faz requests extra pra "completar" um
// pod — só usa o que o VAST efectivamente devolveu na única chamada.
// Devolve [] se não houver nenhum anúncio válido (nunca lança).
export async function fetchVastPod(vastUrl: string, maxAds: number, timeoutMs = 4000): Promise<VastAd[]> {
  const doc = await fetchXml(vastUrl, timeoutMs);
  if (!doc) return [];

  const adEls = Array.from(doc.getElementsByTagName('Ad'));
  if (!adEls.length) return [];

  const sorted = [...adEls].sort((a, b) => {
    const sa = parseInt(a.getAttribute('sequence') || '', 10);
    const sb = parseInt(b.getAttribute('sequence') || '', 10);
    if (Number.isFinite(sa) && Number.isFinite(sb)) return sa - sb;
    return 0; // sem @sequence — mantém a ordem do documento
  });

  const results: VastAd[] = [];
  for (const el of sorted.slice(0, maxAds)) {
    const parsed = await parseAdElement(el, timeoutMs, 0);
    if (parsed) results.push(parsed); // um anúncio inválido no pod é simplesmente ignorado, não trava os outros
  }
  return results;
}

export function firePixels(urls: string[] | undefined) {
  (urls || []).forEach(url => { fetch(url, { mode: 'no-cors' }).catch(() => {}); });
}

// Mantido por compat — nome antigo, mesmo comportamento.
export const fireImpressions = firePixels;

export function fireTrackingEvent(ad: VastAd | null | undefined, event: string) {
  if (!ad) return;
  firePixels(ad.tracking[event]);
}

// Dispara os Error URIs da cadeia VAST (InLine + Wrappers), substituindo a
// macro [ERRORCODE] pelo código informado (901 = VAST não conseguiu tocar
// o media file; 900 = indefinido). Nunca bloqueia o retorno ao conteúdo.
export function fireVastError(ad: VastAd | null | undefined, code = 900) {
  if (!ad) return;
  firePixels(ad.errorUrls.map(u => u.replace('[ERRORCODE]', String(code))));
}
