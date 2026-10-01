import React from 'react';

// Skeletons de página — pedido explícito: /main, /catalogo e /channel
// mostravam só um spinner genérico enquanto carregavam; isto troca por
// placeholders com a forma real do conteúdo (grid de cards, hero, grelha
// de canais), reduzindo o "salto" de layout quando os dados chegam.
// Puramente visual — nenhum destes componentes faz fetch nem toca em
// estado; quem os usa decide quantos mostrar e quando trocar pelos dados
// reais.

export function ContentCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="skeleton-card" style={style}>
      <div className="skeleton skeleton-thumb" />
      <div className="skeleton-info">
        <div className="skeleton skeleton-line" style={{ width: '85%' }} />
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      </div>
    </div>
  );
}

// `count` por omissão cobre confortavelmente 1-2 fileiras em desktop sem
// exagerar em nós DOM. `withHeader` replica o cabeçalho de secção
// (título + "ver tudo") usado nas fileiras da home.
export function ContentGridSkeleton({ count = 12, withHeader = false }: { count?: number; withHeader?: boolean }) {
  return (
    <div className={withHeader ? 'section' : undefined}>
      {withHeader && (
        <div className="section-header">
          <div className="skeleton skeleton-line" style={{ width: 140, height: 18 }} />
        </div>
      )}
      <div className="content-grid">
        {Array.from({ length: count }, (_, i) => (
          <ContentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="skeleton skeleton-hero">
      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton-line" style={{ width: 90, height: 12 }} />
        <div className="skeleton-line" style={{ width: '55%', height: 30 }} />
        <div className="skeleton-line" style={{ width: '38%', height: 14 }} />
      </div>
    </div>
  );
}

export function ChannelCardSkeleton() {
  return <div className="skeleton skeleton-channel-card" />;
}

export function ChannelsGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="channels-grid">
      {Array.from({ length: count }, (_, i) => (
        <ChannelCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Mini séries (cards horizontais 16:9) ──────────────────────────────────────
export function MiniCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="skeleton-card" style={style}>
      <div className="skeleton skeleton-thumb skeleton-thumb--wide" />
      <div className="skeleton-info">
        <div className="skeleton skeleton-line" style={{ width: '80%' }} />
        <div className="skeleton skeleton-line" style={{ width: '35%' }} />
      </div>
    </div>
  );
}

// Carrossel "Tendências" (separador Todos): cabeçalho + uma linha de mini
// séries com a mesma largura dos slides do TrendingCarousel (--tc-w).
export function TrendingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="section">
      <div className="section-header">
        <div className="skeleton skeleton-line" style={{ width: 120, height: 18 }} />
      </div>
      <div className="tc-skel-row">
        {Array.from({ length: count }, (_, i) => <MiniCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

// Separador Séries: mesmo padrão final — 2 linhas de mini séries + 1 linha de
// verticais (nM / nT = cartões por linha, os mesmos que a página vai usar).
export function SeriesRowsSkeleton({ nM, nT, blocks = 1 }: { nM: number; nT: number; blocks?: number }) {
  const rows: ('M' | 'T')[] = [];
  for (let b = 0; b < blocks; b++) rows.push('M', 'M', 'T');
  return (
    <div className="series-rows">
      {rows.map((k, r) => (
        <div key={r} className={`series-row series-row--${k}`}
          style={{ gridTemplateColumns: `repeat(${k === 'M' ? nM : nT}, minmax(0, 1fr))` }}>
          {Array.from({ length: k === 'M' ? nM : nT }, (_, i) =>
            k === 'M' ? <MiniCardSkeleton key={i} /> : <ContentCardSkeleton key={i} />)}
        </div>
      ))}
    </div>
  );
}
