'use client';
/**
 * SpatialNavInit.tsx — StreamPlatform
 *
 * Inicializa o Norigin Spatial Navigation uma única vez, globalmente.
 * Convive com o motor antigo (tv-navigation.ts / TVNavigationInit): este
 * motor só assume o controlo de regiões marcadas explicitamente com
 * `data-norigin-scope` (feito automaticamente por <Focusable>). Fora
 * dessas regiões, o comportamento antigo continua exactamente igual.
 */

import { useEffect, useRef } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';

let initialized = false;

export default function SpatialNavInit() {
  const done = useRef(false);

  useEffect(() => {
    if (initialized || done.current) return;
    init({
      debug: false,
      visualDebug: false,
      // Distância mede-se do centro dos elementos, igual ao motor antigo —
      // mantém o "feel" de navegação consistente entre as duas regiões.
      shouldFocusDOMNode: true,
      // 🔴 FIX (v9) — com `false`, o adapter da própria lib chama
      // event.preventDefault()/stopPropagation() em `window` para QUALQUER
      // Enter/seta reconhecido, mesmo que o foco actual não esteja dentro
      // de nenhum [data-norigin-scope]. Como este listener corre em
      // `window` (depois do listener do motor antigo em `document`, que
      // já devolve sem parar propagação nos casos de input de texto /
      // botão nativo), isto engolia o Enter nativo em botões e forms —
      // ex: submit do login/registo — EM TODA A APP, não só nas regiões
      // geridas pelo Norigin. O `onEnterPress`/navegação interna do
      // Norigin continuam a funcionar na mesma (não dependem disto, e o
      // focus() explícito via shouldFocusDOMNode acima já garante o
      // scroll/estado visual correcto), só deixa de bloquear o resto.
      shouldUseNativeEvents: true,
    });
    initialized = true;
    done.current = true;
  }, []);

  return null;
}
