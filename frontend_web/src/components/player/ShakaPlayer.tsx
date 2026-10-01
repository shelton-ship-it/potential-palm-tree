'use client';
/**
 * ShakaPlayer.tsx — StreamVault v9.2 (bugfix: init segment onProgress)
 *
 * CORRECÇÃO vs v9.1:
 *   O hls.js chama o loader para dois tipos de ficheiros .bin:
 *     1. Init segment (#EXT-X-MAP:URI="init.bin") — context.type === 'initSegment'
 *        → callbacks NÃO tem onProgress. Só tem onSuccess e onError.
 *        → Deve acumular todos os chunks e chamar onSuccess uma vez no fim.
 *
 *     2. Segmentos normais (seg00001.bin, etc.) — context.type === 'frag'
 *        → callbacks TEM onProgress.
 *        → Streaming progressivo chunk a chunk (comportamento original v9.1).
 *
 *   v9.1 chamava onProgress para AMBOS os tipos → TypeError no init segment.
 */

import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import HdIcon       from '@mui/icons-material/Hd';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { shouldAutoFocus } from '@/lib/tv-navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Device fingerprint — sinal de RECUPERAÇÃO para o backend (rate-limit.js).
// Não substitui o cookie de device-id (que continua sendo a chave principal
// do contador de free-time); serve só para o backend reconhecer o mesmo
// browser quando o cookie foi limpo, evitando reset trivial da 1h grátis.
// Calculado uma única vez e cacheado — FingerprintJS.load() é relativamente
// caro (~50-100ms) e o visitorId não muda entre chamadas na mesma sessão.
// ─────────────────────────────────────────────────────────────────────────────
let fpPromise: Promise<string> | null = null;
function getDeviceFingerprint(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
      .then(fp => fp.get())
      .then(result => result.visitorId)
      .catch(() => '');
  }
  return fpPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// ECDH handshake
// ─────────────────────────────────────────────────────────────────────────────

// Sinais de rede/dispositivo enviados no handshake — sem ABR no player, a
// única forma de adaptar a qualidade à ligação/aparelho é o BACKEND escolher
// bem logo no início (não há troca de qualidade a meio do stream). Isto não
// obriga o backend a nada: são só query params extra que ele pode escolher
// ler (ou ignorar, como faz hoje) para decidir que `quality`/`master_url`
// devolver. Falha silenciosamente se as APIs não existirem (Safari/Firefox
// não têm Network Information API, por exemplo).
function getNetworkDeviceHints(): Record<string, string> {
  const hints: Record<string, string> = {};
  try {
    const conn = (navigator as any).connection;
    if (conn) {
      if (typeof conn.downlink === 'number')     hints.netDownlinkMbps = String(conn.downlink);
      if (typeof conn.effectiveType === 'string') hints.netEffectiveType = conn.effectiveType;
      if (typeof conn.rtt === 'number')          hints.netRttMs = String(conn.rtt);
      if (conn.saveData === true)                hints.netSaveData = '1';
    }
  } catch { /* Network Information API indisponível */ }
  try {
    const mem = (navigator as any).deviceMemory;
    if (typeof mem === 'number') hints.deviceMemoryGb = String(mem);
  } catch { /* deviceMemory indisponível */ }
  try {
    if (typeof navigator.hardwareConcurrency === 'number') {
      hints.hwConcurrency = String(navigator.hardwareConcurrency);
    }
  } catch { /* ignorar */ }
  return hints;
}

async function performECDH(
  streamApiUrl: string,
  token: string,
): Promise<{ drmKeyHex: string; masterUrl: string; noncesUrl?: string; segExt?: 'bin' | 'ts'; quality?: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub  = await crypto.subtle.exportKey('raw', pair.publicKey);
  const b64  = btoa(String.fromCharCode(...new Uint8Array(pub)));
  const fp   = await getDeviceFingerprint();

  const hints = getNetworkDeviceHints();
  const params = new URLSearchParams({ clientPubKey: b64, ...hints });
  const sep = streamApiUrl.includes('?') ? '&' : '?';

  const res = await fetch(`${streamApiUrl}${sep}${params.toString()}`, {
    // FIX: credentials 'include' — frontend e API vivem em subdomínios
    // diferentes (origens diferentes); sem isto o cookie pv_did (device-id)
    // nunca é enviado nem gravado pelo browser, e o rate-limit por device
    // nunca funciona de facto em produção.
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fp ? { 'X-Device-Fp': fp } : {}),
    },
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body?.message || 'Limite atingido');
    err.status = 429; err.plans = body?.plans ?? [];
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Stream API error ${res.status}`);
  }

  const d = await res.json();
  return {
    drmKeyHex: d.drm_key_hex ?? d.drmKeyHex ?? '',
    masterUrl: d.master_url  ?? d.url        ?? '',
    noncesUrl: d.nonces_url  ?? d.noncesUrl,
    segExt:    d.seg_ext     ?? d.segExt     ?? 'bin',
    quality:   d.quality,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker singleton — ficheiro real (src/workers/decrypt.worker.ts), compilado
// pelo webpack do Next.js (suporte nativo desde webpack 5 / Next.js 11+).
// Substitui a versão anterior (string embutida num Blob) — permite usar uma
// dependência npm real (@noble/ciphers) em vez de código colado manualmente.
// ─────────────────────────────────────────────────────────────────────────────

type SegCb = {
  onPlain: (chunk: ArrayBuffer) => void;
  onDone:  (bytesTotal: number) => void;
  onError: (e: Error) => void;
};

let _worker:   Worker | null = null;
let _handlers: Map<string, SegCb> = new Map();
let _segCtr    = 0;

function getWorker(): Worker {
  if (_worker) return _worker;
  // Sintaxe estática exigida pelo webpack (não aceita caminho dinâmico) —
  // ver https://webpack.js.org/guides/web-workers/. Sem { type: 'module' }
  // de propósito: é o padrão suportado nativamente pelo Next.js/webpack 5
  // (com type:'module' há relatos de falhas de build em algumas versões).
  _worker = new Worker(new URL('../../workers/decrypt.worker.ts', import.meta.url));
  _worker.onerror = (e) => {
    const err = new Error(e.message ?? 'Worker crashed');
    _handlers.forEach(h => h.onError(err));
    _handlers.clear();
    _worker = null;
  };
  _worker.onmessage = ({ data }) => {
    const h = _handlers.get(data.segId);
    if (!h) return;
    if (data.type === 'seg_plain') h.onPlain(data.plain);
    else if (data.type === 'seg_done') {
      _handlers.delete(data.segId);
      h.onDone(data.bytesTotal ?? 0);
    } else if (data.type === 'seg_error') {
      _handlers.delete(data.segId);
      h.onError(new Error(data.message || `fetch error ${data.code ?? ''}`));
    }
  };
  return _worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// BinLoader v9.2
//
// CORRECÇÃO PRINCIPAL:
//   O hls.js chama o loader para dois tipos distintos de pedidos:
//
//   context.type === 'initSegment'  (init.bin via #EXT-X-MAP)
//     → callbacks = { onSuccess, onError }   — SEM onProgress
//     → Estratégia: acumular todos os chunks plaintext, chamar onSuccess no fim
//
//   context.type === 'frag'  (seg00001.bin, seg00002.bin, ...)
//     → callbacks = { onSuccess, onError, onProgress }
//     → Estratégia: streaming progressivo chunk a chunk via onProgress
//
// ─────────────────────────────────────────────────────────────────────────────

function makeBinLoader(Hls: any, keyHex: string, offlineContentId?: string) {
  const DefaultLoader = Hls.DefaultConfig.loader as any;

  return class BinLoader extends DefaultLoader {
    private _segId:     string | null = null;
    private _timeoutId: any = null;

    constructor(cfg: any) { super(cfg); }

    load(context: any, _config: any, callbacks: any) {
      if (!context.url?.endsWith('.bin')) {
        return super.load(context, _config, callbacks);
      }

      const t0    = performance.now();
      const segId = `s${++_segCtr}`;
      this._segId = segId;

      const worker = getWorker();

      // FIX: no ramo de rede o fetch corre dentro do worker (ver segFetch),
      // por isso `fragLoadingTimeOut` da config do Hls NÃO se aplica aqui.
      // Sem isto, um fetch preso (rede instável) nunca disparava erro/retry
      // e o player ficava a carregar para sempre. Não se aplica ao ramo
      // offline (IndexedDB local, sem rede, sem risco de ficar pendurado).
      const clearTimer = () => { clearTimeout(this._timeoutId); this._timeoutId = null; };
      if (!offlineContentId) {
        const timeoutMs = (_config?.timeout as number) || 20_000;
        this._timeoutId = setTimeout(() => {
          worker.postMessage({ type: 'seg_abort', segId });
          _handlers.delete(segId);
          callbacks.onError({ code: 0, text: 'timeout' }, context, null);
        }, timeoutMs);
      }

      // Detecta se é init segment: não tem onProgress
      const isInit = typeof callbacks.onProgress !== 'function';

      let bytesLoaded = 0;
      let tFirst      = 0;

      // Acumulador usado apenas para init segments
      const initChunks: ArrayBuffer[] = [];

      // Agrega chunks pequenos vindos do worker antes de entregar ao hls.js:
      // cada onProgress normalmente resulta num appendBuffer no SourceBuffer,
      // e chamar isso a cada chunk de ~16-64KB gera overhead desnecessário
      // (custa mais em CPUs fracas). Agrupar em blocos maiores reduz o nº
      // de appendBuffer sem mudar nada do protocolo de decriptação. Aplica-se
      // igualmente ao ramo offline, já que passa pelo mesmo handler.
      let pending: Uint8Array[] = [];
      let pendingBytes = 0;
      const FLUSH_THRESHOLD = 256 * 1024;

      const flushPending = (now: number) => {
        if (!pendingBytes) return;
        const merged = new Uint8Array(pendingBytes);
        let off = 0;
        for (const c of pending) { merged.set(c, off); off += c.length; }
        pending = [];
        pendingBytes = 0;
        callbacks.onProgress(makeStats(bytesLoaded, 0, now), context, merged.buffer, null);
      };

      const makeStats = (loaded: number, total: number, end: number) => ({
        aborted:    false,
        loaded,
        total,
        retry:      0,
        chunkCount: 0,
        bwEstimate: 0,
        loading:  { start: t0, first: tFirst || t0, end },
        parsing:  { start: end, end },
        buffering:{ start: 0, first: 0, end: 0 },
      });

      _handlers.set(segId, {
        onPlain: (chunk: ArrayBuffer) => {
          const now = performance.now();
          if (!tFirst) tFirst = now;
          bytesLoaded += chunk.byteLength;

          if (isInit) {
            // Init segment: acumula — onProgress não existe
            initChunks.push(chunk);
          } else {
            // Segmento normal: agrega antes de entregar (ver FLUSH_THRESHOLD)
            pending.push(new Uint8Array(chunk));
            pendingBytes += chunk.byteLength;
            if (pendingBytes >= FLUSH_THRESHOLD) flushPending(now);
          }
        },

        onDone: (bytesTotal: number) => {
          const now = performance.now();
          clearTimer();

          if (isInit) {
            // Concatena todos os chunks e entrega de uma vez
            const total = initChunks.reduce((s, c) => s + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let off = 0;
            for (const c of initChunks) {
              merged.set(new Uint8Array(c), off);
              off += c.byteLength;
            }
            callbacks.onSuccess(
              { url: context.url, data: merged.buffer },
              makeStats(total, total, now),
              context,
              null,
            );
          } else {
            // Segmento normal: garante que o resto do buffer agregado sai
            // antes do onSuccess final (dados já entregues via onProgress)
            flushPending(now);
            callbacks.onSuccess(
              { url: context.url, data: new ArrayBuffer(0) },
              makeStats(bytesTotal, bytesTotal, now),
              context,
              null,
            );
          }
        },

        onError: (e: Error) => {
          clearTimer();
          callbacks.onError({ code: 0, text: e.message }, context, null);
        },
      });

      // FIX: reprodução offline — em vez de um fetch() de rede, os bytes
      // cifrados (mesmo formato "chunk-v2") vêm do IndexedDB local (ver
      // lib/downloads.ts). O resto do pipeline (worker de decifra ChaCha20,
      // callbacks do hls.js) é exactamente o mesmo do streaming ao vivo —
      // só a origem dos bytes muda. Mantido tal como estava: continua a
      // alimentar o worker por mensagens (seg_start/seg_bytes/seg_end),
      // porque aqui não há fetch nenhum a mover para dentro do worker.
      if (offlineContentId) {
        worker.postMessage({ type: 'seg_start', segId, keyHex });
        (async () => {
          try {
            const idbUrl = new URL(context.url);
            const isInitReq = idbUrl.pathname.endsWith('/init.bin');
            const segIndex  = isInitReq ? -1 : parseInt(idbUrl.searchParams.get('i') || '-1', 10);

            const { getInitSegment, getSegment } = await import('@/lib/downloads');
            const buf = isInitReq
              ? await getInitSegment(offlineContentId)
              : await getSegment(offlineContentId, segIndex);

            if (!buf) {
              _handlers.delete(segId);
              worker.postMessage({ type: 'seg_abort', segId });
              callbacks.onError({ code: 0, text: 'Segmento não encontrado offline' }, context, null);
              return;
            }
            worker.postMessage({ type: 'seg_bytes', segId, chunk: buf }, [buf]);
            worker.postMessage({ type: 'seg_end', segId });
          } catch (e: any) {
            _handlers.delete(segId);
            worker.postMessage({ type: 'seg_abort', segId });
            callbacks.onError({ code: 0, text: e?.message ?? 'erro offline' }, context, null);
          }
        })();
        return;
      }

      // Ramo de rede: só manda a URL e a chave — o worker faz o fetch e a
      // decriptação sozinho, sem o ciphertext ter de passar pelo main thread.
      worker.postMessage({ type: 'seg_fetch', segId, url: context.url, keyHex });
    }

    abort() {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
      if (this._segId) {
        try { getWorker().postMessage({ type: 'seg_abort', segId: this._segId }); } catch { /* worker já não existe */ }
      }
      super.abort?.();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Playlist sintética para reprodução offline
//
// Não há m3u8 real disponível offline (era servido pelo CDN ao vivo) — mas
// como o BinLoader intercepta qualquer pedido *.bin independentemente da
// origem, basta construir localmente uma playlist HLS/fMP4 mínima e válida,
// com URLs "idb://" que o loader (acima, ramo offlineContentId) resolve a
// partir do IndexedDB em vez de rede. Duração por segmento é uma estimativa
// (não gravámos a duração real de cada segmento no download) — o hls.js e o
// MSE corrigem a duração real assim que os segmentos fMP4 são decodificados.
// ─────────────────────────────────────────────────────────────────────────────

const OFFLINE_SEG_DURATION = 6; // segundos — mesma ordem de grandeza do pipeline (process.yml)

function buildOfflinePlaylist(contentId: string, segCount: number): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    `#EXT-X-TARGETDURATION:${OFFLINE_SEG_DURATION}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    `#EXT-X-MAP:URI="idb://${contentId}/init.bin"`,
  ];
  for (let i = 0; i < segCount; i++) {
    lines.push(`#EXTINF:${OFFLINE_SEG_DURATION.toFixed(3)},`);
    lines.push(`idb://${contentId}/seg.bin?i=${i}`);
  }
  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Props & Component (inalterado)
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  streamApiUrl?:        string;
  token?:                string;
  // FIX: reprodução offline de conteúdo descarregado — quando presente,
  // ignora streamApiUrl/ECDH por completo e lê tudo do IndexedDB local
  // (ver lib/downloads.ts). keyHex é a mesma chave ChaCha20 devolvida por
  // /api/content/:id/download (drm_key_hex), gravada no momento do download.
  offlinePlayback?:     { contentId: string; keyHex: string; segCount: number };
  poster?:              string;
  startTime?:           number;
  onTimeUpdate?:        (current: number, duration: number) => void;
  onEnded?:             () => void;
  onNextEpisode?:       () => void;
  onClose?:             () => void;
  onFreeTimeExhausted?: (plans: any[], message?: string) => void;
  onSessionReplaced?:   (message: string) => void;
  autoPlay?:            boolean;
}

// Controlo mínimo exposto ao consumidor (watch/[id]/page.tsx) pra
// pausar/retomar sem tocar em nada da lógica interna do player (ECDH/HLS.js).
export interface ShakaPlayerHandle {
  pause: () => void;
  play:  () => void;
}

const ShakaPlayer = forwardRef<ShakaPlayerHandle, Props>(function ShakaPlayer({
  streamApiUrl,
  token,
  offlinePlayback,
  poster,
  startTime = 0,
  onTimeUpdate,
  onEnded,
  onNextEpisode,
  onFreeTimeExhausted,
  onSessionReplaced,
  autoPlay = true,
}: Props, ref) {
  const { t } = useTranslation();

  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef       = useRef<any>(null);
  const timerRef     = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);
  const lastInitKey  = useRef('');
  const nextBtnRef   = useRef<HTMLButtonElement>(null);
  const visHandlerRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    pause: () => videoRef.current?.pause(),
    play:  () => { videoRef.current?.play().catch(() => {}); },
  }), []);

  const [buffered,   setBuffered]   = useState(0);
  const [quality,    setQuality]    = useState('');
  const [autoNextIn, setAutoNextIn] = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  // FIX (navegação no player): sem isto, o <video> nunca recebia foco
  // depois de pronto, e as teclas ←→/↑↓/Espaço/F (que o motor antigo já
  // cede correctamente ao browser nativo quando o <video> TEM foco —
  // ver comentário FIX 2 em tv-navigation.ts) nunca lhe chegavam; ficavam
  // a navegar o resto da página em vez de dar seek/volume/pausa.
  useEffect(() => {
    if (!loading && shouldAutoFocus()) {
      requestAnimationFrame(() => videoRef.current?.focus({ preventScroll: true }));
    }
  }, [loading]);

  // FIX (loop de reset do player): onFreeTimeExhausted é uma prop função.
  // O consumidor (watch/[id]/page.tsx) precisa de re-renderizar a cada
  // timeupdate (pra gravar o progresso), e nesses renders passa
  // um novo `() => ...` inline — nova identidade a cada render. Como init()
  // e sendHeartbeat() tinham onFreeTimeExhausted nas deps, isso recriava
  // init a cada render, o que re-disparava o useEffect de montagem
  // (init/destroyHls) e destruía+recriava o HLS repetidamente (spinner +
  // attachMediaError em loop). Guardamos a versão mais recente num ref, sem
  // ela entrar em nenhuma dependência de useCallback.
  const onFreeTimeExhaustedRef = useRef(onFreeTimeExhausted);
  useEffect(() => { onFreeTimeExhaustedRef.current = onFreeTimeExhausted; }, [onFreeTimeExhausted]);
  const onSessionReplacedRef = useRef(onSessionReplaced);
  useEffect(() => { onSessionReplacedRef.current = onSessionReplaced; }, [onSessionReplaced]);

  const heartbeatUrl = streamApiUrl ? streamApiUrl.replace(/\/stream(\?.*)?$/, '/heartbeat') : '';

  const sendHeartbeat = useCallback(async () => {
    // Conteúdo offline já foi pago/descarregado — sem limite de tempo grátis
    // a controlar aqui, e sem rede para bater no endpoint de qualquer forma.
    if (offlinePlayback || !heartbeatUrl || !token) return;
    const v = videoRef.current;
    if (!v || v.paused || v.ended) return;
    try {
      const fp  = await getDeviceFingerprint();
      const res = await fetch(heartbeatUrl, {
        method: 'POST',
        // FIX: credentials 'include' — necessário para o cookie pv_did
        // (device-id) atravessar o subdomínio da API.
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(fp ? { 'X-Device-Fp': fp } : {}),
        },
        body: JSON.stringify({ position: Math.floor(v.currentTime) }),
      });
      if (res.status === 409) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        const body = await res.json().catch(() => ({}));
        v.pause();
        onSessionReplacedRef.current?.(body?.message || 'A sua sessão foi encerrada neste dispositivo.');
        return;
      }
      if (res.status === 429) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        const body = await res.json().catch(() => ({}));
        v.pause();
        onFreeTimeExhaustedRef.current?.(body?.plans ?? [], body?.message);
      }
      const rem = res.headers.get('X-Free-Time-Remaining-Seconds');
      if (rem) v.dispatchEvent(new CustomEvent('freetimeupdate', { detail: { remainingSeconds: +rem }, bubbles: true }));
    } catch { /* rede */ }
  }, [heartbeatUrl, token, offlinePlayback]);

  // FIX (CPU-ms/carga em KV no backend): intervalo passou de 30s pra 120s —
  // 1/4 das chamadas por sessão. HEARTBEAT_INTERVAL_MS no backend
  // (middleware/rate-limit.js) TEM de usar o mesmo valor, porque o contador
  // é "flat accounting" (cada heartbeat credita um bloco fixo, não um delta
  // medido) — dessincronizar os dois faria o utilizador free ganhar ou
  // perder tempo real de quota.
  //
  // Trade-off aceite conscientemente: fechar a aba no meio de um intervalo
  // agora pode deixar até 120s (antes 30s) de visualização não
  // contabilizados nesse dia — sempre a favor do utilizador, nunca contra.
  // Um flush no unload via sendBeacon resolveria isso, mas exigiria o
  // backend aceitar o token por querystring nessa rota (não aceita hoje) —
  // fora do escopo desta mudança; left as future improvement se decidirem
  // que vale a pena.
  const HEARTBEAT_MS = 120_000;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on  = () => { if (heartbeatRef.current) return; sendHeartbeat(); heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS); };
    const off = () => { clearInterval(heartbeatRef.current); heartbeatRef.current = null; };
    v.addEventListener('play',  on);
    v.addEventListener('pause', off);
    v.addEventListener('ended', off);
    return () => { v.removeEventListener('play', on); v.removeEventListener('pause', off); v.removeEventListener('ended', off); off(); };
  }, [sendHeartbeat]);

  // FIX (rede de segurança do intervalo maior, sem mexer no backend): com
  // heartbeat a 120s (era 30s), fechar a aba/trocar de app no meio de um
  // intervalo pode deixar até 120s de visualização não contabilizados nesse
  // dia — sempre a favor do utilizador, nunca contra, mas dá pra reduzir.
  // `navigator.sendBeacon` entrega mesmo com a página a fechar (um fetch
  // normal seria cancelado nesse momento) — mas não permite headers custom,
  // então não dá pra mandar o `Authorization: Bearer`. Confirmado que NÃO
  // precisa: middleware/auth.js (optionalAuth) já aceita autenticação por
  // COOKIE como alternativa ao header (pixgo_session / sessionId, usados no
  // SSO partilhado) — e a Beacon API manda cookies automaticamente por
  // spec (credentials 'include' é o default, ao contrário do fetch normal).
  // Ou seja: isto funciona com o backend tal como está, zero mudanças lá.
  // Se por algum motivo a sessão do utilizador não tiver nenhum desses
  // cookies (ex: fluxo de auth futuro só por header), o beacon simplesmente
  // falha silenciosamente — mesmo comportamento de não ter esta rede de
  // segurança, nunca pior que isso.
  useEffect(() => {
    const flush = () => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || !heartbeatUrl || offlinePlayback) return;
      try {
        const blob = new Blob([JSON.stringify({ position: Math.floor(v.currentTime) })], { type: 'application/json' });
        navigator.sendBeacon?.(heartbeatUrl, blob);
      } catch { /* best-effort, nunca bloquear o unload */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [heartbeatUrl, offlinePlayback]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
      e.preventDefault();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  const destroyHls = useCallback(() => {
    if (visHandlerRef.current && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
      visHandlerRef.current = null;
    }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, []);

  const init = useCallback(async () => {
    if (!videoRef.current) return;
    if (!offlinePlayback && (!streamApiUrl || !token)) return;

    const initKey = offlinePlayback
      ? `offline|${offlinePlayback.contentId}|${startTime}`
      : `${streamApiUrl}|${token}|${startTime}`;
    if (initKey === lastInitKey.current && hlsRef.current) return;
    lastInitKey.current = initKey;

    setQuality('');
    setLoading(true);
    destroyHls();

    try {
      // FIX: reprodução offline — sem handshake ECDH nenhum (não há rede),
      // usa directamente a chave gravada no download e uma playlist
      // construída localmente a apontar para o IndexedDB.
      const info = offlinePlayback
        ? {
            masterUrl: URL.createObjectURL(new Blob(
              [buildOfflinePlaylist(offlinePlayback.contentId, offlinePlayback.segCount)],
              { type: 'application/vnd.apple.mpegurl' },
            )),
            drmKeyHex: offlinePlayback.keyHex,
          }
        : await performECDH(streamApiUrl!, token!);

      if (!info.masterUrl) throw new Error('No stream URL');

      const Hls = (await import('hls.js')).default;

      if (!Hls.isSupported()) {
        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = info.masterUrl;
          setLoading(false);
          if (autoPlay) videoRef.current.play().catch(() => {});
          videoRef.current.focus();
        }
        return;
      }

      // Heurística simples de dispositivo fraco (RAM) — usada só para
      // reduzir alvo de buffer; se a API não existir, assume-se "normal".
      const lowRam = typeof navigator !== 'undefined'
        && (navigator as any).deviceMemory
        && (navigator as any).deviceMemory <= 2;

      const hls = new Hls({
        loader: info.drmKeyHex
          ? makeBinLoader(Hls, info.drmKeyHex, offlinePlayback?.contentId)
          : Hls.DefaultConfig.loader,
        startPosition: startTime || 0,
        progressive: true,
        // Deixa o browser gerir eviction do buffer sob pressão de memória
        // quando suportado (Safari iOS17+/Chrome recentes); faz fallback
        // automático e transparente para MediaSource normal caso contrário.
        preferManagedMediaSource: true,
        // FIX: estava 0 (sem timeout). No ramo de rede o timeout real é
        // tratado no BinLoader (fetch corre dentro do worker); isto mantém
        // o resto do pipeline hls.js consistente.
        fragLoadingTimeOut:     20_000,
        manifestLoadingTimeOut: 20_000,
        levelLoadingTimeOut:    20_000,
        fragLoadingMaxRetry:   4,
        fragLoadingRetryDelay: 500,
        maxBufferLength:    lowRam ? 20 : 60,
        maxMaxBufferLength: lowRam ? 30 : 120,
        // back-buffer grande só ajuda em pequenos recuos; 60s era exagero
        backBufferLength:   lowRam ? 10 : 30,
        enableWorker: true,
      });
      hlsRef.current = hls;

      // Buffer dinâmico por visibilidade da aba: em background (mobile
      // Chrome/Safari suspendem/descartam abas sob pressão de memória),
      // reduz o alvo de buffer para libertar RAM; restaura ao voltar a
      // primeiro plano. Complementa preferManagedMediaSource (ponto 3) —
      // aqui agimos por sinal explícito do browser, não só por eviction
      // reativa.
      const defaultMaxBuffer    = lowRam ? 20 : 60;
      const defaultMaxMaxBuffer = lowRam ? 30 : 120;
      const onVisibilityChange = () => {
        if (!hlsRef.current) return;
        if (document.hidden) {
          hlsRef.current.config.maxBufferLength    = 10;
          hlsRef.current.config.maxMaxBufferLength = 15;
        } else {
          hlsRef.current.config.maxBufferLength    = defaultMaxBuffer;
          hlsRef.current.config.maxMaxBufferLength = defaultMaxMaxBuffer;
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      visHandlerRef.current = onVisibilityChange;

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        setLoading(false);
        const lvl = data.levels?.[hls.currentLevel] ?? data.levels?.[0];
        if (lvl?.height) setQuality(`${lvl.height}p`);
        if (autoPlay) videoRef.current?.play().catch(() => {});
        setTimeout(() => videoRef.current?.focus(), 100);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
        const lvl = hls.levels?.[data.level];
        if (lvl?.height) setQuality(`${lvl.height}p`);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        const v = videoRef.current;
        if (!v || !v.buffered.length) return;
        setBuffered(Math.max(0, Math.round(v.buffered.end(v.buffered.length - 1) - v.currentTime)));
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR)    hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else { console.error('[hls.js] fatal:', data); setLoading(false); }
      });

      hls.loadSource(info.masterUrl);
      hls.attachMedia(videoRef.current);

    } catch (e: any) {
      setLoading(false);
      if (e?.status === 429) { lastInitKey.current = ''; onFreeTimeExhaustedRef.current?.(e.plans ?? [], e.message); }
      else console.error('[init]', e);
    }
  }, [streamApiUrl, token, offlinePlayback, startTime, autoPlay, destroyHls]);

  useEffect(() => {
    init();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      destroyHls();
      lastInitKey.current = '';
    };
  }, [init, destroyHls]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || startTime == null) return;
    if (Math.abs(v.currentTime - startTime) > 2) v.currentTime = startTime;
  }, [startTime]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => onTimeUpdate?.(v.currentTime, v.duration || 0);
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [onTimeUpdate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnd = () => {
      onEnded?.();
      if (!onNextEpisode) return;
      setAutoNextIn(5);
      let n = 5;
      timerRef.current = setInterval(() => {
        n--; setAutoNextIn(n);
        if (n <= 0) { clearInterval(timerRef.current); timerRef.current = null; setAutoNextIn(null); onNextEpisode(); }
      }, 1000);
    };
    v.addEventListener('ended', onEnd);
    return () => v.removeEventListener('ended', onEnd);
  }, [onEnded, onNextEpisode]);

  useEffect(() => {
    if (autoNextIn === 5) requestAnimationFrame(() => nextBtnRef.current?.focus());
  }, [autoNextIn]);

  return (
    <>
      <div
        ref={containerRef}
        data-tv-player
        style={{ position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: 'inherit', overflow: 'hidden' }}
      >
        <video
          ref={videoRef}
          poster={poster}
          playsInline
          controls
          tabIndex={0}
          data-tv-focusable
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v) return;
            switch (e.key) {
              case 'ArrowRight':
                v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
                e.preventDefault(); e.stopPropagation();
                break;
              case 'ArrowLeft':
                v.currentTime = Math.max(0, v.currentTime - 10);
                e.preventDefault(); e.stopPropagation();
                break;
              case 'ArrowUp':
                v.volume = Math.min(1, v.volume + 0.05);
                v.muted = false;
                e.preventDefault(); e.stopPropagation();
                break;
              case 'ArrowDown':
                v.volume = Math.max(0, v.volume - 0.05);
                e.preventDefault(); e.stopPropagation();
                break;
              case ' ':
              case 'Enter':
                if (v.paused) v.play().catch(() => {}); else v.pause();
                e.preventDefault(); e.stopPropagation();
                break;
              case 'm': case 'M':
                v.muted = !v.muted;
                e.preventDefault(); e.stopPropagation();
                break;
            }
          }}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', pointerEvents: 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--color-primary, #e50914)', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading && buffered > 3 && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-secondary)' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>+{buffered}s</span>
          </div>
        )}

        {quality && !loading && (
          <div style={{ display: 'none', position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
            <HdIcon style={{ fontSize: 14, color: 'var(--color-secondary)' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.8)' }}>{quality}</span>
          </div>
        )}

        {autoNextIn !== null && (
          <div style={{ position: 'absolute', bottom: 60, right: 16, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(229,9,20,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 20 }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>{t('player.autoNext')}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1 }}>{autoNextIn}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button ref={nextBtnRef} tabIndex={0} data-tv-focusable className="btn btn-primary btn-sm"
                onClick={() => { clearInterval(timerRef.current); timerRef.current = null; setAutoNextIn(null); onNextEpisode?.(); }}>
                <SkipNextIcon style={{ fontSize: 16 }} /> {t('player.nextEpisode')}
              </button>
              <button tabIndex={0} data-tv-focusable className="btn btn-ghost btn-sm"
                onClick={() => { clearInterval(timerRef.current); timerRef.current = null; setAutoNextIn(null); videoRef.current?.focus(); }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`.tv-mode .shaka-tv-hint{display:flex!important}.shaka-tv-hint{display:none}`}</style>
      <div className="shaka-tv-hint" style={{ justifyContent: 'center', gap: 20, padding: '6px 16px', background: 'rgba(0,0,0,0.5)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', borderRadius: '0 0 inherit inherit' }}>
        <span>←→ Seek</span><span>↑↓ Volume</span><span>Space Pausa</span><span>F Ecrã inteiro</span>
      </div>
    </>
  );
});

export default ShakaPlayer;