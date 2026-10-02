/**
 * decrypt.worker.ts — StreamVault
 *
 * Worker de decriptação ChaCha20 (RFC 8439) para segmentos .bin do player.
 * Substitui a versão anterior (string embutida num Blob) por um ficheiro
 * real, compilado pelo webpack do Next.js — permite usar uma dependência
 * npm de verdade (@noble/ciphers) em vez de código hand-rolled ou de um
 * bundle minificado colado manualmente numa string.
 *
 * Suporta DOIS protocolos, para os dois caminhos de dados do player:
 *
 *   1. seg_fetch (streaming ao vivo)
 *      O próprio worker faz o fetch() da rede e decripta progressivamente —
 *      o ciphertext nunca passa pela main thread.
 *
 *   2. seg_start / seg_bytes / seg_end (reprodução offline via IndexedDB)
 *      A main thread lê os bytes do IndexedDB (ver lib/downloads.ts) e
 *      alimenta o worker por mensagens, porque aqui não há fetch nenhum
 *      a fazer — os dados já estão localmente no dispositivo.
 *
 * Formato do segmento cifrado ("chunk-v2"), igual para ambos os caminhos:
 *   [4 bytes LE: nChunks]
 *   por chunk: [12 bytes nonce][4 bytes LE: length][body cifrado]
 */
/// <reference lib="webworker" />

import { chacha20 } from '@noble/ciphers/chacha.js';

export {}; // garante que este ficheiro é tratado como módulo

declare const self: DedicatedWorkerGlobalScope;

function hexToU8(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length >>> 1);
  for (let i = 0; i < hex.length; i += 2) b[i >>> 1] = parseInt(hex.slice(i, i + 2), 16);
  return b;
}

// Decripta um chunk completo. Contador inicial = 1 — convenção do protocolo
// original, mantida para compatibilidade com o backend/ferramenta de cifra
// (validado bit-a-bit contra a implementação anterior antes desta troca).
function decrypt(cipher: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return chacha20(key, nonce, cipher, undefined, 1);
}

const _keys = new Map<string, Uint8Array>();
function getKey(hex: string): Uint8Array {
  let k = _keys.get(hex);
  if (!k) { k = hexToU8(hex); _keys.set(hex, k); }
  return k;
}

type SegState = {
  key: Uint8Array;
  phase: 'hdr' | 'chdr' | 'cbody' | 'done';
  hdrBuf: Uint8Array; hdrOff: number;
  nChunks: number; chunksRead: number;
  chdrBuf: Uint8Array; chdrOff: number;
  chunkNonce: Uint8Array | null;
  chunkLen: number;
  chunkBuf: Uint8Array | null;
  chunkOff: number;
  bytesEmitted: number;
};

const _segs = new Map<string, SegState>();

function segStart(segId: string, keyHex: string) {
  _segs.set(segId, {
    key: getKey(keyHex),
    phase: 'hdr',
    hdrBuf: new Uint8Array(4), hdrOff: 0,
    nChunks: 0, chunksRead: 0,
    chdrBuf: new Uint8Array(16), chdrOff: 0,
    chunkNonce: null, chunkLen: 0,
    chunkBuf: null, chunkOff: 0,
    bytesEmitted: 0,
  });
}

function segPush(segId: string, incoming: Uint8Array) {
  const st = _segs.get(segId);
  if (!st) return;
  let pos = 0;
  const len = incoming.length;

  while (pos < len) {
    if (st.phase === 'hdr') {
      const take = Math.min(4 - st.hdrOff, len - pos);
      st.hdrBuf.set(incoming.subarray(pos, pos + take), st.hdrOff);
      st.hdrOff += take; pos += take;
      if (st.hdrOff === 4) {
        st.nChunks = new DataView(st.hdrBuf.buffer).getUint32(0, true);
        if (!st.nChunks || st.nChunks >= 100000) {
          _segs.delete(segId);
          self.postMessage({ type: 'seg_done', segId });
          return;
        }
        st.hdrOff = 0;
        st.phase = 'chdr';
      }
      continue;
    }
    if (st.phase === 'chdr') {
      const take = Math.min(16 - st.chdrOff, len - pos);
      st.chdrBuf.set(incoming.subarray(pos, pos + take), st.chdrOff);
      st.chdrOff += take; pos += take;
      if (st.chdrOff === 16) {
        const view = new DataView(st.chdrBuf.buffer);
        st.chunkNonce = st.chdrBuf.slice(0, 12);
        st.chunkLen = view.getUint32(12, true);
        st.chunkBuf = new Uint8Array(st.chunkLen);
        st.chunkOff = 0;
        st.chdrOff = 0;
        st.phase = 'cbody';
      }
      continue;
    }
    if (st.phase === 'cbody') {
      const take = Math.min(st.chunkLen - st.chunkOff, len - pos);
      st.chunkBuf!.set(incoming.subarray(pos, pos + take), st.chunkOff);
      st.chunkOff += take; pos += take;
      if (st.chunkOff === st.chunkLen) {
        const plain = decrypt(st.chunkBuf!, st.key, st.chunkNonce!).buffer;
        self.postMessage({ type: 'seg_plain', segId, plain }, [plain] as any);
        st.bytesEmitted += st.chunkLen;
        st.chunkBuf = null; st.chunkNonce = null; st.chunkOff = 0; st.chunkLen = 0;
        st.chunksRead++;
        st.phase = st.chunksRead < st.nChunks ? 'chdr' : 'done';
      }
      continue;
    }
    break;
  }
}

function segEnd(segId: string) {
  const st = _segs.get(segId);
  _segs.delete(segId);
  self.postMessage({ type: 'seg_done', segId, bytesTotal: st ? st.bytesEmitted : 0 });
}

// Fetch feito diretamente dentro do worker (só para segmentos de REDE):
// elimina o hop extra de postMessage do ciphertext — a main thread já não
// faz fetch nenhum para .bin ao vivo, só manda a URL e a chave.
const _fetchCtrls = new Map<string, AbortController>();

async function segFetch(segId: string, url: string, keyHex: string) {
  segStart(segId, keyHex);
  const ctrl = new AbortController();
  _fetchCtrls.set(segId, ctrl);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/octet-stream' },
    });
    if (!res.ok) {
      _fetchCtrls.delete(segId);
      _segs.delete(segId);
      self.postMessage({ type: 'seg_error', segId, code: res.status, message: res.statusText });
      return;
    }
    const reader = res.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      segPush(segId, value);
    }
    _fetchCtrls.delete(segId);
    segEnd(segId);
  } catch (e: any) {
    _fetchCtrls.delete(segId);
    if (e && e.name === 'AbortError') { _segs.delete(segId); return; }
    _segs.delete(segId);
    self.postMessage({ type: 'seg_error', segId, code: 0, message: (e && e.message) || 'fetch error' });
  }
}

self.onmessage = (ev: MessageEvent) => {
  const { type, segId } = ev.data;
  if (type === 'seg_fetch') { segFetch(segId, ev.data.url, ev.data.keyHex); return; }
  if (type === 'seg_start') { segStart(segId, ev.data.keyHex); return; }
  if (type === 'seg_bytes') { segPush(segId, new Uint8Array(ev.data.chunk)); return; }
  if (type === 'seg_end')   { segEnd(segId); return; }
  if (type === 'seg_abort') {
    const c = _fetchCtrls.get(segId);
    if (c) c.abort();
    _fetchCtrls.delete(segId);
    _segs.delete(segId);
    return;
  }
};
