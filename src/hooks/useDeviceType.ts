'use client';
/**
 * useDeviceType.ts — StreamPlatform
 *
 * Hook de deteção de ambiente (desktop/mobile/tablet/tv), construído em
 * cima de isLikelyTV() (@/lib/tv-navigation), já usado em produção por
 * ~13 ficheiros (AppShell, modais, player, AntiDevtoolsInit, etc.). Este
 * hook NÃO substitui isLikelyTV()/shouldAutoFocus() — é um complemento
 * para quem precisa de granularidade (ex.: distinguir mobile de tablet,
 * ou saber o vendor exacto da TV para telemetria/UI condicional), sem
 * duplicar a lógica de deteção já validada.
 *
 * SSR-safe: no servidor devolve sempre o estado inicial ('unknown' /
 * flags a false) — nunca acede a window/navigator durante a renderização
 * do servidor. O valor real só fica disponível após o mount (useEffect),
 * exactamente como o resto da app já lida com isLikelyTV() (chamado
 * sempre em useEffect/handlers, nunca no corpo do render server-side).
 * Componentes que usam este hook para decisões de LAYOUT (não só
 * comportamento) devem aceitar um frame inicial em 'unknown' — o mesmo
 * padrão que já existe para shouldAutoFocus() nos modais.
 */

import { useEffect, useState } from 'react';
import { isLikelyTV } from '@/lib/tv-navigation';

export type DeviceCategory = 'unknown' | 'mobile' | 'tablet' | 'desktop' | 'tv';

export type TVVendor =
  | null
  | 'androidtv'
  | 'googletv'
  | 'firetv'
  | 'tizen'
  | 'webos'
  | 'tvbox'
  | 'generic';

export interface DeviceInfo {
  category: DeviceCategory;
  tvVendor: TVVendor;
  /** true assim que a deteção client-side correu (evita decisões prematuras no 1º paint) */
  ready: boolean;
}

const UNKNOWN: DeviceInfo = { category: 'unknown', tvVendor: null, ready: false };

/**
 * Quando a app corre empacotada (Bubblewrap/TWA, Tizen .wgt, webOS .ipk), o
 * User-Agent do WebView pode não conter marcadores fiáveis de TV. O shell
 * nativo de cada empacotamento deve definir isto ANTES do React montar
 * (ex.: <script>window.__PIXGO_TV_VENDOR__='tizen'</script> injectado no
 * index.html do pacote Tizen/webOS, ou um meta tag equivalente na Activity
 * do TWA). Sem isso definido, cai-se para a deteção por UA/heurística.
 */
declare global {
  interface Window {
    __PIXGO_TV_VENDOR__?: TVVendor;
  }
}

function detectTVVendor(ua: string): TVVendor {
  if (typeof window !== 'undefined' && window.__PIXGO_TV_VENDOR__) {
    return window.__PIXGO_TV_VENDOR__;
  }
  if (ua.includes('tizen')) return 'tizen';
  if (ua.includes('webos')) return 'webos';
  if (ua.includes('fire tv') || ua.includes('firetv') || ua.includes('aftm') || ua.includes('aftb')) return 'firetv';
  if (ua.includes('googletv')) return 'googletv';
  if (ua.includes('androidtv') || (ua.includes('android') && ua.includes(' tv'))) return 'androidtv';
  if (ua.includes('smart-tv') || ua.includes('smarttv') || ua.includes('hbbtv') || ua.includes('nettv')) return 'tvbox';
  return 'generic';
}

function detectCategory(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return UNKNOWN;

  if (isLikelyTV()) {
    return { category: 'tv', tvVendor: detectTVVendor(navigator.userAgent.toLowerCase()), ready: true };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isTabletUA = /ipad|tablet|(android(?!.*mobile))/.test(ua);
  const isMobileUA = /iphone|ipod|android.*mobile|windows phone|mobile/.test(ua);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (isTabletUA) return { category: 'tablet', tvVendor: null, ready: true };
  if (isMobileUA || (coarsePointer && window.innerWidth < 768)) {
    return { category: 'mobile', tvVendor: null, ready: true };
  }
  return { category: 'desktop', tvVendor: null, ready: true };
}

/**
 * Uso:
 *   const { category, tvVendor, ready } = useDeviceType();
 *   if (ready && category === 'tv') { ... }
 */
export function useDeviceType(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(UNKNOWN);

  useEffect(() => {
    setInfo(detectCategory());
    // Reavaliar em resize/orientationchange cobre rotação de tablet e
    // janelas redimensionadas em desktop; TVs não disparam isto na prática.
    const onResize = () => setInfo(detectCategory());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return info;
}
