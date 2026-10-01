// src/app/main/channels/page.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { channelsApi } from '@/lib/api';
import { listChannels, getCategories, searchChannels } from '@/lib/channels-source';
import { useAuthStore } from '@/store/auth';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LockIcon from '@mui/icons-material/Lock';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import toast from 'react-hot-toast';
import { shouldAutoFocus } from '@/lib/tv-navigation';
import { loginRedirectUrl } from '@/lib/auth-redirect';
import RateLimitModal, { type UpsellPlan } from '@/components/ui/RateLimitModal';
import SessionReplacedModal from '@/components/ui/SessionReplacedModal';
import { ChannelsGridSkeleton } from '@/components/ui/Skeleton';

const LIMIT = 30;
// Destino do "Saber mais" do aviso: o repositório público geral de IPTV da
// comunidade (iptv-org) — nunca uma conta pessoal.
const COMMUNITY_REPO_URL = 'https://github.com/iptv-org/iptv';

function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Listagem simples por metadados reais (categoria/paginação do backend),
// sem nenhuma pré-pesquisa nem ordenação hardcoded por palavras-chave —
// removida a pedido explícito (estava a "atrapalhar" a listagem normal).
// Mesma decisão já aplicada no app Flutter (channels_screen.dart).

// ── Category Dropdown ────────────────────────────────────────────────────────
function CategoryDropdown({
  categories,
  selected,
  onChange,
}: {
  categories: { name: string; slug: string; count: number }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = selected
    ? categories.find(c => c.slug === selected)?.name ?? selected
    : 'Todas as categorias';

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 38,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          cursor: 'pointer',
          color: 'var(--color-text)',
          fontSize: '0.825rem',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s',
        }}
      >
        <LiveTvIcon style={{ fontSize: 14, color: 'var(--color-text-muted)' }} />
        <span style={{
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textTransform: 'capitalize',
        }}>
          {selectedLabel}
        </span>
        <ExpandMoreIcon
          style={{
            fontSize: 16,
            color: 'var(--color-text-muted)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 200,
            background: '#0f0f13',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
            minWidth: 220,
            maxHeight: 340,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {/* Todas */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            style={{
              width: '100%',
              padding: '8px 14px',
              textAlign: 'left',
              background: selected === null ? 'var(--color-primary-alpha, rgba(229,9,20,0.1))' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: selected === null ? 'var(--color-primary)' : 'var(--color-text)',
              fontSize: '0.825rem',
              fontWeight: selected === null ? 600 : 400,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>Todas as categorias</span>
          </button>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => { onChange(cat.slug); setOpen(false); }}
              style={{
                width: '100%',
                padding: '8px 14px',
                textAlign: 'left',
                background: selected === cat.slug ? 'var(--color-primary-alpha, rgba(229,9,20,0.1))' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: selected === cat.slug ? 'var(--color-primary)' : 'var(--color-text)',
                fontSize: '0.825rem',
                fontWeight: selected === cat.slug ? 600 : 400,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                textTransform: 'capitalize',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.name}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                background: 'var(--color-card-hover)',
                borderRadius: 4,
                padding: '1px 5px',
                flexShrink: 0,
              }}>
                {cat.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fullscreen Video Player ─────────────────────────────────────────────────
function ChannelPlayer({
  channel,
  onClose,
  onFreeTimeExhausted,
  onSessionReplaced,
}: {
  channel: { id: string; name: string; logo?: string; url: string };
  onClose: () => void;
  onFreeTimeExhausted: (plans: UpsellPlan[], message?: string) => void;
  onSessionReplaced: (message: string) => void;
}) {
  const [error, setError] = useState('');
  const playerRef  = useRef<any>(null);
  const destroyRef = useRef<() => void>(() => {});

  useEffect(() => {
    setError('');

    if (!channel.url || typeof window === 'undefined') return;

    let destroyed = false;

    const init = async () => {
      try {
        const shaka = await import('shaka-player');
        shaka.default.polyfill.installAll();

        if (playerRef.current) {
          await playerRef.current.destroy().catch(() => {});
          playerRef.current = null;
        }

        const video = document.getElementById('channel-video') as HTMLVideoElement;
        if (!video || destroyed) return;

        const player = new shaka.default.Player();
        await player.attach(video);
        playerRef.current = player;

        destroyRef.current = () => {
          destroyed = true;
          player.destroy().catch(() => {});
        };

        player.configure({
          streaming: {
            bufferingGoal: 8,
            rebufferingGoal: 2,
            retryParameters: { maxAttempts: 5 },
          },
        });

        player.addEventListener('error', () => {
          if (!destroyed) setError('Falha ao carregar canal.');
        });

        await player.load(channel.url);

        if (!destroyed) {
          video.play().catch(() => {});
        }
      } catch {
        const video = document.getElementById('channel-video') as HTMLVideoElement;
        if (video && !destroyed) {
          video.src = channel.url;
          video.load();
          video.play().catch(() => {});
        }
      }
    };

    init();

    return () => {
      destroyRef.current();
    };
  }, [channel.url]);

  // Heartbeat do canal — mesma quota de 1h/dia do VOD (rate-limit.js do
  // api.rar já trata /api/channels/:id/heartbeat exactamente como
  // /api/content/:id/heartbeat). Sem heartbeats como o VOD tinha, este é o
  // "relógio" novo para canais ao vivo — pedido explícito do user.
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!channel.id) return;

    const sendHeartbeat = async () => {
      const video = document.getElementById('channel-video') as HTMLVideoElement | null;
      if (!video || video.paused || video.ended) return;
      try {
        await channelsApi.heartbeat(channel.id);
      } catch (err: any) {
        if (err?.status === 409) {
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
          video.pause();
          onSessionReplaced(err?.data?.message || 'A sua sessão foi encerrada neste dispositivo.');
          return;
        }
        if (err?.status === 429) {
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
          video.pause();
          onFreeTimeExhausted(err?.data?.plans ?? [], err?.data?.message);
        }
        // outros erros (rede) — ignora, tenta de novo no próximo tick
      }
    };

    sendHeartbeat();
    // FIX: alinhado com HEARTBEAT_INTERVAL_MS em middleware/rate-limit.js
    // (120s, era 30s) — os dois lados têm de bater, porque o contador é
    // "flat accounting" (cada heartbeat credita um bloco fixo).
    heartbeatRef.current = setInterval(sendHeartbeat, 120_000);
    return () => {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    };
  }, [channel.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (shouldAutoFocus()) requestAnimationFrame(() => closeBtnRef.current?.focus({ preventScroll: true }));
  }, []);

  const modalContent = (
    <div
      data-tv-player
      role="dialog"
      aria-modal="true"
      data-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: '#000',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {channel.logo && (
          <img
            src={channel.logo}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              objectFit: 'contain',
              background: 'rgba(255,255,255,0.08)',
              padding: 3,
            }}
            onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', textShadow: '0 1px 5px rgba(0,0,0,0.9)' }}>
            {channel.name}
          </div>
          <span style={{ background: 'rgba(229,9,20,0.85)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
            AO VIVO
          </span>
        </div>
        <button
          ref={closeBtnRef}
          onClick={onClose}
          data-modal-close
          tabIndex={0}
          data-tv-focusable
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}
        >
          <CloseIcon style={{ fontSize: 20 }} />
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <video
          id="channel-video"
          controls
          playsInline
          tabIndex={0}
          data-tv-focusable
          onKeyDown={(e) => {
            const v = e.currentTarget;
            switch (e.key) {
              case 'ArrowUp':
                v.volume = Math.min(1, v.volume + 0.05); v.muted = false;
                e.preventDefault(); e.stopPropagation();
                break;
              case 'ArrowDown':
                v.volume = Math.max(0, v.volume - 0.05);
                e.preventDefault(); e.stopPropagation();
                break;
              case 'm': case 'M':
                v.muted = !v.muted;
                e.preventDefault(); e.stopPropagation();
                break;
            }
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
        />
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', gap: 14 }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 340 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ChannelsPage() {
  const { t }  = useTranslation();
  const user   = useAuthStore(s => s.user);
  const router = useRouter();

  const [channels,      setChannels]      = useState<any[]>([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [searching,     setSearching]     = useState(false);
  const [retrying,      setRetrying]      = useState(false);
  const [playing,       setPlaying]       = useState<any>(null);
  const [showRateLimit, setShowRateLimit] = useState(false);
  const [rateLimitPlans, setRateLimitPlans] = useState<UpsellPlan[]>([]);
  const [rateLimitMsg,   setRateLimitMsg]   = useState<string | undefined>(undefined);
  const [sessionReplacedMsg, setSessionReplacedMsg] = useState('');
  // Pedido explícito: o aviso abre automaticamente sempre que se entra em
  // "Sinal Aberto" (o ícone "?" continua a reabri-lo depois de fechado).
  const [showInfoModal, setShowInfoModal] = useState(true);
  const [loadingChannel, setLoadingChannel] = useState<string | null>(null);

  // ── Categorias ─────────────────────────────────────────────────────────────
  const [categories,       setCategories]       = useState<{ name: string; slug: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filtro por defeito ao entrar na página: canais da categoria real
  // "Animation" (nome exacto vindo do backend/menu suspenso — NÃO é a
  // string traduzida t('channels.filterAnime')="Anime", que não bate com
  // o nome real da categoria). Desliga-se automaticamente quando o
  // utilizador pesquisa ou escolhe manualmente outra categoria; pode ser
  // desligado à mão no botão "Todos".
  const [animeOnly, setAnimeOnly] = useState(true);
  const animeCategory = categories.find(c => normalizeStr(c.name) === normalizeStr('Animation')) ?? null;
  const effectiveCategory = (animeOnly && !search && !selectedCategory) ? (animeCategory?.slug ?? null) : selectedCategory;

  // Rodada 2 (set/2026): antes havia aqui um pedido extra só com `limit:1`
  // para obter o total SEM filtro de categoria (grandTotal), porque
  // `pagination.total` do carregamento normal reflete o filtro activo. A
  // API agora devolve `grand_total` (contagem de TODAS as categorias,
  // sempre) em toda resposta de /api/channels — reaproveitado directamente
  // em loadRegularChannels() abaixo, sem pedido nenhum a mais.
  const [grandTotal, setGrandTotal] = useState(0);

  const regularChannelsRef  = useRef<any[]>([]);
  const debounce   = useRef<any>(null);
  const retryTimer = useRef<any>(null);
  const mountedRef = useRef(true);

  // FIX (pesquisa de canais não funcionava): mountedRef.current era mexida
  // por dois efeitos diferentes. O efeito de categoria (mais abaixo) fazia
  // `mountedRef.current = false` no seu próprio cleanup, e esse cleanup
  // disparava sempre que `effectiveCategory` mudava — o que acontece todas
  // as vezes que se escreve no campo de pesquisa (search deixa de estar
  // vazio, effectiveCategory passa de "Animation" para null). O novo corpo
  // do efeito devolvia logo na 1ª linha (`if (search.trim()) return`), sem
  // voltar a pôr mountedRef.current = true. Resultado: no debounce da
  // pesquisa, `if (!mountedRef.current) return;` abortava sempre, antes de
  // sequer chamar searchChannels(). Agora só este efeito (montagem real do
  // componente) mexe em mountedRef; o efeito de categoria usa uma flag
  // local (`cancelled`) só para o próprio cleanup.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Carrega lista de categorias uma vez
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  useEffect(() => {
    getCategories().catch(() => ({ categories: [] })).then((res: any) => {
      if (!mountedRef.current) return;
      setCategories(res.categories ?? []);
      setCategoriesLoaded(true);
    });
  }, []);

  // Sem pré-fetch/priorização por palavras-chave — mostra directamente o
  // que vem da playlist (mesma decisão já aplicada no Flutter).
  const mergeAndDisplay = useCallback((_pg: number, searchActive: boolean) => {
    if (searchActive) return;
    setChannels(regularChannelsRef.current);
  }, []);

  const loadRegularChannels = useCallback(async (pg: number): Promise<void> => {
    try {
      const params: { page: number; limit: number; category?: string; hasUser: boolean } = { page: pg, limit: LIMIT, hasUser: !!user };
      if (effectiveCategory) params.category = effectiveCategory;

      const res = await listChannels(params);
      if (!mountedRef.current) return;
      if (res.loading) {
        setRetrying(true);
        retryTimer.current = setTimeout(() => loadRegularChannels(pg), 2000);
        return;
      }
      let pageChs = res.channels ?? [];
      let pageTotal = res.pagination?.total ?? pageChs.length;
      let pageTotalPages = res.pagination?.pages ?? 1;

      // No filtro por defeito (Anime + com ícone), o "com ícone" não é um
      // critério do backend — filtra-se aqui. O total/paginação continuam
      // a refletir a categoria "Anime" completa (com e sem ícone), por
      // isso o número de cartões visíveis numa página pode ser < LIMIT.
      if (animeOnly && !search && !selectedCategory) {
        pageChs = pageChs.filter((ch: any) => !!ch.logo);
      }

      regularChannelsRef.current = pageChs;
      setTotal(pageTotal);
      setTotalPages(pageTotalPages);
      // grand_total vem em toda resposta de listChannels(), independente do
      // filtro de categoria activo — substitui o pedido extra que existia.
      setGrandTotal(res?.grand_total ?? 0);
      setRetrying(false);
    } catch {
      if (!mountedRef.current) return;
      toast.error(t('errors.networkError'));
    }
  }, [t, effectiveCategory, animeOnly, search, selectedCategory, user]);

  // Re-carrega quando muda a categoria efetiva (manual ou o filtro PT por defeito).
  // Ignora enquanto há uma pesquisa activa — esse caso é tratado no efeito
  // de pesquisa abaixo, para não sobrepor os resultados da pesquisa.
  useEffect(() => {
    if (search.trim()) return;
    if (!categoriesLoaded) return; // espera a lista de categorias antes do 1º fetch, para já entrar com o slug PT certo
    let cancelled = false;
    const initialize = async () => {
      setLoading(true);
      setPage(1);
      await loadRegularChannels(1);
      if (cancelled || !mountedRef.current) return;
      mergeAndDisplay(1, false);
      setLoading(false);
    };
    initialize();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer.current);
    };
  }, [effectiveCategory, categoriesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page === 1 || search) return;
    const run = async () => {
      setLoading(true);
      await loadRegularChannels(page);
      if (mountedRef.current) { mergeAndDisplay(page, false); setLoading(false); }
    };
    run();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!search.trim()) { mergeAndDisplay(page, false); return; }
    debounce.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setSearching(true);
      try {
        const res = await searchChannels(search.trim(), !!user);
        if (!mountedRef.current) return;
        setChannels(res.channels ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(1);
      } catch {
        if (!mountedRef.current) return;
        toast.error(t('errors.networkError'));
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, 500);
    return () => clearTimeout(debounce.current);
  }, [search, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChannelClick = async (ch: any) => {
    if (!user) { router.push(loginRedirectUrl()); return; }
    if (ch.locked || !ch.has_access) {
      toast('Canal premium. Assine para assistir.', { icon: '🔒' });
      return;
    }
    if (!ch.url) { toast.error('Stream indisponível.'); return; }
    setLoadingChannel(ch.id);
    try {
      // FIX (arquitetura): o URL já vem do client (playlist.m3u buscado
      // directamente do jsDelivr, ver lib/channels-source.ts) — channelsApi.get
      // deixou de devolver dados do canal, serve só de "gate": valida limite
      // de ecrãs/quota diária no servidor ANTES de reproduzir (mesma lógica
      // do content /stream). Se passar, reproduz com o URL que já tínhamos.
      await channelsApi.get(ch.id);
      setPlaying(ch);
    } catch (err: any) {
      if (err?.status === 429) {
        setRateLimitPlans(err?.data?.plans ?? []);
        setShowRateLimit(true);
      } else {
        toast.error(err?.data?.message || 'Erro ao carregar canal.');
      }
    } finally {
      setLoadingChannel(null);
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    mergeAndDisplay(page, false);
  };

  if (loading && channels.length === 0) {
    return (
      <div>
        <ChannelsGridSkeleton count={12} />
      </div>
    );
  }

  return (
    <div>
      {playing && (
        <ChannelPlayer
          channel={playing}
          onClose={() => setPlaying(null)}
          onFreeTimeExhausted={(plans, message) => { setPlaying(null); setRateLimitPlans(plans); setRateLimitMsg(message); setShowRateLimit(true); }}
          onSessionReplaced={(message) => { setPlaying(null); setSessionReplacedMsg(message); }}
        />
      )}

      {showRateLimit && (
        <RateLimitModal
          plans={rateLimitPlans}
          message={rateLimitMsg}
          onClose={() => setShowRateLimit(false)}
          onUpgrade={(planId) => { setShowRateLimit(false); router.push(`/main/plans?highlight=${planId}`); }}
        />
      )}

      {sessionReplacedMsg && (
        <SessionReplacedModal
          message={sessionReplacedMsg}
          onClose={() => setSessionReplacedMsg('')}
        />
      )}

      {showInfoModal && (
        <div role="dialog" aria-modal="true" data-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowInfoModal(false)}>
          <div style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, marginBottom: 12 }}>{t('channels.infoTitle')}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>{t('channels.infoBody1')}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {t('channels.infoBody2')}{' '}
              <a href={COMMUNITY_REPO_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}>
                {t('channels.infoMore')}
              </a>
            </p>
            <button className="btn btn-primary" data-modal-close autoFocus={shouldAutoFocus()} style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} onClick={() => setShowInfoModal(false)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {/* FIX (redundância entre navegação e página, pedido explícito): o
          nome desta secção ("Sinal Aberto") já aparece no sidebar/bottom-nav
          — o <h1> a repeti-lo foi removido. Fica só o ícone + a info
          essencial (total de canais, filtro activo) + o botão de info,
          agora na mesma linha do que era a subtitle. */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LiveTvIcon style={{ color: 'var(--color-primary)', fontSize: 24 }} />
          <p className="page-subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {grandTotal.toLocaleString()} {t('channels.available')}
            {selectedCategory && (
              <span style={{ color: 'var(--color-primary)', textTransform: 'capitalize' }}>
                · {selectedCategory}
              </span>
            )}
            {animeOnly && !search && !selectedCategory && (
              <span style={{ color: 'var(--color-primary)' }}>
                · {t('channels.filterAnime')}
              </span>
            )}
            <button onClick={() => setShowInfoModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }} aria-label={t('channels.infoTitle')}>
              <InfoOutlinedIcon style={{ fontSize: 16 }} />
            </button>
          </p>
        </div>
      </div>

      {/* ── Barra de filtros: pesquisa + categoria ─────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0, maxWidth: 380 }}>
          <SearchIcon
            style={{
              position: 'absolute', left: 11, top: '50%',
              transform: 'translateY(-50%)', fontSize: 16,
              color: 'var(--color-text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 34, height: 38, width: '100%' }}
            placeholder={t('search.placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {searching && (
            <span className="spinner spinner-sm" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />
          )}
          {search && !searching && (
            <button
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
              onClick={handleClearSearch}
            >
              <CloseIcon style={{ fontSize: 16 }} />
            </button>
          )}
        </div>

        {/* Category dropdown — só mostra quando há categorias carregadas */}
        {categories.length > 0 && (
          <CategoryDropdown
            categories={categories}
            selected={selectedCategory}
            onChange={slug => { setSearch(''); setSelectedCategory(slug); setAnimeOnly(false); setPage(1); }}
          />
        )}

        {/* Alterna entre o filtro por defeito (Anime + com ícone) e a lista completa */}
        {!search && (
          <button
            onClick={() => { setSearch(''); setAnimeOnly(o => !o); setSelectedCategory(null); setPage(1); }}
            style={{
              height: 38,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: animeOnly && !selectedCategory ? 'rgba(229,9,20,0.1)' : 'var(--color-card)',
              border: `1px solid ${animeOnly && !selectedCategory ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              color: animeOnly && !selectedCategory ? 'var(--color-primary)' : 'var(--color-text)',
              fontSize: '0.825rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {animeOnly && !selectedCategory ? t('channels.filterAnime') : t('channels.filterAll')}
          </button>
        )}
      </div>

      {retrying && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
          <div className="loading-ring" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.875rem' }}>Carregando canais...</p>
        </div>
      )}

      {loading && !retrying ? (
        <ChannelsGridSkeleton count={12} />
      ) : channels.length === 0 && !retrying ? (
        <div className="empty-state">
          <div className="empty-icon"><LiveTvIcon style={{ fontSize: 28 }} /></div>
          <div className="empty-title">
            {search ? 'Nenhum canal encontrado' : t('channels.noChannels')}
          </div>
          {(search || selectedCategory || animeOnly) && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => { handleClearSearch(); setSelectedCategory(null); setAnimeOnly(false); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="channels-grid">
            {channels.map(ch => {
              const isPlaying = playing?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className={`channel-card ${isPlaying ? 'playing' : ''}`}
                  style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative', aspectRatio: '16/9' }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleChannelClick(ch)}
                >
                  {ch.logo ? (
                    <img
                      src={ch.logo}
                      alt={ch.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) parent.style.background = 'var(--color-card-hover)';
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--color-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LiveTvIcon style={{ fontSize: 28, color: 'var(--color-text-muted)' }} />
                    </div>
                  )}

                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />

                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      {ch.name}
                    </div>
                    {ch.group && (
                      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.65)', marginTop: 2, textTransform: 'capitalize' }}>
                        {ch.group}
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    {loadingChannel === ch.id ? (
                      <span style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '3px 7px', display: 'flex', alignItems: 'center' }}>
                        <span className="spinner spinner-sm" />
                      </span>
                    ) : ch.locked || !ch.has_access ? (
                      <span style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '3px 7px', fontSize: '0.62rem', fontWeight: 700, color: '#a0a0a0', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <LockIcon style={{ fontSize: 11 }} /> Premium
                      </span>
                    ) : isPlaying ? (
                      <span style={{ background: 'rgba(229,9,20,0.85)', borderRadius: 4, padding: '3px 7px', fontSize: '0.62rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div className="live-dot" /> AO VIVO
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '3px 7px', fontSize: '0.62rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PlayArrowIcon style={{ fontSize: 12 }} /> {t('channels.watch')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!search && totalPages > 1 && (
            <div className="table-pagination" style={{ justifyContent: 'center', marginTop: 24, border: 'none' }}>
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeftIcon style={{ fontSize: 15 }} />
              </button>
              <span className="page-info">Pág. {page} / {totalPages}</span>
              <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRightIcon style={{ fontSize: 15 }} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}