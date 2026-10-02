'use client';
/**
 * InstallPWAButton.tsx — StreamPlatform
 *
 * Botão de instalação da PWA usando o web component @khmyznikov/pwa-install
 * (sucessor mantido do pacote "pwa-install", descontinuado).
 *
 * - `manual-apple` / `manual-chrome`: o componente NÃO mostra popup/banner
 *   próprio sozinho — só abre quando chamamos showDialog() explicitamente
 *   no clique do nosso botão.
 * - Em navegadores sem suporte a beforeinstallprompt (Safari/iOS), o próprio
 *   componente mostra instruções manuais ("Adicionar à Tela de Início").
 * - Não renderiza nada se a app já estiver instalada (comportamento nativo
 *   do componente).
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DownloadIcon from '@mui/icons-material/Download';
import { isLikelyTV } from '@/lib/tv-navigation';

// O custom element regista-se globalmente ao importar o módulo — só no cliente.
let registered = false;

export default function InstallPWAButton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const elRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    // Reaproveita a detecção de dispositivo já usada na navegação D-pad:
    // em TV/set-top box (ou já instalado como app standalone) não faz
    // sentido oferecer "Instalar App" — a TV já corre isto como app,
    // e o fluxo de instalação de PWA não existe nesses browsers embutidos.
    const standalone = typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    if (isLikelyTV() || standalone) return;

    let cancelled = false;
    if (!registered) {
      import('@khmyznikov/pwa-install').then(() => {
        registered = true;
        if (!cancelled) { setReady(true); setEligible(true); }
      }).catch(() => {});
    } else {
      setReady(true);
      setEligible(true);
    }
    return () => { cancelled = true; };
  }, []);

  if (!ready || !eligible) return null;

  return (
    <>
      {/* FIX: portal para document.body — o sidebar tem `transform`
          sempre activo (mesmo aberto), o que cria um containing block
          novo para o `position:fixed` interno do diálogo do
          <pwa-install>, prendendo-o dentro do sidebar (que tem
          overflow-y:auto) em vez de o centrar no ecrã. Fora da árvore do
          sidebar, o diálogo volta a posicionar-se contra o viewport. */}
      {typeof document !== 'undefined' && createPortal(
        // @ts-ignore — custom element, sem tipagem React
        <pwa-install ref={elRef} manual-apple manual-chrome use-local-storage></pwa-install>,
        document.body
      )}
      <button
        className={className}
        style={style}
        onClick={() => elRef.current?.showDialog?.(true)}
      >
        <DownloadIcon style={{ fontSize: 15 }} />
        Instalar App
      </button>
    </>
  );
}
