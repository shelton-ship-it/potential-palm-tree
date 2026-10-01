// src/app/main/page.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { catalogApi, progressApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import ContentCard from '@/components/ui/ContentCard';
import TrendingCarousel from '@/components/ui/TrendingCarousel';
import { isChannelSeries } from '@/lib/channelSeries';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TvOffIcon from '@mui/icons-material/TvOff';
import toast from 'react-hot-toast';
import Focusable from '@/components/ui/Focusable';
import { ContentGridSkeleton } from '@/components/ui/Skeleton';

// FIX (pedido explícito, set/2026): o /main tinha duas coisas a sair —
//
//   1. O hero rotativo (mostrador a trocar de destaque a cada 7s, com
//      pontinhos de navegação). Removido por completo: sem heroIdx, sem
//      setInterval, sem a secção .hero-banner no JSX.
//
//   2. As fileiras separadas por tipo (Vídeos / Popular / Filmes / Séries /
//      Anime), cada uma buscada e embaralhada à parte. No lugar entra uma
//      única grelha com todos os tipos misturados — sem rótulo de secção
//      por tipo, ao estilo da home do YouTube — ordenada por lançamento
//      mais recente (não popularidade, não embaralhado). Isto usa a MESMA
//      chamada e a MESMA ordenação que a aba "Todos" do /main/catalog
//      (GET /api/catalog, sort=recent, sem type — ver routes/catalog.js,
//      mergeTypesRecent). Antes disto, este ficheiro fazia
//      shuffle()/videoFirst() em cada fileira; ambos foram removidos, já
//      não fazem sentido numa lista única ordenada por data.
//
// "Continuar assistindo" mantém-se — é progresso pessoal do utilizador,
// não uma categorização por tipo, e não foi pedido para sair.
//
// FIX v2 (pedido explícito, set/2026) — feed estilo YouTube incompleto:
//
//   1. Só existia UMA página (24 itens), sem scroll infinito. Agora carrega
//      mais páginas automaticamente à medida que o utilizador se aproxima
//      do fundo (IntersectionObserver numa sentinela, sem custo de scroll
//      listener). Usa a MESMA rota/paginação de sempre (GET /api/catalog,
//      sort=recent, sem type) — só acrescenta páginas, nunca as troca.
//
//   2. "Ordenar pelo mais recente" está correcto, mas pedido explícito:
//      mesmo os itens recentes devem aparecer MISTURADOS entre si (não só
//      misturados entre tipos), como a home do YouTube faz — não uma fila
//      estritamente cronológica. Isto é feito no backend (?feed=1, ver
//      routes/catalog.js → shuffleWindows) SOBRE cada página já decidida
//      por offset/limit — nunca muda que itens caem em cada página, só a
//      ordem local dentro dela, por isso não interfere com o scroll
//      infinito nem duplica/salta itens entre páginas. O /main/catalog não
//      manda ?feed=1 e continua estritamente cronológico.
//
//   3. Memória em dispositivos fracos com scroll infinito e MUITO conteúdo:
//      duas camadas, como o YouTube faz na prática —
//        a) content-visibility:auto em .content-card (globals.css) — o
//           browser deixa de fazer layout/paint de cartões fora do ecrã,
//           sem precisar de desmontar/remontar nada (o que quebraria o
//           foco por D-pad da navegação TV);
//        b) um tecto (MAX_MOUNTED) ao nº de cartões mantidos no DOM/estado
//           React — ao ultrapassar o tecto, os mais antigos (topo, já bem
//           fora de vista numa lista só-para-baixo) são libertados. Só
//           afecta o array em memória, nunca o que já foi pedido ao
//           servidor nem a paginação em si.
//
// MINI SÉRIES (pedido explícito, set/2026) — vídeos de canal do YouTube
// registados como type `series` sem temporada/episódio, marcados no campo
// `genres` (ver lib/channelSeries.ts). Têm cards horizontais 16:9 e NÃO se
// misturam com o resto do feed: saem da grelha misturada (o filtro é só de
// apresentação — paginação, seenIds e o tecto de memória continuam a contar
// os itens crus devolvidos pelo servidor, por isso nada salta nem duplica) e
// aparecem numa secção própria fixa no topo, "Tendências", em carrossel
// (TrendingCarousel). Séries com temporadas/episódios NÃO têm o marcador e
// continuam na grelha, com cards verticais, como sempre.
const ITEMS_LIMIT  = 24;
const TRENDING_LIMIT = 60; // mini séries mais recentes no carrossel
const MAX_MOUNTED   = 240; // ~10 páginas — tecto de segurança para memória fraca
const TRIM_TO       = 180; // ao ultrapassar o tecto, corta de volta para isto

export default function HomePage() {
  const router = useRouter();
  const { t }  = useTranslation();

  const [items,      setItems]      = useState<any[]>([]);
  const [continueW,  setContinueW]  = useState<any[]>([]);
  const [trending,   setTrending]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);

  const activeProfileId = useAuthStore(s => s.activeProfileId);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIds     = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false); // evita disparos duplicados do observer

  const loadPage = useCallback(async (p: number) => {
    const res = await catalogApi.list({
      limit: ITEMS_LIMIT,
      page:  p,
      sort:  'recent',
      feed:  1, // mistura "estilo YouTube" — só a home usa isto (ver routes/catalog.js)
      ...(activeProfileId ? { profile_id: activeProfileId } : {}),
    });
    return Array.isArray(res.items) ? res.items : [];
  }, [activeProfileId]);

  // Carga inicial — reinicia tudo sempre que o perfil activo muda.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    setHasMore(true);
    seenIds.current = new Set();
    // Carrossel "Tendências": mesma rota do catálogo (type=series, mais
    // recentes primeiro), filtrada no cliente pelo marcador de mini série.
    // Falha silenciosa — sem carrossel o /main funciona exactamente como antes.
    catalogApi.list({
      limit: TRENDING_LIMIT,
      page:  1,
      sort:  'recent',
      type:  'series',
      ...(activeProfileId ? { profile_id: activeProfileId } : {}),
    })
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res?.items) ? res.items : [];
        setTrending(list.filter(isChannelSeries));
      })
      .catch(() => { if (!cancelled) setTrending([]); });
    (async () => {
      try {
        const first = await loadPage(1);
        if (cancelled) return;
        seenIds.current = new Set(first.map((it: any) => it.id));
        setItems(first);
        setHasMore(first.length === ITEMS_LIMIT);
        progressApi.continue({ limit: 6 })
          .then((r: any) => { if (!cancelled) setContinueW(Array.isArray(r) ? r : []); })
          .catch(() => {});
      } catch {
        toast.error(t('errors.networkError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId]);

  // Scroll infinito: observa uma sentinela no fundo da grelha e carrega a
  // página seguinte quando ela entra no viewport. rootMargin adianta o
  // carregamento um pouco antes de chegar mesmo ao fim, para não haver
  // "salto" visível à espera da rede.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loading) return;

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (loadingMoreRef.current || !hasMore) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);

      const nextPage = page + 1;
      loadPage(nextPage)
        .then((next) => {
          const fresh = next.filter((it: any) => !seenIds.current.has(it.id));
          fresh.forEach((it: any) => seenIds.current.add(it.id));
          setItems(prev => {
            const merged = [...prev, ...fresh];
            // Tecto de memória (ver nota acima) — corta do topo, não do
            // fundo, para não interferir com o que está prestes a ser visto.
            return merged.length > MAX_MOUNTED ? merged.slice(merged.length - TRIM_TO) : merged;
          });
          setPage(nextPage);
          setHasMore(next.length === ITEMS_LIMIT);
        })
        .catch(() => { /* falha silenciosa — tenta de novo no próximo intersect */ })
        .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
    }, { rootMargin: '600px 0px' });

    io.observe(el);
    return () => io.disconnect();
  }, [loading, hasMore, page, loadPage]);

  useEffect(() => {
    continueW.forEach((item: any) => router.prefetch(`/main/watch/${item.content_id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueW]);

  if (loading) return (
    <div>
      <ContentGridSkeleton count={12} withHeader />
      <ContentGridSkeleton count={12} withHeader />
    </div>
  );

  // Mini séries saem da grelha misturada (ver nota no topo do ficheiro).
  const gridItems = items.filter((it: any) => !isChannelSeries(it));

  // Empty state
  if (!gridItems.length && !trending.length) return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="empty-icon">
        <TvOffIcon style={{ fontSize: 30 }} />
      </div>
      <div className="empty-title">{t('home.noContent')}</div>
      <div className="empty-desc">{t('home.noContentDesc')}</div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
        {t('common.retry')}
      </button>
    </div>
  );

  return (
    <div>
      {/* ── Tendências — mini séries (cards horizontais), fixo no topo ── */}
      {trending.length > 0 && (
        <TrendingCarousel items={trending} title={t('home.trending')} />
      )}

      {/* ── Continue Watching ── */}
      {continueW.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">{t('home.continueWatching')}</h2>
          </div>
          <div data-tv-container style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
            {continueW.map((item: any) => (
              <Focusable
                key={item.content_id}
                className="cw-card"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/main/watch/${item.content_id}`)}
              >
                {item.content?.poster ? (
                  <img
                    src={item.content.poster}
                    alt={item.content.title}
                    className="cw-thumb"
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                  />
                ) : (
                  <div className="cw-thumb" style={{ background: 'var(--color-card-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayArrowIcon style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                )}
                <div className="progress-bar" style={{ marginTop: 5 }}>
                  <div className="progress-fill" style={{ width: `${item.progress || 0}%` }} />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.content?.title}
                </div>
              </Focusable>
            ))}
          </div>
        </div>
      )}

      {/* ── Grelha única, todos os tipos e recentes misturados (feed) ── */}
      <div className="content-grid" data-tv-container>
        {gridItems.map((item: any, i: number) => {
          const title  = item.meta?.title  || item.title  || '—';
          const poster = item.meta?.poster || item.poster;
          const rating = item.meta?.rating || item.rating;
          return (
            <ContentCard
              key={item.id}
              id={item.id}
              title={title}
              poster={poster}
              year={item.year}
              type={item.type}
              rating={rating}
              href={`/main/watch/${item.id}`}
              onClick={() => router.push(`/main/watch/${item.id}`)}
              style={{ animationDelay: `${(i % ITEMS_LIMIT) * 0.03}s` }}
            />
          );
        })}
      </div>

      {/* Sentinela do scroll infinito — invisível, só dispara o
          IntersectionObserver acima. Sempre presente enquanto houver mais
          páginas, para o observer conseguir voltar a "vê-la" depois de cada
          carga (novos itens empurram-na mais para baixo). */}
      {hasMore && (
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
      )}
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 0' }}>
          <span className="spinner spinner-sm" />
        </div>
      )}
    </div>
  );
}
