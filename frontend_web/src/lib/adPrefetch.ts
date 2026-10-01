// lib/adPrefetch.ts
//
// Cache de pré-carregamento do anúncio VAST de pre-roll, partilhado entre
// quem DISPARA o prefetch (ex: app/main/content/[id]/page.tsx, assim que o
// utilizador abre a página do título — antes de sequer clicar em "Assistir")
// e quem CONSOME (AdPrerollGate.tsx, quando o player efectivamente monta).
//
// Objectivo: eliminar o delay do "checking" (spinner antes do vídeo) — se o
// utilizador passou uns segundos na página do conteúdo antes de dar play, o
// anúncio já está pronto quando o player aparece.
//
// TTL curto de propósito: um VAST ad tem validade curta (a media URL/pod
// devolvido pode deixar de ser válido depois de alguns minutos, dependendo
// do provedor). Se o prefetch estiver "velho" demais, é descartado e quem
// consome faz um fetch normal — nunca arriscamos mostrar um anúncio
// expirado (isso só resultaria num erro silencioso e no fallback pro
// conteúdo, que já existe, mas é desperdício de uma oportunidade de ad).

import { adsApi } from './api';
import { fetchVastAd, type VastAd } from './vast';

const PREROLL_PREFETCH_TTL_MS = 3 * 60 * 1000; // 3 min

interface CachedPreroll {
  promise:   Promise<VastAd | null>;
  fetchedAt: number;
}

let prerollCache: CachedPreroll | null = null;

/**
 * Dispara o fetch do pre-roll em background, se ainda não houver um
 * prefetch fresco em curso. Idempotente — chamar várias vezes (ex: em cada
 * render da página de conteúdo) não refaz o pedido enquanto o cache actual
 * ainda estiver dentro do TTL.
 */
export function prefetchPrerollAd(): void {
  if (typeof window === 'undefined') return; // nunca em SSR
  if (prerollCache && (Date.now() - prerollCache.fetchedAt) < PREROLL_PREFETCH_TTL_MS) return;

  const fetchedAt = Date.now();
  const promise = (async (): Promise<VastAd | null> => {
    try {
      const ctx = await adsApi.status();
      const vastUrl = ctx?.network?.vast_preroll_url || ctx?.network?.vast_url;
      const supportsPreroll = Array.isArray(ctx?.formats) && ctx.formats.includes('pre-roll');
      if (!ctx?.show_ads || !vastUrl || !supportsPreroll) return null;
      return await fetchVastAd(vastUrl);
    } catch {
      return null;
    }
  })();

  prerollCache = { promise, fetchedAt };
}

/**
 * Consome o pre-roll pré-carregado, se ainda estiver fresco. Devolve `null`
 * se não houver prefetch, se já tiver expirado (TTL), ou se o fetch tiver
 * falhado/dado no-fill — em qualquer um destes casos, quem chama (AdPrerollGate)
 * cai de volta no fluxo normal (status + fetch na hora), exactamente como se
 * o prefetch nunca tivesse existido. Cada anúncio só pode ser consumido 1x.
 */
export async function consumePrefetchedPreroll(): Promise<VastAd | null> {
  if (!prerollCache || (Date.now() - prerollCache.fetchedAt) >= PREROLL_PREFETCH_TTL_MS) {
    prerollCache = null;
    return null;
  }
  const cache = prerollCache;
  prerollCache = null; // consumido — nunca reutilizar o mesmo anúncio
  try {
    return await cache.promise;
  } catch {
    return null;
  }
}
