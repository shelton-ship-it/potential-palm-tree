// lib/hover.ts — true só em dispositivos com rato/trackpad real.
// Pedido explícito: nada de hover em telemóvel/tablet (o toque emite
// mouseenter emulado e o efeito ficava \"preso\"). Os handlers inline
// onMouseEnter/onMouseLeave que mexem em style passam por aqui; o hover em CSS
// vive em @media (hover: hover) and (pointer: fine).
export function canHover(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
