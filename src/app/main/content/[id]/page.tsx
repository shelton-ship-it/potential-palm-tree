'use client';
import { canHover } from '@/lib/hover';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { contentApi, myListApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { startDownload, DownloadCancelledError, listActiveDownloads } from '@/lib/downloads';
import { useDownloadsStore } from '@/store/downloads';
import { useAppBack } from '@/lib/nav-history';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MovieIcon from '@mui/icons-material/Movie';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import toast from 'react-hot-toast';
import Focusable from '@/components/ui/Focusable';
import { loginRedirectUrl } from '@/lib/auth-redirect';
import { CHANNEL_SERIES_GENRE } from '@/lib/channelSeries';

function normalizeContent(c: any) {
  return {
    ...c,
    meta: c.meta ?? {
      title:       c.title       ?? null,
      poster:      c.poster      ?? null,
      description: c.description ?? null,
      rating:      c.rating      ?? null,
      genres:      c.genres      ?? [],
    },
  };
}

export default function ContentPage() {
  const params  = useParams();
  const id      = params.id as string;
  const router  = useRouter();
  const handleBack = useAppBack('/main/catalog');
  const { t }   = useTranslation();
  const user    = useAuthStore(s => s.user);
  const activeProfileId = useAuthStore(s => s.activeProfileId);

  const [content,       setContent]       = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [inList,        setInList]        = useState(false);
  const [openSeason,    setOpenSeason]    = useState(0);

  // ── Download state ────────────────────────────────────────────────────────
  const [dlState,     setDlState]     = useState<'idle' | 'loading' | 'downloading' | 'done' | 'error'>('idle');
  const [dlProgress,  setDlProgress]  = useState(0);
  const [dlError,     setDlError]     = useState('');

  // FIX: se já existir um download deste título em curso (ex.: retomado
  // automaticamente após um refresh — ver lib/downloads-resume.ts), reflecte
  // esse estado ao abrir a página em vez de mostrar sempre "Baixar" do zero.

  useEffect(() => {
    if (!id) return;
    listActiveDownloads().then(active => {
      const found = active.find(d => d.contentId === id);
      if (found) {
        setDlState(found.status === 'error' ? 'error' : 'downloading');
        setDlProgress(found.progress);
        if (found.error) setDlError(found.error);
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // Rodada 3: passa activeProfileId para o backend já devolver `in_list`
    // embutido (evita o GET /api/mylist/check/:id logo a seguir); o
    // fallback abaixo cobre o caso de ainda não haver perfil activo.
    contentApi.get(id, undefined, activeProfileId)
      .then(c => {
        setContent(normalizeContent(c));
        if (typeof c.in_list === 'boolean') {
          setInList(c.in_list);
        } else if (user) {
          myListApi.check?.(id)
            .then((checked: boolean) => setInList(checked))
            .catch(() => {});
        }
      })
      .catch(() => {
        toast.error(t('errors.notFound'));
        router.push('/main/catalog');
      })
      .finally(() => setLoading(false));
  }, [id, activeProfileId]);

  // OTIMIZAÇÃO (produção): o botão "Assistir" só fazia router.push, nunca
  // pré-buscado — a rota de destino fica pronta assim que a página abre.
  useEffect(() => {
    if (id) router.prefetch(`/main/watch/${id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // OTIMIZAÇÃO (produção): atualiza a UI já, no mesmo clique; reverte
  // silenciosamente só se o pedido ao servidor falhar mesmo.
  const toggleList = () => {
    if (!user) { router.push(loginRedirectUrl()); return; }
    const profileId = useAuthStore.getState().activeProfileId;
    if (!profileId) { toast.error('Nenhum perfil disponível'); return; }

    if (inList) {
      setInList(false);
      toast(t('myList.removed'), { icon: '🗑' });
      myListApi.remove(profileId, id).catch(() => { setInList(true); toast.error(t('errors.networkError')); });
    } else {
      setInList(true);
      toast.success(t('myList.added'));
      myListApi.add(profileId, id).catch(() => { setInList(false); toast.error(t('errors.networkError')); });
    }
  };

  // ── Download handler ──────────────────────────────────────────────────────
  const dlStoreStart    = useDownloadsStore(s => s.start);
  const dlStoreProgress = useDownloadsStore(s => s.setProgress);
  const dlStoreFail     = useDownloadsStore(s => s.fail);
  const dlStoreFinish   = useDownloadsStore(s => s.finish);

  const handleDownload = useCallback(async () => {
    if (!user) { router.push(loginRedirectUrl()); return; }

    setDlState('loading');
    setDlProgress(0);
    setDlError('');

    const fallbackTitle  = content?.meta?.title  ?? content?.title  ?? '';
    const fallbackPoster = content?.meta?.poster ?? content?.poster ?? '';
    dlStoreStart(id, fallbackTitle, fallbackPoster);

    try {
      // 1. Pedir manifesto + licença à API
      // FIX: URL era relativa ('/api/content/...') — batia no próprio domínio
      // do frontend em vez de api.pixgo.qzz.io (não há rewrite configurado
      // pra isso funcionar), causando 404 sempre. Alinhado com watch/[id]/page.tsx.
      const API   = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';
      const token = useAuthStore.getState().token ?? '';
      const res   = await fetch(`${API}/api/content/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      // data: { license, expires_at, manifest: { segUrls, noncesUrl, quality, segmentCount }, content }

      const title  = data.content?.title  ?? fallbackTitle;
      const poster = data.content?.poster ?? fallbackPoster;
      dlStoreStart(id, title, poster);

      setDlState('downloading');

      await startDownload(
        id,
        title,
        poster,
        data.license,
        data.expires_at,
        {
          segUrls:      data.manifest.segUrls,
          noncesUrl:    data.manifest.noncesUrl,
          initUrl:      data.manifest.initUrl,
          quality:      data.manifest.quality ?? data.manifest.segExt ?? '',
          segmentCount: data.manifest.segmentCount,
        },
        (pct: number) => { setDlProgress(pct); dlStoreProgress(id, pct); },
        data.drm_key_hex,
      );

      setDlState('done');
      dlStoreFinish(id);
      toast.success('Download concluído! Disponível offline.');

    } catch (e: any) {
      if (e instanceof DownloadCancelledError) {
        setDlState('idle');
        setDlProgress(0);
        dlStoreFinish(id);
        toast('Download cancelado', { icon: '✕' });
      } else {
        setDlState('error');
        setDlError(e.message ?? 'Erro desconhecido');
        dlStoreFail(id, e.message ?? 'Erro desconhecido');
        toast.error(`Erro: ${e.message}`);
      }
    }
  }, [id, user, router, content]);

  if (loading) return <div className="page-loading"><div className="loading-ring" /></div>;
  if (!content) return null;

  // FIX: 'dorama' passou a ser exibido como "Animações" e tratado como
  // conteúdo unitário na superfície (sem selector de temporadas/episódios) —
  // isto é só uma decisão de UI, o backend continua a tratar 'dorama' da
  // mesma forma (content.js/edgeone.js inalterados) e a devolver seasons se
  // existirem; a página é que deixa de as mostrar.
  const isEpisodic = ['series', 'anime'].includes(content.type);

  const title       = content.meta?.title       || content.title;
  const poster      = content.meta?.poster      || content.poster;
  const description = content.meta?.description || content.description;
  const rating      = content.meta?.rating      ?? content.rating;
  const genres      = content.meta?.genres      ?? content.genres ?? [];

  const canDownload = content.download?.available === true;

  // Label e estado do botão de download
  const dlLabel = () => {
    if (dlState === 'loading')      return 'A preparar...';
    if (dlState === 'downloading')  return `A baixar... ${dlProgress}%`;
    if (dlState === 'done')         return 'Baixado';
    if (dlState === 'error')        return 'Tentar novamente';
    return 'Baixar';
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={handleBack}>
        <ArrowBackIcon style={{ fontSize: 15 }} /> {t('common.back')}
      </button>

      {/* Hero */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 280, marginBottom: 28 }}>
        {poster && (
          <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', filter: 'brightness(0.35)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,12,0.97) 38%, transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 30px' }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
            <span className="badge badge-red">{t(`catalog.${content.type}`)}</span>
            {content.year && <span className="badge badge-gray">{content.year}</span>}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8, maxWidth: 500 }}>
            {title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, color: 'var(--color-text-muted)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            {rating > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <StarIcon style={{ fontSize: 14, color: '#ffd700' }} />{Number(rating).toFixed(1)}
              </span>
            )}
            {content.duration && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <AccessTimeIcon style={{ fontSize: 13 }} />{Math.floor(content.duration / 60)}m
              </span>
            )}
            {genres.filter((g: string) => g !== CHANNEL_SERIES_GENRE).slice(0, 3).map((g: string) => (
              <span key={g} className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{g}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="hero-btn-play" onClick={() => router.push(`/main/watch/${id}`)}>
              <PlayArrowIcon style={{ fontSize: 18 }} /> {t('content.play')}
            </button>
            <button className="hero-btn-info" onClick={toggleList}>
              {inList ? <BookmarkAddedIcon style={{ fontSize: 16 }} /> : <BookmarkAddIcon style={{ fontSize: 16 }} />}
              {inList ? t('content.inList') : t('content.addToList')}
            </button>

            {/* Botão Download — só para utilizadores com plano pago */}
            {canDownload && (
              <button
                className="hero-btn-info"
                onClick={handleDownload}
                disabled={dlState === 'loading' || dlState === 'downloading' || dlState === 'done'}
                style={{
                  opacity: dlState === 'done' ? 0.7 : 1,
                  minWidth: 130,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {dlState === 'done'
                  ? <CheckCircleIcon style={{ fontSize: 16, color: '#00e59b' }} />
                  : <DownloadIcon style={{ fontSize: 16 }} />
                }
                {dlLabel()}

                {/* Barra de progresso inline */}
                {dlState === 'downloading' && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: 0,
                    height: 2,
                    width: `${dlProgress}%`,
                    background: 'var(--color-primary)',
                    transition: 'width 0.3s ease',
                    borderRadius: 2,
                  }} />
                )}
              </button>
            )}

            <button className="hero-btn-info" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copiado!'); }} style={{ width: 44, padding: '0 12px' }}>
              <ShareIcon style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Mensagem de erro inline */}
          {dlState === 'error' && dlError && (
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#ff4d6a' }}>
              ⚠ {dlError}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div>
          {description && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-header"><span className="card-title">{t('content.about')}</span></div>
              <div className="card-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.75 }}>{description}</p>
              </div>
            </div>
          )}

          {isEpisodic && content.seasons?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">{t('content.seasons')}</span></div>
              {content.seasons.map((season: any, si: number) => (
                <div key={season.id}>
                  <Focusable
                    style={{ padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: openSeason === si ? 'rgba(229,9,20,0.04)' : '' }}
                    onClick={() => setOpenSeason(openSeason === si ? -1 : si)}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{t('content.season')} {season.number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{season.episodes?.length} {t('content.episodes')}</span>
                      {openSeason === si ? <ExpandMoreIcon style={{ fontSize: 17 }} /> : <ChevronRightIcon style={{ fontSize: 17 }} />}
                    </div>
                  </Focusable>
                  {openSeason === si && season.episodes?.map((ep: any) => (
                    <Focusable
                      key={ep.id}
                      style={{ padding: '9px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (canHover()) (e.currentTarget as HTMLElement).style.background = 'var(--color-card-hover)'; }}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
                      onClick={() => router.push(`/main/watch/${id}?episode=${ep.id}`)}
                    >
                      {ep.poster
                        ? <img src={ep.poster} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                        : <div style={{ width: 80, height: 45, background: 'var(--color-bg-darker)', borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}><MovieIcon style={{ fontSize: 16 }} /></div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>E{ep.number ?? ''}: {ep.title}</div>
                        {ep.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ep.description}
                          </div>
                        )}
                      </div>
                      {ep.duration && (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {Math.floor(ep.duration / 60)}m
                        </span>
                      )}
                    </Focusable>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Detalhes</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                [t('content.type'),      t(`catalog.${content.type}`)],
                [t('content.year'),      content.year],
                [t('content.duration'),  content.duration ? `${Math.floor(content.duration / 60)} min` : null],
                ...(isEpisodic ? [['Temporadas', content.seasons?.length]] : []),
                [t('content.audio'),     content.audio_langs?.join(', ')],
                [t('content.subtitles'), content.subtitle_langs?.join(', ')],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500, textAlign: 'right', maxWidth: '55%', textTransform: 'capitalize' }}>{v}</span>
                </div>
              ))}
              {content.tags?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 7 }}>{t('content.tags')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {content.tags.map((tag: string) => (
                      <span key={tag} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upgrade card — só quando download não disponível */}
          {!canDownload && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-body">
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 11 }}>{t('content.downloadPremium')}</p>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/main/plans')}>
                  {t('content.upgradePlan')}
                </button>
              </div>
            </div>
          )}

          {/* Card de progresso do download — sidebar */}
          {canDownload && dlState === 'downloading' && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  A guardar para offline...
                </div>
                <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${dlProgress}%`,
                    background: 'var(--color-primary)',
                    transition: 'width 0.3s ease',
                    borderRadius: 2,
                  }} />
                </div>
                <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  {dlProgress}%
                </div>
              </div>
            </div>
          )}

          {canDownload && dlState === 'done' && (
            <div className="card" style={{ marginTop: 12, border: '1px solid rgba(0,229,155,0.2)' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircleIcon style={{ fontSize: 18, color: '#00e59b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00e59b' }}>Download concluído</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Disponível em <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', fontSize: '0.72rem' }} onClick={() => router.push('/main/downloads')}>Downloads</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}