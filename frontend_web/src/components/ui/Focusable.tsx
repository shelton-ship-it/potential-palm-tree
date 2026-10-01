'use client';
/**
 * Focusable.tsx — StreamPlatform
 *
 * Wrapper genérico para tornar qualquer elemento clicável navegável por
 * D-pad/teclado, sem reescrever a lógica de clique nem o layout/estilos
 * já existentes.
 *
 * v2 — deixou de depender do @noriginmedia/norigin-spatial-navigation.
 * Motivo: qualquer região marcada com [data-norigin-scope] fazia o motor
 * antigo (tv-navigation.ts) devolver imediatamente para QUALQUER tecla,
 * entregando o controlo por completo ao Norigin. Como este componente é
 * usado no ContentCard — logo, em todos os cards da app (Início, Minha
 * Lista, Buscar, Catálogo, "Continuar assistindo") — a navegação entre
 * cards ficou inteiramente dependente do motor Norigin, sem qualquer
 * fallback quando ele falhava a mover o foco entre elementos (o motor
 * antigo já tinha desistido daquela zona) → foco "preso", nada reagia.
 *
 * Agora usa os MESMOS primitivos do motor antigo (data-tv-focusable +
 * tabIndex=0) já usados com sucesso noutras páginas (ex: cards da página
 * de downloads) — um único sistema de navegação para toda a app, em vez
 * de dois a competir/entregar-se mal um ao outro.
 *
 * Uso típico (converter um <div onClick={fn}> existente):
 *
 *   <Focusable onEnterPress={fn} className="dropdown-item">
 *     ...conteúdo inalterado...
 *   </Focusable>
 *
 * - `as` escolhe a tag renderizada (default: 'div'), para preservar semântica.
 * - `onEnterPress` (ou `onClick`, se `onEnterPress` não for dado) é ligado
 *   directamente ao onClick nativo do elemento — cobre rato E Enter/OK do
 *   remoto, porque o motor antigo traduz Enter num active.click() real
 *   sobre o elemento focado (ver FIX 7 em tv-navigation.ts).
 * - `focusedClassName` é adicionado à className quando o elemento está
 *   focado (default: 'tv-focused', estilizado globalmente em globals.css).
 * - Todas as outras props (style, onMouseEnter, data-*, etc.) passam
 *   directo para o elemento renderizado.
 */

import React, { useEffect, useRef, useState, forwardRef } from 'react';
import { isLikelyTV } from '@/lib/tv-navigation';

export interface FocusableProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  children?: React.ReactNode;
  onEnterPress?: () => void;
  onClick?: () => void;
  focusedClassName?: string;
  as?: keyof React.JSX.IntrinsicElements;
  autoFocus?: boolean;
  focusKey?: string; // mantido na interface por compat.; não usado (era específico do Norigin)
}

const Focusable = forwardRef<HTMLElement, FocusableProps>(function Focusable(
  {
    children,
    onEnterPress,
    onClick,
    className = '',
    focusedClassName = 'tv-focused',
    as = 'div',
    autoFocus = false,
    focusKey: _focusKey,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  forwardedRef
) {
  // Enter/OK do remoto E clique de rato passam pelo mesmo handler nativo —
  // ver nota acima sobre active.click() no motor antigo.
  const activateOnEnter = onEnterPress ?? onClick;

  const [focused, setFocused] = useState(false);
  const localRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      // rAF: garante que o elemento já está montado/medido antes do focus(),
      // mesmo padrão usado em focusFirstInPage() (tv-navigation.ts).
      requestAnimationFrame(() => localRef.current?.focus({ preventScroll: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const Tag = as as any;

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }}
      className={`${className} ${focused ? focusedClassName : ''}`.trim()}
      style={style}
      onClick={activateOnEnter}
      // FIX (pedido explícito, mandatório): focusedClassName ('tv-focused')
      // é o destaque grande (contorno vermelho, "lift" do card) pensado
      // para D-pad de TV — antes era aplicado em QUALQUER foco, em
      // qualquer dispositivo. Num telemóvel, tocar num card com
      // tabIndex=0 foca o elemento nativamente e o destaque ficava
      // "preso" (sem rato, não há um evento equivalente a mouseleave que
      // o tire). Agora só entra em dispositivos TV/set-top (isLikelyTV())
      // — no telemóvel e no desktop com rato, o toque/clique continua a
      // funcionar na mesma (onClick nem passa por aqui), só sem o
      // contorno de TV a ficar colado ao ecrã.
      onFocus={(e: React.FocusEvent<Element>) => { if (isLikelyTV()) setFocused(true); onFocus?.(e as React.FocusEvent<HTMLElement>); }}
      onBlur={(e: React.FocusEvent<Element>) => { setFocused(false); onBlur?.(e as React.FocusEvent<HTMLElement>); }}
      data-tv-focusable
      tabIndex={0}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default Focusable;
