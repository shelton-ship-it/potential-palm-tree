// lib/downloads.ts — utilitários de download offline
// Exportado por ContentPage e DownloadsPage — não é uma page Next.js.

// ── IndexedDB ─────────────────────────────────────────────────────────────────

const DB_NAME    = 'pixgo-offline';
const DB_VERSION = 2; // FIX: bump 1→2 para forçar onupgradeneeded em browsers que já ficaram com a BD criada sem object stores (ver AppShell.tsx)
const STORE_META = 'download-meta';
const STORE_SEGS = 'download-segments';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_META))
        db.createObjectStore(STORE_META, { keyPath: 'contentId' });
      if (!db.objectStoreNames.contains(STORE_SEGS))
        db.createObjectStore(STORE_SEGS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    // FIX: sem isto, uma conexão antiga (outra aba, ou uma conexão nossa
    // nunca fechada) bloqueia este open() em silêncio — a promise nunca
    // resolve nem rejeita, e o download fica pendurado pra sempre em
    // "0%", independente da rede. Falha explícita em vez de ficar preso.
    req.onblocked = () => reject(new Error('Base de dados offline bloqueada — feche outras abas do site e tente novamente.'));
  });
}

// FIX: passa a distinguir downloads concluídos ('completed', com expiresAt
// válido) dos que ainda estão a decorrer ou falharam ('downloading'/'error').
// Por omissão devolve só os concluídos (comportamento que a página de
// Downloads já tinha); includeAll=true devolve tudo, usado por
// listActiveDownloads() e pelo resumidor automático.
export async function listDownloads(includeAll = false): Promise<any[]> {
  const db = await openDB();
  const all: any[] = await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).getAll();
    let result: any[] = [];
    req.onsuccess = () => { result = req.result || []; };
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
  if (includeAll) return all;
  return all.filter(d => (d.status ?? 'completed') === 'completed');
}

export async function deleteDownload(contentId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).delete(contentId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE_SEGS, 'readwrite');
    const store = tx.objectStore(STORE_SEGS);
    const range = IDBKeyRange.bound(`${contentId}_`, `${contentId}_\uffff`);
    const req   = store.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function getDownloadMeta(contentId: string): Promise<any | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(contentId);
    let result: any = null;
    req.onsuccess = () => { result = req.result || null; };
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function saveDownloadMeta(meta: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function saveSegment(contentId: string, index: number, data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SEGS, 'readwrite');
    tx.objectStore(STORE_SEGS).put(data, `${contentId}_${index}`);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function getSegment(contentId: string, index: number): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_SEGS, 'readonly');
    const req = tx.objectStore(STORE_SEGS).get(`${contentId}_${index}`);
    let result: ArrayBuffer | null = null;
    req.onsuccess = () => { result = req.result || null; };
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

// FIX: o segmento de inicialização fMP4 (init.bin — moov/ftyp) nunca era
// descarregado. Sem ele o MSE não consegue abrir o SourceBuffer, por mais
// segmentos numerados que existam localmente — guarda-se à parte, com uma
// chave fixa (`${contentId}_init`) em vez de um índice numérico.
export async function saveInitSegment(contentId: string, data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SEGS, 'readwrite');
    tx.objectStore(STORE_SEGS).put(data, `${contentId}_init`);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function getInitSegment(contentId: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_SEGS, 'readonly');
    const req = tx.objectStore(STORE_SEGS).get(`${contentId}_init`);
    let result: ArrayBuffer | null = null;
    req.onsuccess = () => { result = req.result || null; };
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

// ── Cancelamento ─────────────────────────────────────────────────────────────
// Sinalização simples por contentId — quem inicia o download (watch/content
// page) e quem cancela (página de Downloads) podem ser componentes
// diferentes, por isso isto vive aqui e não em estado de componente.
const cancelledDownloads = new Set<string>();

export function cancelDownload(contentId: string) {
  cancelledDownloads.add(contentId);
}

export class DownloadCancelledError extends Error {
  constructor() { super('Download cancelado'); this.name = 'DownloadCancelledError'; }
}

async function clearPartialSegments(contentId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve) => {
    const tx    = db.transaction(STORE_SEGS, 'readwrite');
    const store = tx.objectStore(STORE_SEGS);
    const range = IDBKeyRange.bound(`${contentId}_`, `${contentId}_\uffff`);
    const req   = store.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    req.onerror   = () => {};
    // best-effort — se falhar a limpar, não bloqueia o cancelamento em si
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); resolve(); };
  });
}

// ── Progresso persistido ─────────────────────────────────────────────────────
// FIX: o progresso "em curso" só vivia num store Zustand em memória — ao
// atualizar a página (ou noutro separador), desaparecia por completo e a
// página de Downloads nunca mostrava nada enquanto o download decorria.
// Agora cada segmento gravado também actualiza um registo persistido em
// STORE_META com status 'downloading', para a página de Downloads o poder
// ler a qualquer momento (mesmo depois de um refresh) via listActiveDownloads().

export interface ActiveDownloadMeta {
  contentId: string;
  title:     string;
  poster:    string;
  status:    'downloading' | 'error';
  progress:  number; // 0-100
  segCount:  number;
  quality?:  string;
  error?:    string;
  startedAt: string;
}

function countSavedSegments(contentId: string, total: number): Promise<number> {
  return new Promise((resolve) => {
    openDB().then(db => {
      const tx    = db.transaction(STORE_SEGS, 'readonly');
      const store = tx.objectStore(STORE_SEGS);
      const range = IDBKeyRange.bound(`${contentId}_`, `${contentId}_\uffff`);
      const req   = store.count(range);
      req.onsuccess = () => { db.close(); resolve(Math.min(req.result || 0, total)); };
      req.onerror   = () => { db.close(); resolve(0); };
    }).catch(() => resolve(0));
  });
}

export async function listActiveDownloads(): Promise<ActiveDownloadMeta[]> {
  const all = await listDownloads(true);
  return all.filter((d: any) => d.status === 'downloading' || d.status === 'error');
}

// ── Armazenamento persistente ────────────────────────────────────────────────
// Sem isto, o browser (sobretudo em TV boxes com pouco espaço — Android
// TV/Google TV/Fire TV via TWA) pode limpar o IndexedDB dos downloads sob
// pressão de armazenamento, mesmo sem o utilizador apagar nada. Pedido
// best-effort: a API é padrão e não lança excepção em browsers que a
// suportam, mas mesmo assim fica em try/catch e feature-detect — se falhar
// ou não existir (ex.: motor mais antigo do Tizen/webOS), a descarga
// continua normalmente, só sem esta proteção extra.
let _persistRequested = false;
export function requestPersistentStorage(): void {
  if (_persistRequested) return;
  _persistRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch {
    // silencioso — nunca deve impedir o download em si
  }
}

// ── startDownload ─────────────────────────────────────────────────────────────
// Retomável: se já existirem segmentos gravados para este contentId (de uma
// tentativa anterior interrompida por refresh/fecho da página), a descarga
// continua a partir do primeiro segmento em falta em vez de recomeçar do
// zero — o utilizador só vê o progresso continuar, nunca reiniciar.

export async function startDownload(
  contentId:  string,
  title:      string,
  poster:     string,
  license:    string,
  expiresAt:  string,
  manifest:   { segUrls: string[]; noncesUrl: string; initUrl?: string; quality: string; segmentCount: number },
  onProgress: (pct: number) => void,
  keyHex?:    string | null,
): Promise<void> {
  requestPersistentStorage(); // best-effort, nunca bloqueia a descarga (ver função abaixo)

  const total = manifest.segUrls.length;
  if (total === 0) throw new Error('No segments to download');

  const startIndex = await countSavedSegments(contentId, total);

  const persistProgress = (pct: number, status: ActiveDownloadMeta['status'] = 'downloading', error?: string) =>
    saveDownloadMeta({
      contentId, title, poster, status, progress: pct, segCount: total,
      quality: manifest.quality, error, startedAt: new Date().toISOString(),
    } as ActiveDownloadMeta).catch(() => {});

  await persistProgress(Math.round((startIndex / total) * 100));
  onProgress(Math.round((startIndex / total) * 100));

  // FIX: descarrega também o init.bin (moov/ftyp), sem o qual o MSE nunca
  // consegue reproduzir os segmentos offline — só o faz uma vez (se já
  // estiver gravado, salta, tal como os segmentos numerados).
  if (manifest.initUrl && !(await getInitSegment(contentId))) {
    try {
      const initRes = await fetch(manifest.initUrl);
      if (initRes.ok) await saveInitSegment(contentId, await initRes.arrayBuffer());
    } catch { /* não bloqueia a descarga dos segmentos — sem isto a reprodução
                 offline falha, mas fica sinalizado no meta abaixo */ }
  }

  let nonces: Record<string, string> = {};
  try {
    const nr = await fetch(manifest.noncesUrl);
    if (nr.ok) { const nd = await nr.json(); nonces = nd.nonces || nd; }
  } catch { /* non-fatal */ }

  try {
    for (let i = startIndex; i < total; i++) {
      if (cancelledDownloads.has(contentId)) {
        cancelledDownloads.delete(contentId);
        await deleteDownload(contentId);
        throw new DownloadCancelledError();
      }
      const res = await fetch(manifest.segUrls[i]);
      if (!res.ok) throw new Error(`Segment ${i} fetch failed: ${res.status}`);
      const buf = await res.arrayBuffer();
      await saveSegment(contentId, i, buf);
      const pct = Math.round(((i + 1) / total) * 100);
      await persistProgress(pct);
      onProgress(pct);
    }
  } catch (e) {
    if (e instanceof DownloadCancelledError) throw e;
    // Mantém os segmentos já gravados (não apaga) — uma nova chamada a
    // startDownload() para o mesmo contentId retoma daqui, em vez de
    // perder o que já foi descarregado.
    await persistProgress(Math.round((startIndex / total) * 100), 'error', (e as Error)?.message ?? 'Erro desconhecido');
    throw e;
  }

  // Checagem final — se o cancelamento chegou depois do último segmento mas
  // antes de gravarmos os metadados, não deixa o download "completar" (senão
  // apareceria como concluído mesmo tendo sido cancelado no último instante).
  if (cancelledDownloads.has(contentId)) {
    cancelledDownloads.delete(contentId);
    await deleteDownload(contentId);
    throw new DownloadCancelledError();
  }

  await saveDownloadMeta({
    contentId, title, poster, license, expiresAt, status: 'completed',
    quality: manifest.quality, segCount: total, nonces, keyHex: keyHex || null,
    hasInit: !!(await getInitSegment(contentId)),
    noncesUrl: manifest.noncesUrl, downloadedAt: new Date().toISOString(),
  });
}