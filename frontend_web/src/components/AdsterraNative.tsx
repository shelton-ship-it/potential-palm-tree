'use client';
import React, { useEffect, useRef, useState } from 'react';
import { adsApi } from '@/lib/api';

// components/AdsterraNative.tsx
//
// Bloco "Native Banner" da Adsterra (zona "NativeBanner_1") — usado só no
// catálogo, 1 bloco por página, entre os cards (nunca dentro de um card).
// Config plug-and-play via ads.network.native (ver lib/ad-network.js —
// ADSTERRA_NATIVE_ENABLED / _SCRIPT / _CONTAINER_ID), lida uma vez por
// montagem através do mesmo /api/ads/status já usado pelo player.
//
// TAMANHO: zona trocada de 4:1 pra 1:1 no painel Adsterra (era um retângulo
// largo, não cabia numa célula do grid sem esticar/cortar) — ocupa 1 célula
// só, mesmo aspect-ratio 2/3 dos content cards (ver .native-ad-block em
// globals.css), sem `gridColumn:'1/-1'` (antes esticava a fileira toda).
//
// Fail-safe: sem config pronta, ou falha no script, o componente não
// renderiza nada — nunca quebra o grid do catálogo nem lança erro no React.
// Não bloqueia o catálogo: o script é injectado de forma assíncrona, depois
// dos cards já estarem na tela.

// Sem dedup a nível de módulo, de propósito: cada visita ao catálogo já
// remonta este componente do zero (Next.js App Router não mantém páginas
// fora da viewport) — é o "reload" natural do anúncio. O cleanup abaixo
// remove o <script> ao desmontar, pra que a próxima montagem reinjecte um
// script fresco (o script antigo, deixado no <body>, nunca voltaria a
// popular um container que já não existe).

interface Props {
  /** CSS grid `order` — controla a posição visual sem afectar a identidade
   *  do nó React (o componente nunca remonta só por causa disto — apenas
   *  entre navegações reais de/para o catálogo). */
  order?: number;
}

export default function AdsterraNative({ order }: Props) {
  const [ready, setReady]      = useState(false);
  const containerIdRef         = useRef<string | null>(null);
  const scriptElRef            = useRef<HTMLScriptElement | null>(null);
  const injectedInThisMount    = useRef(false);

  useEffect(() => {
    let cancelled = false;

    adsApi.status().then(ctx => {
      if (cancelled) return;
      const native = ctx?.network?.native;
      const supportsDisplay = Array.isArray(ctx?.formats) && ctx.formats.includes('display');
      if (!ctx.show_ads || !supportsDisplay || !native?.enabled || !native.script || !native.containerId) {
        return; // não configurado / plano pago / formato não suportado — sem bloco, sem erro
      }

      containerIdRef.current = native.containerId;
      setReady(true);

      if (injectedInThisMount.current) return; // StrictMode chama o effect 2x em dev — só injecta uma vez POR montagem
      injectedInThisMount.current = true;

      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = native.script;
      document.body.appendChild(script);
      scriptElRef.current = script;
    }).catch(() => {
      // rede falhou, /api/ads/status indisponível, etc — sem bloco, catálogo segue normal
    });

    return () => {
      cancelled = true;
      // Remove o script ao desmontar (saiu do catálogo) — sem isto, o
      // browser nunca reexecuta o Adsterra numa próxima visita: o
      // <script src> continuaria "já carregado" do ponto de vista do DOM,
      // mas apontando pra um container que já não existe mais.
      scriptElRef.current?.remove();
      scriptElRef.current = null;
      injectedInThisMount.current = false; // permite reinjecção segura na próxima montagem real (após o par cleanup/effect do StrictMode)
    };
  }, []);

  if (!ready || !containerIdRef.current) return null;

  return (
    <div className="native-ad-block" style={{ order }}>
      <div id={containerIdRef.current} />
    </div>
  );
}
