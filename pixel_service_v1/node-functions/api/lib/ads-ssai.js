// lib/ads-ssai.js
// ── SSAI: pods de anúncio pré-processados + splicing de manifest HLS ───────
//
// Um "ad pod" é um vídeo de anúncio processado pelo MESMO pipeline usado pro
// conteúdo normal (ingest -> dispatcher -> HLS em raw.githubusercontent.com)
// — não há nenhum transcoder novo aqui, só reaproveitamos o que já existe.
// O splicing busca os segmentos do master.m3u8 do pod e entrelaça no
// manifest do conteúdo, ANTES de o servidor devolver a resposta — o cliente
// só vê um manifest só, pelo mesmo domínio/URL do conteúdo normal. É isso
// que torna o bloqueio por adblock difícil: não há URL/domínio de anúncio
// separado pra uma lista de bloqueio reconhecer.
//
// Só cobre conteúdo NÃO encriptado por agora — ver comentário em
// routes/content.js na rota /manifest.m3u8. Conteúdo encriptado continua a
// servir o manifest original sem SSAI até sabermos como entrelaçar troca de
// chaves ECDH por segmento sem arriscar quebrar a reprodução.
//
// ── MUDANÇA DE ARQUITETURA (definitiva — remove KV e Turso deste caminho) ──
// Versões anteriores guardavam a lista de pods e um cache de segmentos no KV
// (`edgeone.get/put('progress', ...)`). Isso foi removido de propósito.
// Motivo: `/manifest.m3u8` é uma rota de STREAMING — é chamada com MUITA
// frequência (todo player pede o manifest ao iniciar, e alguns re-pedem
// periodicamente). Cada round-trip a um serviço externo no meio desse
// caminho — KV ou, pior, uma query Turso — soma latência real e, no runtime
// de Node Functions, tempo de execução cobrado por invocação. Multiplicado
// pelo volume de pedidos de manifest, isso é exactamente o tipo de coisa que
// estoura a cota do plano grátis e derruba a instância por timeout — sem
// ter NADA a ver com o Adsterra/HilltopAds em si. A escolha de arquitetura
// agora é: nenhuma lógica de anúncio (SSAI ou não) toca em storage externo
// no caminho de servir conteúdo.
//
// Fonte de verdade dos pods agora: env var `AD_PODS_JSON` (JSON array),
// lida e parseada UMA VEZ por processo (memoizada em `staticPods`) — custo
// de I/O zero, custo de CPU desprezível (parse de uma string pequena, uma
// vez só, nunca por request). Formato:
//   AD_PODS_JSON='[{"id":"pod1","masterUrl":"https://raw.githubusercontent.com/.../master.m3u8","label":"Pod 1"}]'
//
// As rotas /api/admin/ads/pods continuam a existir (ver routes/admin.js),
// mas agora só mexem numa camada EFÊMERA em memória do processo — válida
// só na instância actual, perdida no próximo cold start/redeploy, e NÃO
// propagada a outras instâncias quentes. É uma troca deliberada: zero
// storage externo no hot path do streaming, ao custo de "adicionar pod" via
// API não ser mais instantaneamente global nem persistente — pra isso,
// edite `AD_PODS_JSON` e faça redeploy (é a fonte de verdade real).
//
// O único I/O externo que continua a existir aqui é o fetch do PRÓPRIO
// master.m3u8/media playlist do pod (raw.githubusercontent.com) — isso não
// é KV nem Turso, é literalmente buscar o vídeo do anúncio, o que é
// inevitável. Mas agora está cacheado em memória (`segmentsMemCache`) com
// TTL, então só acontece uma vez a cada janela de cache, nunca por request.

import { fetchWithTimeout, withTimeout } from './timeout.js';

// Orçamentos de tempo — ajustáveis por env var sem precisar mexer no código.
const AD_FETCH_TIMEOUT_MS      = Number(process.env.AD_FETCH_TIMEOUT_MS) || 1500;   // por fetch individual (master/media do pod)
const AD_SPLICE_TIMEOUT_MS     = Number(process.env.AD_SPLICE_TIMEOUT_MS) || 1200;  // orçamento total do pipeline de anúncio
const AD_SEGMENTS_CACHE_TTL_MS = Number(process.env.AD_SEGMENTS_CACHE_TTL_MS) || 120_000; // 2min — reduz refetch do pod

// ── Pods: env var estática (fonte de verdade) + override efêmero em memória ─
// NADA aqui toca em KV/Turso. `_edgeoneUnused` é aceite só por compatibilidade
// de assinatura com quem já chama estas funções (routes/admin.js,
// routes/content.js) — não é lido nem usado.

let staticPods = null; // memoizado — parse de AD_PODS_JSON acontece 1x por processo
function getStaticPods() {
    if (staticPods) return staticPods;
    try {
        const raw = process.env.AD_PODS_JSON;
        staticPods = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(staticPods)) staticPods = [];
    } catch (err) {
        console.error('[ads-ssai] AD_PODS_JSON inválido (deve ser um array JSON), a ignorar:', err.message);
        staticPods = [];
    }
    return staticPods;
}

// Override em memória, só para as rotas /api/admin/ads/pods — permite testar
// um pod novo sem esperar um redeploy. `null` = "usa staticPods sem alterações".
let ephemeralOverride = null;

export async function listAdPods(_edgeoneUnused) {
    return ephemeralOverride || getStaticPods();
}

export async function addAdPod(_edgeoneUnused, { id, masterUrl, label }) {
    if (!id || !masterUrl) throw new Error('id e masterUrl são obrigatórios');
    const base = ephemeralOverride || getStaticPods();
    const next = base.filter(p => p.id !== id);
    next.push({ id, masterUrl, label: label || id, addedAt: new Date().toISOString(), ephemeral: true });
    ephemeralOverride = next;
    return next;
}

export async function removeAdPod(_edgeoneUnused, id) {
    const base = ephemeralOverride || getStaticPods();
    const next = base.filter(p => p.id !== id);
    ephemeralOverride = next;
    return next;
}

// Só para testes/admin avançado: descarta o override e volta a servir
// exactamente o que está em AD_PODS_JSON.
export function resetEphemeralPodsOverride() {
    ephemeralOverride = null;
}

// Escolhe um pod ao acaso (rotação simples). null se nenhum registado —
// nesse caso o splicing vira no-op (passthrough do manifest original).
export async function pickAdPod(_edgeoneUnused) {
    const pods = await listAdPods();
    if (!pods.length) return null;
    return pods[Math.floor(Math.random() * pods.length)];
}

// ── Parsing/splicing de manifest HLS (texto puro, sem libs externas) ───────

function parseManifest(text) {
    const lines  = text.split('\n');
    const header = [];
    const segments = [];
    let pendingExtinf = null;
    let inHeader = true;

    for (const raw of lines) {
        const line = raw.replace(/\r$/, '');
        const t    = line.trim();

        if (t.startsWith('#EXTINF:')) {
            inHeader = false;
            pendingExtinf = t;
            continue;
        }
        if (t === '#EXT-X-ENDLIST') continue; // recriada no fim, depois do splice
        if (t && !t.startsWith('#')) {
            segments.push({ extinf: pendingExtinf || '#EXTINF:4.0,', uri: t });
            pendingExtinf = null;
            continue;
        }
        if (inHeader) header.push(line);
        // outras tags de corpo (ex: #EXT-X-DISCONTINUITY já existentes) são
        // ignoradas de propósito — os manifests gerados pelo pipeline não
        // costumam ter isso, e simplifica o splicing.
    }
    return { header, segments };
}

function toAbsoluteUri(uri, manifestUrl) {
    if (/^https?:\/\//i.test(uri)) return uri;
    const base = manifestUrl.replace(/\/[^/]*$/, '');
    return `${base}/${uri}`;
}

// ── Resolução de master.m3u8 → media playlist ───────────────────────────────
// BUG REAL corrigido aqui: `adPod.masterUrl` aponta para um master.m3u8, que
// neste pipeline é sempre uma playlist de VARIANTES (#EXT-X-STREAM-INF ->
// index.m3u8), nunca uma lista de segmentos directamente — confirmado pelo
// comentário em lib/edgeone.js ("o player lê master.m3u8 → index.m3u8 →
// .bin directamente"). O código antigo tratava cada linha não-comentário do
// master.m3u8 como se já fosse um segmento .bin/.ts — na prática injectava a
// URI do index.m3u8 (uma playlist de texto) como se fosse um segmento de
// vídeo, o que faz o hls.js falhar a fazer demux (fatal error) ou ficar
// preso à espera de dados que nunca chegam (spinner infinito).
function extractFirstVariantUri(masterText) {
    const lines = masterText.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].replace(/\r$/, '').trim();
        if (t.startsWith('#EXT-X-STREAM-INF')) {
            const next = (lines[i + 1] || '').replace(/\r$/, '').trim();
            if (next && !next.startsWith('#')) return next;
        }
    }
    return null;
}

async function resolveAdSegments(adPod) {
    const masterRes = await fetchWithTimeout(adPod.masterUrl, AD_FETCH_TIMEOUT_MS);
    if (!masterRes.ok) return [];
    const masterText = await masterRes.text();

    // Se o master.m3u8 tiver variantes (#EXT-X-STREAM-INF), resolve a
    // primeira e usa a MEDIA playlist dela para extrair os segmentos.
    // Se não tiver variantes (ex: alguém registou já uma media playlist
    // diretamente), usa o próprio texto como fallback — mantém
    // compatibilidade sem assumir estrutura que pode não existir.
    const variantUri = extractFirstVariantUri(masterText);
    let mediaText = masterText;
    let mediaUrl  = adPod.masterUrl;

    if (variantUri) {
        mediaUrl = toAbsoluteUri(variantUri, adPod.masterUrl);
        const mediaRes = await fetchWithTimeout(mediaUrl, AD_FETCH_TIMEOUT_MS);
        if (!mediaRes.ok) return [];
        mediaText = await mediaRes.text();
    }

    const { segments } = parseManifest(mediaText);
    return segments.map(seg => ({ extinf: seg.extinf, uri: toAbsoluteUri(seg.uri, mediaUrl) }));
}

// ── Cache de segmentos resolvidos — 100% em memória, zero storage externo ──
// Evita refazer as 2 idas à rede (master + media) a CADA pedido de manifest;
// só refaz quando o cache desta instância expira. Não é partilhado entre
// instâncias/regiões — isso é intencional: preferimos cada instância buscar
// de forma independente e barata a introduzir qualquer dependência de
// storage partilhado no hot path.
const segmentsMemCache = new Map(); // podId -> { segments, expiresAt }

async function fetchAdSegments(adPod) {
    if (!adPod) return [];
    try {
        const cached = segmentsMemCache.get(adPod.id);
        if (cached && cached.expiresAt > Date.now()) return cached.segments;

        const segments = await resolveAdSegments(adPod);
        if (segments.length) {
            segmentsMemCache.set(adPod.id, { segments, expiresAt: Date.now() + AD_SEGMENTS_CACHE_TTL_MS });
        }
        return segments;
    } catch {
        return [];
    }
}

const renderSeg   = (seg) => `${seg.extinf}\n${seg.uri}`;
const renderBlock = (segs) => segs.map(renderSeg).join('\n');

// ── Cadência de mid-roll por TEMPO real, não por contagem de segmentos ────
// Pedido de produto: 1 anúncio a cada ~10 min de reprodução, não 1 corte fixo
// no meio do vídeo (que dava sempre exactamente 1 mid-roll, ignorando se o
// título tem 20 min ou 3 horas). Os segmentos de um HLS não têm duração
// fixa — por isso somamos a duração real de cada um (`#EXTINF:seg,`) em vez
// de contar índices.
const AD_BREAK_INTERVAL_SEC = Number(process.env.AD_BREAK_INTERVAL_SEC) || 600; // 10 min
const AD_MAX_MIDROLLS       = Number(process.env.AD_MAX_MIDROLLS)       || 8;   // trava contra conteúdo anormalmente longo
const AD_MIN_TAIL_SEC       = Number(process.env.AD_MIN_TAIL_SEC)       || 30;  // não vale a pena um mid-roll a <30s do fim

function parseExtinfSeconds(extinf) {
    const m = /^#EXTINF:\s*([\d.]+)/.exec(extinf || '');
    return m ? parseFloat(m[1]) : 4; // mesmo fallback usado em parseManifest pra segmentos sem EXTINF válido
}

/**
 * Devolve os índices de segmento (ponto de corte, não-inclusive) onde cada
 * mid-roll deve entrar, com base na duração acumulada REAL — não na posição
 * na lista. Descarta o último corte se sobrar menos de AD_MIN_TAIL_SEC de
 * conteúdo depois dele (evita um anúncio seguido de 5s de vídeo e fim).
 */
function computeMidrollIndexes(segments, intervalSec) {
    const cumulative = [];
    let acc = 0;
    for (const seg of segments) {
        acc += parseExtinfSeconds(seg.extinf);
        cumulative.push(acc);
    }
    const total = acc;

    const indexes = [];
    let nextTarget = intervalSec;
    for (let i = 0; i < segments.length && indexes.length < AD_MAX_MIDROLLS; i++) {
        if (cumulative[i] >= nextTarget) {
            indexes.push(i + 1);
            nextTarget += intervalSec;
        }
    }

    while (indexes.length) {
        const last      = indexes[indexes.length - 1];
        const remaining = total - (cumulative[last - 1] ?? 0);
        if (remaining < AD_MIN_TAIL_SEC) indexes.pop(); else break;
    }

    return indexes;
}

/**
 * Entrelaça o pod de anúncio no manifest original: 1 bloco pré-roll (antes
 * de tudo) + 1 bloco mid-roll a cada ~AD_BREAK_INTERVAL_SEC de conteúdo real
 * (não 1 corte fixo no meio — ver computeMidrollIndexes), usando
 * #EXT-X-DISCONTINUITY entre blocos (obrigatório no HLS sempre que muda a
 * fonte/timeline). Se não houver pod disponível, o manifest não tiver
 * segmentos reconhecíveis, OU o pipeline de anúncio estourar o orçamento de
 * tempo (`AD_SPLICE_TIMEOUT_MS`), devolve o original sem alterações — nunca
 * falha "fechado" (um anúncio lento ou fora do ar nunca deve impedir o
 * conteúdo de tocar). Não recebe nem precisa de `edgeone` — zero storage
 * externo neste caminho.
 */
export async function spliceAdsIntoManifest(originalText, adPod) {
    try {
        const adSegments = await withTimeout(
            fetchAdSegments(adPod),
            AD_SPLICE_TIMEOUT_MS,
            [], // estourou o orçamento -> segue sem anúncio, não sem conteúdo
        );
        if (!adSegments.length) return originalText;

        const { header, segments } = parseManifest(originalText);
        if (!segments.length) return originalText;

        const midrollIndexes = computeMidrollIndexes(segments, AD_BREAK_INTERVAL_SEC);

        const parts = [...header, '#EXT-X-DISCONTINUITY', renderBlock(adSegments)]; // pre-roll

        let cursor = 0;
        for (const idx of midrollIndexes) {
            parts.push('#EXT-X-DISCONTINUITY');
            parts.push(renderBlock(segments.slice(cursor, idx)));
            parts.push('#EXT-X-DISCONTINUITY');
            parts.push(renderBlock(adSegments)); // mesmo pod em cada mid-roll
            cursor = idx;
        }

        parts.push('#EXT-X-DISCONTINUITY');
        parts.push(renderBlock(segments.slice(cursor)));

        parts.push('#EXT-X-ENDLIST');
        return parts.join('\n') + '\n';
    } catch (err) {
        console.error('[ads-ssai] splice falhou, a servir manifest original:', err.message);
        return originalText;
    }
}
