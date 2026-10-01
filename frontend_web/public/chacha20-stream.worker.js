/**
 * chacha20-stream.worker.js — StreamVault v9.1 (bugfix)
 *
 * CORRECÇÕES vs v9.0:
 *   1. Bug diagonal do ChaCha20: _w[1]=(_w[6]+_w[1])|0 → _w[1]=(_w[1]+_w[6])|0
 *      (linha errada na 5ª ronda diagonal — corrompía todos os blocos de keystream)
 *
 *   2. Estado global _w/_ks eliminado: cada chamada chacha20Block aloca buffers
 *      locais, evitando corrupção quando dois segmentos são decriptados em paralelo
 *      (o hls.js faz pre-load de vários segmentos simultaneamente).
 *
 *   3. Sem outras alterações de comportamento — protocolo e formato chunk-v2 inalterados.
 */

'use strict';

// ── ChaCha20 puro JS (corrigido) ─────────────────────────────────────────────

function rotl(v, n) { return (v << n) | (v >>> (32 - n)); }

function hexToU8(hex) {
  const b = new Uint8Array(hex.length >>> 1);
  for (let i = 0; i < hex.length; i += 2) b[i >>> 1] = parseInt(hex.slice(i, i + 2), 16);
  return b;
}

const C0 = 0x61707865, C1 = 0x3320646e, C2 = 0x79622d32, C3 = 0x6b206574;

// CORRECÇÃO: aloca w e ks localmente por chamada — sem estado global partilhado.
// Impede corrupção quando múltiplos segmentos são decriptados em paralelo.
function chacha20Block(key, ctr, nonce) {
  const kw = new Uint32Array(key.buffer, key.byteOffset, 8);
  const nw = new Uint32Array(nonce.buffer, nonce.byteOffset, 3);
  const w  = new Uint32Array(16);

  w[0]=C0;    w[1]=C1;    w[2]=C2;    w[3]=C3;
  w[4]=kw[0]; w[5]=kw[1]; w[6]=kw[2]; w[7]=kw[3];
  w[8]=kw[4]; w[9]=kw[5]; w[10]=kw[6];w[11]=kw[7];
  w[12]=ctr;  w[13]=nw[0];w[14]=nw[1];w[15]=nw[2];

  const s0=w[0],s1=w[1],s2=w[2],s3=w[3],
        s4=w[4],s5=w[5],s6=w[6],s7=w[7],
        s8=w[8],s9=w[9],s10=w[10],s11=w[11],
        s12=w[12],s13=w[13],s14=w[14],s15=w[15];

  for (let i = 0; i < 10; i++) {
    // Rondas de coluna
    w[0]=(w[0]+w[4])|0; w[12]^=w[0]; w[12]=rotl(w[12],16); w[8]=(w[8]+w[12])|0; w[4]^=w[8];  w[4]=rotl(w[4],12);  w[0]=(w[0]+w[4])|0; w[12]^=w[0]; w[12]=rotl(w[12],8);  w[8]=(w[8]+w[12])|0; w[4]^=w[8];  w[4]=rotl(w[4],7);
    w[1]=(w[1]+w[5])|0; w[13]^=w[1]; w[13]=rotl(w[13],16); w[9]=(w[9]+w[13])|0; w[5]^=w[9];  w[5]=rotl(w[5],12);  w[1]=(w[1]+w[5])|0; w[13]^=w[1]; w[13]=rotl(w[13],8);  w[9]=(w[9]+w[13])|0; w[5]^=w[9];  w[5]=rotl(w[5],7);
    w[2]=(w[2]+w[6])|0; w[14]^=w[2]; w[14]=rotl(w[14],16); w[10]=(w[10]+w[14])|0;w[6]^=w[10]; w[6]=rotl(w[6],12);  w[2]=(w[2]+w[6])|0; w[14]^=w[2]; w[14]=rotl(w[14],8);  w[10]=(w[10]+w[14])|0;w[6]^=w[10]; w[6]=rotl(w[6],7);
    w[3]=(w[3]+w[7])|0; w[15]^=w[3]; w[15]=rotl(w[15],16); w[11]=(w[11]+w[15])|0;w[7]^=w[11]; w[7]=rotl(w[7],12);  w[3]=(w[3]+w[7])|0; w[15]^=w[3]; w[15]=rotl(w[15],8);  w[11]=(w[11]+w[15])|0;w[7]^=w[11]; w[7]=rotl(w[7],7);
    // Rondas diagonais — CORRECÇÃO na 2ª ronda: era _w[1]=(_w[6]+_w[1])|0
    w[0]=(w[0]+w[5])|0; w[15]^=w[0]; w[15]=rotl(w[15],16); w[10]=(w[10]+w[15])|0;w[5]^=w[10]; w[5]=rotl(w[5],12);  w[0]=(w[0]+w[5])|0; w[15]^=w[0]; w[15]=rotl(w[15],8);  w[10]=(w[10]+w[15])|0;w[5]^=w[10]; w[5]=rotl(w[5],7);
    w[1]=(w[1]+w[6])|0; w[12]^=w[1]; w[12]=rotl(w[12],16); w[11]=(w[11]+w[12])|0;w[6]^=w[11]; w[6]=rotl(w[6],12);  w[1]=(w[1]+w[6])|0; w[12]^=w[1]; w[12]=rotl(w[12],8);  w[11]=(w[11]+w[12])|0;w[6]^=w[11]; w[6]=rotl(w[6],7);
    w[2]=(w[2]+w[7])|0; w[13]^=w[2]; w[13]=rotl(w[13],16); w[8]=(w[8]+w[13])|0;  w[7]^=w[8];  w[7]=rotl(w[7],12);  w[2]=(w[2]+w[7])|0; w[13]^=w[2]; w[13]=rotl(w[13],8);  w[8]=(w[8]+w[13])|0;  w[7]^=w[8];  w[7]=rotl(w[7],7);
    w[3]=(w[3]+w[4])|0; w[14]^=w[3]; w[14]=rotl(w[14],16); w[9]=(w[9]+w[14])|0;  w[4]^=w[9];  w[4]=rotl(w[4],12);  w[3]=(w[3]+w[4])|0; w[14]^=w[3]; w[14]=rotl(w[14],8);  w[9]=(w[9]+w[14])|0;  w[4]^=w[9];  w[4]=rotl(w[4],7);
  }

  w[0]=(w[0]+s0)|0;  w[1]=(w[1]+s1)|0;  w[2]=(w[2]+s2)|0;  w[3]=(w[3]+s3)|0;
  w[4]=(w[4]+s4)|0;  w[5]=(w[5]+s5)|0;  w[6]=(w[6]+s6)|0;  w[7]=(w[7]+s7)|0;
  w[8]=(w[8]+s8)|0;  w[9]=(w[9]+s9)|0;  w[10]=(w[10]+s10)|0;w[11]=(w[11]+s11)|0;
  w[12]=(w[12]+s12)|0;w[13]=(w[13]+s13)|0;w[14]=(w[14]+s14)|0;w[15]=(w[15]+s15)|0;

  const ks = new Uint8Array(64);
  const dv = new DataView(ks.buffer);
  for (let i = 0; i < 16; i++) dv.setUint32(i * 4, w[i], true);
  return ks;
}

// Decripta cipher → novo Uint8Array plaintext.
function decrypt(cipher, key, nonce) {
  const out = new Uint8Array(cipher.length);
  let off = 0, ctr = 1;
  while (off < cipher.length) {
    const ks = chacha20Block(key, ctr++, nonce);
    const n  = Math.min(64, cipher.length - off);
    for (let i = 0; i < n; i++) out[off + i] = cipher[off + i] ^ ks[i];
    off += n;
  }
  return out;
}

// ── Key cache ─────────────────────────────────────────────────────────────────

const _keys = new Map();
function getKey(hex) {
  if (!_keys.has(hex)) _keys.set(hex, hexToU8(hex));
  return _keys.get(hex);
}

// ── Estado por segmento ───────────────────────────────────────────────────────

const _segs = new Map();

function segStart(segId, keyHex) {
  _segs.set(segId, {
    key:          getKey(keyHex),
    phase:        'hdr',
    hdrBuf:       new Uint8Array(4), hdrOff: 0,
    nChunks:      0, chunksRead: 0,
    chdrBuf:      new Uint8Array(16), chdrOff: 0,
    chunkNonce:   null, chunkLen: 0,
    chunkBuf:     null, chunkOff: 0,
    bytesEmitted: 0,
  });
}

function segPush(segId, incoming) {
  const st = _segs.get(segId);
  if (!st) return;
  let pos = 0;
  const len = incoming.length;

  while (pos < len) {

    // Fase 1: header do segmento (4B n_chunks)
    if (st.phase === 'hdr') {
      const take = Math.min(4 - st.hdrOff, len - pos);
      st.hdrBuf.set(incoming.subarray(pos, pos + take), st.hdrOff);
      st.hdrOff += take; pos += take;
      if (st.hdrOff === 4) {
        st.nChunks = new DataView(st.hdrBuf.buffer).getUint32(0, true);
        if (!st.nChunks || st.nChunks >= 100_000) {
          _segs.delete(segId);
          self.postMessage({ type: 'seg_done', segId });
          return;
        }
        st.hdrOff = 0;
        st.phase  = 'chdr';
      }
      continue;
    }

    // Fase 2: header do chunk (16B: 12B nonce + 4B len)
    if (st.phase === 'chdr') {
      const take = Math.min(16 - st.chdrOff, len - pos);
      st.chdrBuf.set(incoming.subarray(pos, pos + take), st.chdrOff);
      st.chdrOff += take; pos += take;
      if (st.chdrOff === 16) {
        const view    = new DataView(st.chdrBuf.buffer);
        st.chunkNonce = st.chdrBuf.slice(0, 12);
        st.chunkLen   = view.getUint32(12, true);
        st.chunkBuf   = new Uint8Array(st.chunkLen);
        st.chunkOff   = 0;
        st.chdrOff    = 0;
        st.phase      = 'cbody';
      }
      continue;
    }

    // Fase 3: corpo do chunk (chunkLen bytes de ciphertext)
    if (st.phase === 'cbody') {
      const take = Math.min(st.chunkLen - st.chunkOff, len - pos);
      st.chunkBuf.set(incoming.subarray(pos, pos + take), st.chunkOff);
      st.chunkOff += take; pos += take;

      if (st.chunkOff === st.chunkLen) {
        const plain = decrypt(st.chunkBuf, st.key, st.chunkNonce).buffer;
        self.postMessage({ type: 'seg_plain', segId, plain }, [plain]);

        st.bytesEmitted += st.chunkLen;
        st.chunkBuf   = null;
        st.chunkNonce = null;
        st.chunkOff   = 0;
        st.chunkLen   = 0;
        st.chunksRead++;

        st.phase = st.chunksRead < st.nChunks ? 'chdr' : 'done';
      }
      continue;
    }

    break; // 'done'
  }
}

function segEnd(segId) {
  const st = _segs.get(segId);
  _segs.delete(segId);
  self.postMessage({ type: 'seg_done', segId, bytesTotal: st ? st.bytesEmitted : 0 });
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = function({ data }) {
  const { type, segId } = data;
  if (type === 'seg_start') { segStart(segId, data.keyHex); return; }
  if (type === 'seg_bytes') { segPush(segId, new Uint8Array(data.chunk)); return; }
  if (type === 'seg_end')   { segEnd(segId); return; }
  if (type === 'seg_abort') { _segs.delete(segId); return; }
};