'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCard from '@/components/ui/ContentCard';

// ─────────────────────────────────────────────────────────────────────────────
// TrendingCarousel — secção "Tendências" do /main (mini séries de canal do
// YouTube, cards horizontais 16:9; ver lib/channelSeries.ts).
//
// É um scroller horizontal NATIVO (overflow-x + scroll-snap): toque/arrasto no
// telemóvel, roda/trackpad e scroll por teclado funcionam sem código nosso. Por
// cima disso:
//   • Auto-avanço a cada AUTOPLAY_MS, em "páginas" (~90% da largura visível),
//     a dar a volta ao chegar ao fim.
//   • PAUSA automática: rato por cima (hover), foco de teclado/D-pad dentro da
//     secção, toque em curso, separador em segundo plano e secção fora do ecrã.
//   • Botão Pausar/Reproduzir SEMPRE visível (WCAG 2.2.2 — quem navega por
//     teclado ou leitor de ecrã consegue parar o movimento). Com
//     prefers-reduced-motion o autoplay nasce desligado.
//   • Setas e dots SEMPRE visíveis (nunca escondidas em nenhum estado). As
//     setas dão a volta (início ↔ fim) em vez de ficarem inertes.
//   • ARIA: secção com aria-roledescription="carousel", slides "n de N",
//     região live "off" enquanto roda e "polite" quando parado.
// O CSS vive num <style> local (mesmo padrão do watch/[id]) para não tocar em
// globals.css — o componente só existe uma vez por página.
// ─────────────────────────────────────────────────────────────────────────────

const AUTOPLAY_MS = 4500;
const RESUME_AFTER_TOUCH_MS = 6000;

interface TrendingCarouselProps {
  items: any[];
  title: string;
}

export default function TrendingCarousel({ items, title }: TrendingCarouselProps) {
  const router = useRouter();
  const { t }  = useTranslation();

  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef  = useRef<HTMLElement>(null);

  // Estados que pausam SEM alterar a intenção do utilizador (`playing`).
  const hoverRef   = useRef(false);
  const focusRef   = useRef(false);
  const touchRef   = useRef(false);
  const inViewRef  = useRef(true);
  const reducedRef = useRef(false);
  // Hover só existe com rato/trackpad real — em ecrãs tácteis o browser emite
  // mouseenter emulado ao tocar e a pausa ficava presa (o toque tem o seu
  // próprio mecanismo, touchRef). Pedido: sem hover fora de TV/desktop.
  const canHoverRef = useRef(false);
  const touchTimer = useRef<number | undefined>(undefined);

  // Intenção do utilizador (botão Pausar/Reproduzir).
  const [playing,   setPlaying]   = useState(true);
  const [page,      setPage]      = useState(0);
  const [pageCount, setPageCount] = useState(1);

  // ── Medição: nº de páginas + página actual, a partir do scroll real ───────
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const visible = el.clientWidth || 1;
    const count   = Math.max(1, Math.ceil(el.scrollWidth / visible - 0.05));
    const max     = el.scrollWidth - el.clientWidth;
    const current = max > 1 ? Math.round((el.scrollLeft / max) * (count - 1)) : 0;
    setPageCount(count);
    setPage(Math.min(count - 1, Math.max(0, current)));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; measure(); });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', measure);
    };
  }, [measure, items.length]);

  // ── prefers-reduced-motion: autoplay nasce desligado e o scroll não anima ─
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mq.matches;
    if (mq.matches) setPlaying(false);
    const onChange = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
      if (e.matches) setPlaying(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // ── Fora do ecrã → pausa (não gasta CPU a animar o que ninguém vê) ────────
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      canHoverRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }
  }, []);

  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  // ── Movimento ─────────────────────────────────────────────────────────────
  const behavior = (): ScrollBehavior => (reducedRef.current ? 'auto' : 'smooth');

  const move = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) return;
    if (dir === 1 && el.scrollLeft >= max - 4) {
      el.scrollTo({ left: 0, behavior: behavior() });
    } else if (dir === -1 && el.scrollLeft <= 4) {
      el.scrollTo({ left: max, behavior: behavior() });
    } else {
      el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.9, 200), behavior: behavior() });
    }
  }, []);

  const goToPage = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = pageCount <= 1 ? 0 : (i / (pageCount - 1)) * max;
    el.scrollTo({ left, behavior: behavior() });
  }, [pageCount]);

  // ── Autoplay ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || items.length < 2) return;
    const id = window.setInterval(() => {
      if (hoverRef.current || focusRef.current || touchRef.current) return;
      if (!inViewRef.current || document.hidden) return;
      move(1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, items.length, move]);

  if (!items.length) return null;

  const total = items.length;

  return (
    <section
      ref={rootRef}
      className="tc-root section"
      aria-roledescription="carousel"
      aria-label={title}
      onMouseEnter={() => { if (canHoverRef.current) hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      onFocus={() => { focusRef.current = true; }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusRef.current = false;
      }}
      onTouchStart={() => {
        touchRef.current = true;
        window.clearTimeout(touchTimer.current);
      }}
      onTouchEnd={() => {
        window.clearTimeout(touchTimer.current);
        touchTimer.current = window.setTimeout(() => { touchRef.current = false; }, RESUME_AFTER_TOUCH_MS);
      }}
      onTouchCancel={() => { touchRef.current = false; }}
    >
      <style>{`
        .tc-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
        .tc-toggle {
          display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px 0 8px;
          border-radius:999px; font-size:0.72rem; font-weight:700; letter-spacing:.02em;
          color:var(--color-text-light, #fff); background:rgba(255,255,255,0.06);
          border:1px solid var(--color-border, rgba(255,255,255,.12)); cursor:pointer;
          transition:background .2s, border-color .2s;
        }
        .tc-root { min-width:0; --tc-w: clamp(190px, 17vw, 240px); }
        .tc-viewport { position:relative; min-width:0; }
        .tc-track {
          display:flex; gap:14px; overflow-x:auto; padding:2px 2px 8px;
          scroll-snap-type:x proximity; scrollbar-width:none; -ms-overflow-style:none;
          overscroll-behavior-x:contain;
        }
        .tc-track::-webkit-scrollbar { display:none; }
        .tc-slide { flex:0 0 auto; width:var(--tc-w); scroll-snap-align:start; }
        .tc-arrow {
          position:absolute; top:calc(var(--tc-w) * 0.28125 + 2px); transform:translateY(-50%); z-index:3;
          width:36px; height:36px; border-radius:50%; display:grid; place-items:center; padding:0;
          color:#fff; background:rgba(12,12,16,0.78); border:1px solid rgba(255,255,255,0.2);
          -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
          box-shadow:0 8px 22px rgba(0,0,0,0.5); cursor:pointer;
          transition:background .2s, transform .2s, border-color .2s, opacity .2s;
        }
.tc-arrow:active { transform:translateY(-50%) scale(0.96); }
        .tc-arrow[aria-disabled="true"] { opacity:.45; }
        .tc-prev { left:4px; }
        .tc-next { right:4px; }
        /* Foco visível só em TV (D-pad); teclado/toque não desenham anel. */
        .tv-mode .tc-toggle:focus-visible, .tv-mode .tc-arrow:focus-visible, .tv-mode .tc-dot:focus-visible {
          outline:2px solid #fff; outline-offset:2px;
        }
        .tc-dots { display:flex; justify-content:center; align-items:center; gap:2px; margin-top:6px; flex-wrap:wrap; }
        .tc-dot { width:22px; height:22px; display:grid; place-items:center; background:none; border:0; padding:0; cursor:pointer; }
        .tc-dot::before {
          content:''; width:8px; height:8px; border-radius:999px; background:rgba(255,255,255,0.28);
          transition:width .25s ease, background .25s ease;
        }
        /* Hover só com rato real */
        @media (hover: hover) and (pointer: fine) {
          .tc-toggle:hover { background:rgba(255,255,255,0.12); border-color:var(--color-border-hover, rgba(255,255,255,.25)); }
          .tc-arrow:hover { background:var(--color-primary, #e50914); border-color:transparent; transform:translateY(-50%) scale(1.09); }
          .tc-dot:hover::before { background:rgba(255,255,255,0.55); }
        }
        .tc-dot[aria-current="true"]::before { width:22px; background:var(--color-primary, #e50914); }
        @media (max-width: 600px) {
          /* ~2 cards visíveis, tamanho de um channel-card no telemóvel */
          .tc-root { --tc-w: 46vw; }
          .tc-track { gap:8px; }
          .tc-arrow { width:30px; height:30px; }
          .tc-dot { width:18px; height:18px; }
          .tc-toggle-label { display:none; }
          .tc-toggle { padding:0 8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-arrow, .tc-dot::before, .tc-toggle { transition:none; }
        }
      `}</style>

      <div className="tc-header">
        <h2 className="section-title">{title}</h2>
        <button
          type="button"
          className="tc-toggle"
          data-tv-focusable
          aria-pressed={!playing}
          aria-label={playing ? t('home.trendingPause') : t('home.trendingPlay')}
          onClick={() => setPlaying(p => !p)}
        >
          {playing ? <PauseIcon style={{ fontSize: 18 }} /> : <PlayArrowIcon style={{ fontSize: 18 }} />}
          <span className="tc-toggle-label">{playing ? t('home.trendingPause') : t('home.trendingPlay')}</span>
        </button>
      </div>

      <div className="tc-viewport">
        <button
          type="button"
          className="tc-arrow tc-prev"
          data-tv-focusable
          aria-label={t('home.trendingPrev')}
          aria-disabled={pageCount <= 1}
          onClick={() => move(-1)}
        >
          <ChevronLeftIcon style={{ fontSize: 28 }} />
        </button>

        <div
          ref={trackRef}
          className="tc-track"
          data-tv-container
          aria-live={playing ? 'off' : 'polite'}
        >
          {items.map((item: any, i: number) => {
            const cardTitle  = item.meta?.title  || item.title  || '—';
            const poster     = item.meta?.poster || item.poster;
            const rating     = item.meta?.rating || item.rating;
            return (
              <div
                key={item.id}
                className="tc-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={t('home.trendingSlide', { current: i + 1, total })}
              >
                <ContentCard
                  wide
                  id={item.id}
                  title={cardTitle}
                  poster={poster}
                  year={item.year}
                  type={item.type}
                  rating={rating}
                  href={i < 6 ? `/main/watch/${item.id}` : undefined}
                  onClick={() => router.push(`/main/watch/${item.id}`)}
                  style={{ contentVisibility: 'visible' }}
                />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="tc-arrow tc-next"
          data-tv-focusable
          aria-label={t('home.trendingNext')}
          aria-disabled={pageCount <= 1}
          onClick={() => move(1)}
        >
          <ChevronRightIcon style={{ fontSize: 28 }} />
        </button>
      </div>

      <div className="tc-dots" role="group" aria-label={t('home.trendingDots')}>
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i}
            type="button"
            className="tc-dot"
            data-tv-focusable
            aria-label={t('home.trendingGoTo', { page: i + 1 })}
            aria-current={i === page ? 'true' : undefined}
            onClick={() => goToPage(i)}
          />
        ))}
      </div>
    </section>
  );
}
