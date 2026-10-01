'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { contentApi, progressApi, myListApi, catalogApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { startDownload, getDownloadMeta, DownloadCancelledError } from '@/lib/downloads';
import { useDownloadsStore } from '@/store/downloads';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import BookmarkAddIcon    from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon  from '@mui/icons-material/BookmarkAdded';
import ShareIcon          from '@mui/icons-material/Share';
import StarIcon           from '@mui/icons-material/Star';
import MovieIcon          from '@mui/icons-material/Movie';
import PlayArrowIcon      from '@mui/icons-material/PlayArrow';
import DownloadIcon       from '@mui/icons-material/Download';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import LockIcon           from '@mui/icons-material/Lock';
import toast from 'react-hot-toast';

const ShakaPlayer = dynamic(() => import('@/components/player/ShakaPlayer'), { ssr: false });
import type { ShakaPlayerHandle } from '@/components/player/ShakaPlayer';
import { loginRedirectUrl } from '@/lib/auth-redirect';
import RateLimitModal, { type UpsellPlan } from '@/components/ui/RateLimitModal';
import SessionReplacedModal from '@/components/ui/SessionReplacedModal';
import { useAppBack } from '@/lib/nav-history';

const PROGRESS_INTERVAL_MS = 60_000;

function RecommendCard({ item, onClick }: { item: any; onClick: () => void }) {
  const { t }  = useTranslation();
  const title  = item.meta?.title  || item.title  || '—';
  const poster = item.meta?.poster || item.poster;
  const [imgErr, setImgErr] = useState(false);
  return (
    <div
      tabIndex={0}
      data-tv-focusable
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="recommend-card"
      style={{ display: 'flex', gap: 8, cursor: 'pointer', padding: '6px 4px', borderRadius: 6, transition: 'background 0.15s', outline: 'none' }}
    >
      <div style={{ width: 120, height: 68, borderRadius: 6, overflow: 'hidden', background: 'var(--color-bg-darker)', flexShrink: 0 }}>
        {poster && !imgErr
          ? <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MovieIcon style={{ fontSize: 20, color: 'var(--color-text-muted)' }} />
            </div>}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-title)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', gap: 6 }}>
          {/* FIX: mostrava item.type cru ("dorama") em vez do label traduzido
              — mesmo padrão já usado em ContentCard.tsx/content/[id]/page.tsx
              (t('catalog.dorama') = "Animações"). Só estético, o campo
              item.type continua igual nos dados/lógica. */}
          {item.type && <span style={{ textTransform: 'capitalize' }}>{t(`catalog.${item.type}`)}</span>}
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  const params    = useParams();
  const id        = params.id as string;
  const sp        = useSearchParams();
  const router    = useRouter();
  const handleBack = useAppBack('/main/catalog');
  const { t }     = useTranslation();
  const user      = useAuthStore(s => s.user);
  const plan      = useAuthStore(s => s.plan);
  const profileId = useAuthStore(s => s.activeProfileId);
  const token     = useAuthStore(s => s.token);

  const [content,           setContent]           = useState<any>(null);
  const [loading,           setLoading]           = useState(true);
  const [activeEp,          setActiveEp]          = useState<any>(null);
  const [activeSeason,      setActiveSeason]      = useState(0);
  const [inList,            setInList]            = useState(false);
  const [startTime,         setStartTime]         = useState(0);
  const [showRateLimit,     setShowRateLimit]     = useState(false);
  const [rateLimitPlans,    setRateLimitPlans]    = useState<UpsellPlan[]>([]);
  const [rateLimitMsg,      setRateLimitMsg]      = useState<string | undefined>(undefined);
  const [sessionReplacedMsg, setSessionReplacedMsg] = useState('');
  const [recommendations,   setRecommendations]   = useState<any[]>([]);
  const [downloading,       setDownloading]       = useState(false);
  const [downloadPct,       setDownloadPct]       = useState(0);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState(false);
  const [offlinePlayback,   setOfflinePlayback]   = useState<{ contentId: string; keyHex: string; segCount: number } | null>(null);

  const lastProgressSave = useRef<number>(0);
  const lastProgressPct  = useRef<number>(-1);

  const canDownload  = !!(plan && plan.id !== 'free' && plan.is_active);
  const streamApiUrl = id
    ? `${process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io'}/api/content/${id}/stream${activeEp ? `?episode=${activeEp.id}` : ''}`
    : '';

  useEffect(() => {
    if (!canDownload || !id) return;
    getDownloadMeta(id).then(meta => {
      if (meta && new Date(meta.expiresAt).getTime() > Date.now()) setAlreadyDownloaded(true);
    }).catch(() => {});
  }, [id, canDownload]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      lastProgressSave.current = 0;
      lastProgressPct.current  = -1;
      try {
        const epId = sp.get('episode');
        const wantsOffline = sp.get('offline') === '1';
        let c: any;
        // FIX: se o utilizador pediu explicitamente offline (veio da página
        // de Downloads) ou a rede falhou, tenta reconstruir a partir do
        // download local e liga a reprodução offline real ao leitor —
        // antes disto o player ignorava por completo o conteúdo descarregado
        // e tentava sempre o stream ao vivo.
        if (wantsOffline) {
          const meta = await getDownloadMeta(id).catch(() => null);
          if (meta?.keyHex && meta?.hasInit) {
            setOfflinePlayback({ contentId: id, keyHex: meta.keyHex, segCount: meta.segCount });
            c = { id, type: 'movie', title: meta.title, meta: { title: meta.title, poster: meta.poster }, poster: meta.poster, offlineOnly: true };
          }
        }
        if (!c) {
          try {
            // Rodada 3: passa profileId para reaproveitar `in_list` embutido
            // na resposta (evita o GET /api/mylist/check/:id logo abaixo) —
            // e para o cache curto em sessionStorage (ver lib/contentCache.ts)
            // reaproveitar o que a página de detalhes já buscou há segundos.
            c = await contentApi.get(id, undefined, profileId);
          } catch (networkErr) {
            // Offline (ou API inatingível) e o título foi descarregado —
            // antes a página ficava em branco (setContent nunca era chamado).
            const meta = await getDownloadMeta(id).catch(() => null);
            if (!meta) throw networkErr;
            if (meta.keyHex && meta.hasInit) {
              setOfflinePlayback({ contentId: id, keyHex: meta.keyHex, segCount: meta.segCount });
            }
            c = { id, type: 'movie', title: meta.title, meta: { title: meta.title, poster: meta.poster }, poster: meta.poster, offlineOnly: true };
          }
        }
        if (cancelled) return;
        setContent(c);
        const isEp = ['series', 'anime'].includes(c.type);
        if (isEp && c.seasons?.length) {
          const allEps = c.seasons.flatMap((s: any) => s.episodes || []);
          const ep     = epId ? allEps.find((e: any) => e.id === epId) : allEps[0];
          if (ep) setActiveEp(ep);
        }
        if (user) {
          // Rodada 3: só cai no pedido separado se a resposta não trouxe
          // `in_list` embutido (ex.: sem profileId ainda resolvido).
          if (typeof c.in_list === 'boolean') {
            setInList(c.in_list);
          } else {
            myListApi.check(id).then((r: any) => { if (!cancelled) setInList(r.inList || false); }).catch(() => {});
          }
        }
        catalogApi.list({ type: c.type || 'movie', limit: 12, sort: 'recommended', exclude: id })
          .then((r: any) => {
            if (!cancelled) setRecommendations((r.items || []).slice(0, 12));
          }).catch(() => {});
      } catch {
        if (!cancelled) toast.error(t('errors.notFound'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // OTIMIZAÇÃO (produção): os cards de recomendados só faziam router.push,
  // nunca pré-buscados — prefetch de todos assim que a lista chega (12
  // itens no máximo, custo desprezível).
  useEffect(() => {
    recommendations.forEach(item => router.prefetch(`/main/watch/${item.id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations]);

  const handleTime = useCallback((cur: number, dur: number) => {
    if (!user || !id || !dur || !profileId) return;
    if (typeof id !== 'string' || id.trim() === '' || id === 'undefined') return;
    const now = Date.now();
    if (now - lastProgressSave.current < PROGRESS_INTERVAL_MS) return;
    const pct = Math.round((cur / dur) * 100);
    if (pct === lastProgressPct.current) return;
    lastProgressSave.current = now;
    lastProgressPct.current  = pct;
    progressApi.update({ profileId, contentId: id, episodeId: activeEp?.id, lang: 'en', progress: pct, duration: Math.round(dur) }).catch(() => {});
  }, [id, activeEp, user, profileId]);

  const playerRef = useRef<ShakaPlayerHandle>(null);

  useEffect(() => {
    lastProgressSave.current = 0;
    lastProgressPct.current  = -1;
  }, [activeEp?.id]);

  const handleNext = useCallback(() => {
    if (!content?.seasons) return;
    const all = content.seasons.flatMap((s: any) => s.episodes || []);
    const idx = all.findIndex((e: any) => e.id === activeEp?.id);
    if (idx >= 0 && idx < all.length - 1) {
      const next = all[idx + 1];
      setActiveEp(next);
      const si = content.seasons.findIndex((s: any) => s.episodes?.some((e: any) => e.id === next.id));
      if (si >= 0) setActiveSeason(si);
    }
  }, [content, activeEp]);

  // OTIMIZAÇÃO (produção): atualiza o botão/UI já, no mesmo clique;
  // reverte silenciosamente só se o pedido ao servidor falhar mesmo.
  const toggleList = () => {
    if (!user) { router.push(loginRedirectUrl()); return; }
    const pid = profileId;
    if (!pid) { toast.error('Perfil não encontrado.'); return; }

    if (inList) {
      setInList(false);
      toast(t('myList.removed'), { icon: '🗑' });
      myListApi.remove(pid, id).catch(() => { setInList(true); toast.error(t('errors.networkError')); });
    } else {
      setInList(true);
      toast.success(t('myList.added'));
      myListApi.add(pid, id).catch(() => { setInList(false); toast.error(t('errors.networkError')); });
    }
  };

  const dlStart      = useDownloadsStore(s => s.start);
  const dlSetProgress = useDownloadsStore(s => s.setProgress);
  const dlFail        = useDownloadsStore(s => s.fail);
  const dlFinish       = useDownloadsStore(s => s.finish);

  const handleDownload = async () => {
    if (!canDownload) { router.push('/main/plans'); return; }
    if (alreadyDownloaded) { router.push('/main/downloads'); return; }
    if (downloading) return;
    setDownloading(true);
    setDownloadPct(0);
    const title  = content?.title  || id;
    const poster = content?.poster || '';
    dlStart(id, title, poster);
    toast.success('Download iniciado — acompanha o progresso em Downloads.', { duration: 3000 });
    try {
      const API     = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';
      const epParam = activeEp ? `?episode=${activeEp.id}` : '';
      const res     = await fetch(`${API}/api/content/${id}/download${epParam}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Falha ao obter licença'); }
      const data = await res.json();
      const { license, expires_at, manifest, content: contentInfo } = data;
      if (contentInfo?.title || contentInfo?.poster) {
        dlStart(id, contentInfo.title || title, contentInfo.poster || poster);
      }
      await startDownload(
        id, contentInfo?.title || content?.title || id,
        contentInfo?.poster || content?.poster || '',
        license, expires_at, manifest,
        pct => { setDownloadPct(pct); dlSetProgress(id, pct); },
      );
      setAlreadyDownloaded(true);
      dlFinish(id);
      toast.success('Download completo! Disponível em Downloads.', { duration: 4000 });
    } catch (err: any) {
      if (err instanceof DownloadCancelledError) {
        dlFinish(id);
        toast('Download cancelado', { icon: '✕' });
      } else {
        dlFail(id, err.message || 'Falha no download');
        toast.error(err.message || 'Falha no download');
      }
    } finally {
      setDownloading(false);
      setDownloadPct(0);
    }
  };

  if (loading) return <div className="page-loading"><div className="loading-ring" /></div>;
  if (sessionReplacedMsg) return (
    <SessionReplacedModal
      message={sessionReplacedMsg}
      onClose={() => { setSessionReplacedMsg(''); router.push('/main'); }}
    />
  );
  if (showRateLimit) return (
    <RateLimitModal
      plans={rateLimitPlans}
      message={rateLimitMsg}
      onClose={() => { setShowRateLimit(false); handleBack(); }}
      onUpgrade={(planId) => { setShowRateLimit(false); router.push(`/main/plans?highlight=${planId}`); }}
    />
  );

  const isEpisodic = content && ['series', 'anime'].includes(content.type);

  const downloadBtn = (() => {
    if (downloading)       return { icon: null,                                                                               label: `${downloadPct}%` };
    if (alreadyDownloaded) return { icon: <CheckCircleIcon style={{ fontSize: 15, color: 'var(--color-secondary)' }} />,     label: 'Baixado'  };
    if (!canDownload)      return { icon: <LockIcon        style={{ fontSize: 14, opacity: 0.7 }} />,                        label: 'Premium'  };
    return                        { icon: <DownloadIcon    style={{ fontSize: 15 }} />,                                      label: 'Baixar'   };
  })();

  return (
    <>
      <style>{`
        .watch-outer {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 24px;
          align-items: start;
        }
        .watch-sidebar { position: sticky; top: 80px; }

        /* Episódios */
        .episode-row {
          display: flex;
          gap: 10px;
          padding: 9px 12px;
          border-bottom: 1px solid var(--color-border);
          cursor: pointer;
          transition: background 0.1s;
          border-left: 3px solid transparent;
          outline: none;
        }
        /* FIX (foco só em TV, todas as páginas): :focus/:focus-visible ficam
           sob .tv-mode; :hover (rato) mantém-se. */
        @media (hover: hover) and (pointer: fine) { .episode-row:hover { background: var(--color-card-hover); } }
        .tv-mode .episode-row:focus { background: var(--color-card-hover); }
        .episode-row.ep-playing  { background: rgba(229,9,20,0.07); border-left-color: var(--color-primary); }
        .tv-mode .episode-row:focus-visible {
          outline: 2px solid var(--color-primary) !important;
          outline-offset: -2px !important;
          box-shadow: none !important;
        }

        /* Recomendados */
        @media (hover: hover) and (pointer: fine) { .recommend-card:hover { background: rgba(255,255,255,0.04); } }
        .tv-mode .recommend-card:focus { background: rgba(255,255,255,0.04); }
        .tv-mode .recommend-card:focus-visible {
          outline: 2px solid var(--color-primary) !important;
          outline-offset: 2px !important;
          border-radius: 6px;
          box-shadow: none !important;
        }

        /* Acções */
        .watch-actions {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .watch-action-btns {
          display: flex;
          gap: 7px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        /* Mobile / tablet */
        @media (max-width: 900px) {
          .watch-outer           { grid-template-columns: 1fr; }
          .watch-sidebar         { position: static; }
        }
        @media (max-width: 600px) {
          .watch-action-btns     { width: 100%; }
          .watch-action-btns .btn { flex: 1; justify-content: center; }
        }
      `}</style>

      <div className="watch-outer">
        {/* ── Coluna principal ────────────────────────────────────────── */}
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={handleBack}>
            <ArrowBackIcon style={{ fontSize: 15 }} /> {t('common.back')}
          </button>

          <div className="player-wrap" style={{ marginBottom: 16, position: 'relative' }}>
            {offlinePlayback ? (
              // FIX: reprodução offline real — lê os segmentos já
              // descarregados directamente do IndexedDB (ver
              // ShakaPlayer.tsx/lib/downloads.ts), sem tocar na rede.
              <ShakaPlayer
                ref={playerRef}
                offlinePlayback={offlinePlayback}
                poster={content?.meta?.poster || content?.poster}
                startTime={startTime}
                onTimeUpdate={handleTime}
                onNextEpisode={isEpisodic && activeEp ? handleNext : undefined}
                autoPlay
              />
            ) : content?.offlineOnly ? (
              // Título descarregado (offlineOnly), mas sem os dados
              // necessários para tocar localmente (download feito antes
              // deste fix, sem init.bin/chave gravados) — pede para
              // descarregar de novo em vez de tentar um stream inatingível.
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
                <MovieIcon style={{ fontSize: 32, color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Este download foi feito antes de suportarmos reprodução offline — apague-o e descarregue-o de novo (com ligação) para poder assistir sem rede.
                </span>
              </div>
            ) : streamApiUrl && token ? (
              <ShakaPlayer
                ref={playerRef}
                streamApiUrl={streamApiUrl}
                token={token}
                poster={content?.meta?.poster || content?.poster}
                startTime={startTime}
                onTimeUpdate={handleTime}
                onNextEpisode={isEpisodic && activeEp ? handleNext : undefined}
                onFreeTimeExhausted={(plans: UpsellPlan[], message?: string) => { setRateLimitPlans(plans ?? []); setRateLimitMsg(message); setShowRateLimit(true); }}
                onSessionReplaced={(message: string) => setSessionReplacedMsg(message)}
                autoPlay
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loading-ring" />
              </div>
            )}
          </div>

          {/* Título + acções */}
          <div className="watch-actions">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
                {content?.meta?.title || content?.title}
                {activeEp && ` · E${activeEp.number ?? ''}: ${activeEp.title}`}
              </h1>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {content?.type && <span className="badge badge-red" style={{ textTransform: 'capitalize' }}>{content.type}</span>}
                {content?.year && <span className="badge badge-gray">{content.year}</span>}
                {content?.meta?.rating > 0 && (
                  <span className="badge" style={{ background: 'rgba(255,215,0,0.1)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <StarIcon style={{ fontSize: 11 }} />{content.meta.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="watch-action-btns">
              <button className="btn btn-secondary btn-sm" onClick={toggleList}>
                {inList ? <BookmarkAddedIcon style={{ fontSize: 15 }} /> : <BookmarkAddIcon style={{ fontSize: 15 }} />}
                {inList ? t('content.inList') : t('content.addToList')}
              </button>

              <button
                className={`btn btn-sm ${alreadyDownloaded ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={handleDownload}
                disabled={downloading}
                title={!canDownload ? 'Disponível em qualquer plano Premium' : alreadyDownloaded ? 'Ver downloads' : 'Baixar para assistir offline'}
                style={{ minWidth: 90, position: 'relative', overflow: 'hidden', opacity: !canDownload ? 0.75 : 1 }}
              >
                {downloading ? (
                  <>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${downloadPct}%`, background: 'rgba(229,9,20,0.25)', transition: 'width 0.3s' }} />
                    <span style={{ position: 'relative', zIndex: 1 }}>{downloadPct}%</span>
                  </>
                ) : (
                  <>{downloadBtn.icon}{downloadBtn.label}</>
                )}
              </button>

              <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copiado!'); }}>
                <ShareIcon style={{ fontSize: 15 }} />
              </button>
            </div>
          </div>

          {/* Descrição */}
          {(activeEp?.description || content?.meta?.description || content?.description) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ padding: '12px 16px' }}>
                <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  {activeEp?.description || content?.meta?.description || content?.description}
                </p>
              </div>
            </div>
          )}

          {/* Episódios */}
          {isEpisodic && content?.seasons?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ padding: '11px 16px' }}>
                <span className="card-title" style={{ fontSize: '0.875rem' }}>{t('content.seasons')}</span>
              </div>

              {content.seasons.length > 1 && (
                <div style={{ display: 'flex', gap: 4, padding: '7px 12px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
                  {content.seasons.map((s: any, si: number) => (
                    <button
                      key={s.id}
                      className={`filter-chip ${activeSeason === si ? 'active' : ''}`}
                      style={{ flexShrink: 0, fontSize: '0.74rem', padding: '4px 10px' }}
                      onClick={() => setActiveSeason(si)}
                    >
                      {t('content.season')} {s.number}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ maxHeight: 320, overflowY: 'auto' }} data-tv-container>
                {content.seasons[activeSeason]?.episodes?.map((ep: any) => {
                  const playing = activeEp?.id === ep.id;
                  return (
                    <div
                      key={ep.id}
                      tabIndex={0}
                      data-tv-focusable
                      className={`episode-row${playing ? ' ep-playing' : ''}`}
                      onClick={() => setActiveEp(ep)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveEp(ep); }
                      }}
                    >
                      {ep.poster
                        ? <img src={ep.poster} alt="" style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        : <div style={{ width: 72, height: 40, background: 'var(--color-bg-darker)', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {playing
                              ? <PlayArrowIcon style={{ fontSize: 16, color: 'var(--color-primary)' }} />
                              : <MovieIcon     style={{ fontSize: 14, color: 'var(--color-text-muted)' }} />}
                          </div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: playing ? 'var(--color-primary)' : 'var(--color-text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          E{ep.number ?? ''} · {ep.title}
                        </div>
                        {ep.duration && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{Math.floor(ep.duration / 60)}min</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar recomendados ─────────────────────────────────────── */}
        <div className="watch-sidebar" data-tv-container>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
            Recomendados
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recommendations.map(item => (
              <RecommendCard key={item.id} item={item} onClick={() => router.push(`/main/watch/${item.id}`)} />
            ))}
            {recommendations.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sem recomendações disponíveis.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}