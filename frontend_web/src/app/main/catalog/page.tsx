'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { catalogApi, myListApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import ContentCard from '@/components/ui/ContentCard';
import TrendingCarousel from '@/components/ui/TrendingCarousel';
import { isChannelSeries } from '@/lib/channelSeries';
import TvOffIcon from '@mui/icons-material/TvOff';
import PlansModal from '@/components/ui/PlansModal';
import { ContentGridSkeleton, TrendingSkeleton, SeriesRowsSkeleton, MiniCardSkeleton } from '@/components/ui/Skeleton';

// FIX: este ficheiro estava, no upload original, a conter uma cópia
// acidental de content/[id]/page.tsx — a rota /main/catalog nunca teve
// uma listagem real, por isso ficava presa em "loading" para sempre
// (useParams() não tem `id` numa rota estática, contentApi.get(undefined)
// nunca resolve `content`, e o early-return `if (!content) return null`
// combinado com o loading inicial nunca sai do estado de carregamento).
// Reconstruída aqui como a listagem de catálogo real, usando o mesmo
// catalogApi/ContentCard/estilos já usados em main/page.tsx e
// main/search/page.tsx.

// FIX: pedido explícito — ordem das abas no header do catálogo deve ser
// "Todos" primeiro, depois "Vídeos", depois o resto (era all→movie→...→video,
// com "video" sempre por último).
const TYPES = ['all', 'video', 'movie', 'series', 'anime', 'documentary', 'dorama'];

const KID_TYPES = ['anime', 'dorama'];

const TRENDING_LIMIT = 60; // mesmo tecto do carrossel do /main

// ── MINI SÉRIES no catálogo (pedido explícito, set/2026) ─────────────────────
//   • "Todos": como o /main — carrossel TrendingCarousel FIXO no topo (não
//     depende de página) e, por baixo, a grelha dos restantes com SCROLL
//     INFINITO (mesma técnica do /main: sentinela + IntersectionObserver, sem
//     paginação clássica). As mini séries saem da grelha; como a paginação do
//     servidor conta tudo, uma página podia ficar quase vazia — o scroll
//     infinito resolve-o, porque continua a carregar enquanto a sentinela
//     estiver visível.
//   • "Séries": padrão fixo em LINHAS (horizontais), de cima para baixo:
//       linha 1 = mini séries · linha 2 = mini séries · linha 3 = séries
//       verticais · linha 4-5 = mini séries · linha 6 = verticais · …
//     Cada linha é uma grelha própria com nº fixo de cartões (nM para mini
//     séries, nT para verticais — calculados pela largura real, ver
//     useRowCounts), por isso todas as linhas do mesmo tipo têm o mesmo
//     tamanho e o padrão M-M-T nunca se desalinha. Mini série = card
//     horizontal 16:9 do tamanho de um channel-card; vertical = poster normal.
//     Se um dos tipos acabar, o outro continua sozinho pela mesma ordem.
type RowKind = 'M' | 'T';
function buildSeriesRows(list: any[], nM: number, nT: number): { kind: RowKind; items: any[] }[] {
  const minis = list.filter(isChannelSeries);
  const talls = list.filter((it: any) => !isChannelSeries(it));
  const rows: { kind: RowKind; items: any[] }[] = [];
  let m = 0, t = 0;
  while (m < minis.length || t < talls.length) {
    for (let r = 0; r < 2 && m < minis.length; r++) { rows.push({ kind: 'M', items: minis.slice(m, m + nM) }); m += nM; }
    if (t < talls.length)                             { rows.push({ kind: 'T', items: talls.slice(t, t + nT) }); t += nT; }
  }
  return rows;
}

// Cartões por linha, medidos na largura REAL do conteúdo (espelha o
// auto-fill das outras grelhas: ~180px por mini série, ~140px por vertical),
// com mínimos de 2 e 3 no telemóvel. Re-mede ao rodar/redimensionar.
function useRowCounts(ref: React.RefObject<HTMLElement>): { nM: number; nT: number } {
  const [c, setC] = useState({ nM: 2, nT: 3 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const w   = el.getBoundingClientRect().width;
      const gap = w < 600 ? 7 : 10;
      const nM = Math.max(2, Math.min(6, Math.floor((w + gap) / (180 + gap))));
      const nT = Math.max(3, Math.min(9, Math.floor((w + gap) / (140 + gap))));
      setC(prev => (prev.nM === nM && prev.nT === nT ? prev : { nM, nT }));
    };
    calc();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    ro?.observe(el);
    window.addEventListener('resize', calc);
    return () => { ro?.disconnect(); window.removeEventListener('resize', calc); };
  }, [ref]);
  return c;
}

export default function CatalogPage() {
  const router = useRouter();
  const sp     = useSearchParams();
  const { t }  = useTranslation();

  const profiles        = useAuthStore(s => s.profiles);
  const activeProfileId = useAuthStore(s => s.activeProfileId);
  const activeProfile   = profiles.find(p => p.id === activeProfileId) || null;
  const isKid           = !!activeProfile?.is_kid;
  const visibleTypes    = isKid ? KID_TYPES : TYPES;

  const [type,    setType]    = useState(() => {
    const fromUrl = sp.get('type') || 'all';
    return isKid && !KID_TYPES.includes(fromUrl) ? 'anime' : fromUrl;
  });
  const [sort,    setSort]    = useState<'recent' | 'popular'>(() =>
    sp.get('sort') === 'popular' ? 'popular' : 'recent'
  );
  const [items,   setItems]   = useState<any[]>([]);
  const [, setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState<any[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { nM, nT } = useRowCounts(rootRef);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Scroll infinito (mesma técnica do /main) em "Todos" e "Séries"; os
  // restantes separadores mantêm a paginação clássica.
  const infinite = type === 'all' || type === 'series';
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef    = useRef<HTMLDivElement>(null);
  const seenIds        = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);

  // Se o perfil activo mudar para um perfil infantil enquanto uma aba não
  // permitida está seleccionada (ex: "Filmes"), cai para "Anime" — evita
  // ficar preso numa aba que o backend vai sempre devolver vazia.
  useEffect(() => {
    if (isKid && !KID_TYPES.includes(type)) setType('anime');
  }, [isKid, type]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 24, page: p, sort };
      if (type !== 'all') params.type = type;
      if (activeProfileId) params.profile_id = activeProfileId;
      const res: any = await catalogApi.list(params);
      const list = Array.isArray(res.items) ? res.items : [];
      setItems(list);
      setTotal(res.pagination?.total ?? list.length);
      setPages(res.pagination?.pages ?? 1);
      setPage(p);
      // Infinito: recomeça o controlo de duplicados e de "há mais" (o servidor
      // devolve página cheia = 24 itens enquanto houver mais).
      seenIds.current = new Set(list.map((it: any) => it.id));
      setHasMore(res.pagination?.pages ? p < res.pagination.pages : list.length === 24);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, sort, activeProfileId]);

  useEffect(() => { load(1); }, [load]);

  // Sentinela do scroll infinito — igual ao /main: quando entra no viewport
  // (com 600px de avanço) carrega a página seguinte; depois de cada carga o
  // efeito volta a correr e um novo observer dispara logo se a sentinela ainda
  // estiver visível (é isto que enche o ecrã quando a página veio quase vazia
  // por causa das mini séries retiradas da grelha).
  useEffect(() => {
    if (!infinite || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (loadingMoreRef.current || !hasMore) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const nextPage = page + 1;
      const params: Record<string, any> = { limit: 24, page: nextPage, sort };
      if (type !== 'all') params.type = type;
      if (activeProfileId) params.profile_id = activeProfileId;
      catalogApi.list(params)
        .then((res: any) => {
          const next = Array.isArray(res.items) ? res.items : [];
          const fresh = next.filter((it: any) => !seenIds.current.has(it.id));
          fresh.forEach((it: any) => seenIds.current.add(it.id));
          setItems(prev => [...prev, ...fresh]);
          setPage(nextPage);
          setPages(res.pagination?.pages ?? nextPage);
          setHasMore(res.pagination?.pages ? nextPage < res.pagination.pages : next.length === 24);
        })
        .catch(() => { /* silencioso — tenta de novo no próximo intersect */ })
        .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [infinite, loading, hasMore, page, sort, type, activeProfileId, items.length]);

  // Carrossel de mini séries — só no separador "Todos" (mesma chamada do
  // /main: type=series mais recentes, filtradas no cliente pelo marcador).
  // Falha silenciosa: sem carrossel a página funciona como antes.
  useEffect(() => {
    if (type !== 'all' || isKid) { setTrending([]); setTrendingLoading(false); return; }
    let cancelled = false;
    setTrendingLoading(true);
    catalogApi.list({
      limit: TRENDING_LIMIT, page: 1, sort, type: 'series',
      ...(activeProfileId ? { profile_id: activeProfileId } : {}),
    })
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res?.items) ? res.items : [];
        setTrending(list.filter(isChannelSeries));
      })
      .catch(() => { if (!cancelled) setTrending([]); })
      .finally(() => { if (!cancelled) setTrendingLoading(false); });
    return () => { cancelled = true; };
  }, [type, sort, isKid, activeProfileId]);

  // FIX (navegação/voltar): type e sort viviam só em useState, nunca
  // reflectidos na URL. Resultado: trocar de categoria não criava histórico
  // nenhum (a URL ficava sempre /main/catalog), e ao abrir um conteúdo e
  // clicar em "voltar", o browser regressava a essa MESMA URL sem parâmetros
  // — a página remontava e caía sempre na categoria por omissão ("Todos"),
  // não na categoria onde a pessoa estava. Espelhamos type/sort na
  // querystring via router.replace (sem criar uma entrada de histórico por
  // troca de aba — só a navegação real para outra página é que deve empilhar
  // histórico), para que o "voltar" restaure exactamente a mesma vista.
  useEffect(() => {
    const params = new URLSearchParams();
    if (type !== 'all')      params.set('type', type);
    if (sort !== 'recent')   params.set('sort', sort);
    const qs  = params.toString();
    const url = qs ? `/main/catalog?${qs}` : '/main/catalog';
    router.replace(url, { scroll: false });
  }, [type, sort, router]);

  const renderCard = (item: any, i: number, extra: React.CSSProperties | undefined, wide: boolean) => {
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
        // Mini série de canal: card horizontal 16:9 (ver lib/channelSeries.ts).
        wide={wide}
        // FIX (mantido): clique vai directo a /main/watch/:id — ver histórico
        // deste ficheiro (página /main/content/:id deixou de ser destino).
        href={`/main/watch/${item.id}`}
        onClick={() => router.push(`/main/watch/${item.id}`)}
        onAddToList={() => {
          const profileId = useAuthStore.getState().activeProfileId;
          if (profileId) myListApi.add(profileId, item.id).catch(() => {});
        }}
        style={{ animationDelay: `${(i % 24) * 0.03}s`, ...extra }}
      />
    );
  };

  return (
    <div ref={rootRef}>
      {/* Pedido explícito: só no /catalogo, nunca na home (/main). O
          componente já se auto-gere (só free, 1x/dia, ver PlansModal.tsx). */}
      <PlansModal />

      {/* FIX (redundância entre navegação e página, pedido explícito): o
          título desta página ("Explorar") já aparece no sidebar/bottom-nav
          por onde a pessoa acabou de clicar para chegar aqui — repeti-lo
          como <h1> logo a seguir ao header era só ruído. Mantém-se apenas
          o espaçamento do page-header (margem antes da barra de filtros),
          sem o texto. Mesma limpeza aplicada em channels/mylist/search. */}
      <div className="page-header" />

      {/* FIX (pedido explícito): no mobile, os chips de tipo (Todos/Vídeos/
          Filmes/.../Animações) e os de ordenação (Recentes/Populares)
          apareciam todos colados/desorganizados. Causa: o <span
          style={{flex:1}}/> usado para empurrar "Recentes"/"Populares"
          para a direita só funciona bem numa única linha sem quebra — mal
          o .filter-bar precisa de quebrar linha (ecrã estreito), esse
          spacer invisível confunde o cálculo do wrap e os chips ficam sem
          o espaçamento certo entre grupos. Agora são dois grupos
          separados (tipo / ordenação), cada um com o seu próprio
          flex-wrap — no desktop ficam lado a lado (justify-content:
          space-between no .filter-bar); no mobile (ver globals.css)
          empilham em duas linhas bem distintas, cada uma a quebrar
          normalmente dentro do espaço disponível. */}
      <div className="filter-bar">
        <div className="filter-bar-group">
          {visibleTypes.map(tp => (
            <button
              key={tp}
              className={`filter-chip ${type === tp ? 'active' : ''}`}
              onClick={() => setType(tp)}
            >
              {t(`catalog.${tp === 'all' ? 'allTypes' : tp}`)}
            </button>
          ))}
        </div>
        <div className="filter-bar-group">
          <button
            className={`filter-chip ${sort === 'recent' ? 'active' : ''}`}
            onClick={() => setSort('recent')}
          >
            {t('catalog.sortRecent')}
          </button>
          <button
            className={`filter-chip ${sort === 'popular' ? 'active' : ''}`}
            onClick={() => setSort('popular')}
          >
            {t('catalog.sortPopular')}
          </button>
        </div>
      </div>

      {/* "Todos": carrossel fixo no topo — com skeleton enquanto carrega (antes
          aparecia de repente e empurrava a grelha para baixo) */}
      {type === 'all' && !isKid && (
        trendingLoading
          ? <TrendingSkeleton />
          : trending.length > 0 && <TrendingCarousel items={trending} title={t('home.trending')} />
      )}

      {loading ? (
        type === 'series'
          ? <SeriesRowsSkeleton nM={nM} nT={nT} blocks={2} />
          : <ContentGridSkeleton count={18} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><TvOffIcon style={{ fontSize: 28 }} /></div>
          <div className="empty-title">{t('catalog.noContent')}</div>
          <div className="empty-desc">{t('catalog.noContentDesc')}</div>
        </div>
      ) : (
        <>
          {type === 'series' ? (
            <div className="series-rows" data-tv-container>
              {buildSeriesRows(items, nM, nT).map((row, ri) => (
                <div
                  key={ri}
                  className={`series-row series-row--${row.kind}`}
                  style={{ gridTemplateColumns: `repeat(${row.kind === 'M' ? nM : nT}, minmax(0, 1fr))` }}
                >
                  {row.items.map((item: any, i: number) =>
                    renderCard(item, i, { gridColumn: 'auto' }, row.kind === 'M'))}
                </div>
              ))}
            </div>
          ) : (
            <div className="content-grid" data-tv-container>
              {(type === 'all' ? items.filter((it: any) => !isChannelSeries(it)) : items)
                .map((item, i) => renderCard(item, i, undefined, false))}
            </div>
          )}

          {infinite && hasMore && <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />}
          {infinite && loadingMore && (
            type === 'series'
              ? <div className="series-rows"><div className="series-row" style={{ gridTemplateColumns: `repeat(${nM}, minmax(0, 1fr))` }}>
                  {Array.from({ length: nM }, (_, i) => <MiniCardSkeleton key={i} />)}
                </div></div>
              : <ContentGridSkeleton count={Math.max(6, nT)} />
          )}

          {!infinite && pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 26, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1)}
              >
                {t('common.previous')}
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2)
                .reduce<(number | 'ellipsis')[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === 'ellipsis' ? (
                    <span key={`e${i}`} style={{ color: 'var(--color-text-muted)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => load(n)}
                      disabled={loading}
                      className={`filter-chip ${n === page ? 'active' : ''}`}
                      style={{ minWidth: 34, textAlign: 'center' }}
                    >
                      {n}
                    </button>
                  )
                )}
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= pages || loading}
                onClick={() => load(page + 1)}
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
