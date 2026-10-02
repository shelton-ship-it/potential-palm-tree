// lib/downloads-resume.ts
// ── Retoma automática de downloads interrompidos ─────────────────────────────
//
// FIX: se a página for atualizada (ou fechada) a meio de um download, o
// ciclo de fetch por segmento (startDownload, em lib/downloads.ts) é
// destruído com o resto do contexto JS — os segmentos já gravados no
// IndexedDB não se perdem, mas ninguém continua o trabalho. Isto corre uma
// vez quando a app arranca autenticada (ver app/main/layout.tsx): procura
// downloads com status 'downloading' ou 'error', pede um manifesto fresco
// (as URLs assinadas dos segmentos podem ter expirado entretanto) e chama
// startDownload() outra vez — que salta automaticamente os segmentos já
// gravados e continua exatamente de onde ficou.

import { authedFetch } from '@/store/auth';
import { listActiveDownloads, startDownload } from './downloads';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';

let resuming = false;

export async function resumeInterruptedDownloads(): Promise<void> {
  if (resuming) return; // já em curso — evita disparos duplicados (ex.: StrictMode)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // sem rede, nada a fazer agora

  resuming = true;
  try {
    const pending = await listActiveDownloads();

    for (const d of pending) {
      try {
        const res = await authedFetch(`${API_BASE}/api/content/${d.contentId}/download`);
        if (!res.ok) continue;
        const data = await res.json();

        await startDownload(
          d.contentId,
          data.content?.title  ?? d.title,
          data.content?.poster ?? d.poster,
          data.license,
          data.expires_at,
          {
            segUrls:      data.manifest.segUrls,
            noncesUrl:    data.manifest.noncesUrl,
            initUrl:      data.manifest.initUrl,
            quality:      data.manifest.quality ?? data.manifest.segExt ?? d.quality ?? '',
            segmentCount: data.manifest.segmentCount,
          },
          () => {}, // o progresso já fica persistido dentro do próprio startDownload;
                    // a página de Downloads lê-o via polling ao IndexedDB.
          data.drm_key_hex,
        );
      } catch {
        // Este título específico falhou a retomar (rede, manifesto expirado
        // sem renovação possível, etc.) — segue para os restantes. O
        // utilizador pode sempre tentar de novo a partir da página de
        // Downloads (botão "Repetir" nos itens com erro).
      }
    }
  } finally {
    resuming = false;
  }
}
