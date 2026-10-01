'use client';
import React, { useEffect, useRef, useState } from 'react';
import { adsApi } from '@/lib/api';
import { fetchVastAd, firePixels, fireTrackingEvent, fireVastError, type VastAd } from '@/lib/vast';
import { consumePrefetchedPreroll } from '@/lib/adPrefetch';

// components/player/AdPrerollGate.tsx
//
// Toca o anúncio pre-roll (VAST 3.0, HilltopAds — zona 7373461) ANTES do
// conteúdo — de propósito SEM tocar em nada do ShakaPlayer.tsx (handshake
// ECDH + HLS.js customizado ali dentro é delicado demais pra misturar com
// lógica de anúncio). Isto é só um wrapper: mostra o anúncio, e só depois
// monta o player normal como `children` — o conteúdo NUNCA começa junto
// com o pre-roll.
//
// Plug-and-play: só liga quando `ads.show_ads:true` E `ads.network.vast_preroll_url`
// estiver configurado no backend (ver lib/ad-network.js — hoje resolve pra
// HILLTOPADS_VAST_TAG_URL, com Adsterra como fallback automático). Até lá
// (nenhuma zona configurada ainda), o conteúdo aparece direto, como hoje.
//
// Fail-safe em cada etapa — um anúncio NUNCA pode impedir o conteúdo de
// tocar: falha no fetch, XML inválido, MediaFile ausente, erro no <video>
// do anúncio, ou um timeout duro de 30s — qualquer um destes salta direto
// pro conteúdo.

const AD_HARD_TIMEOUT_MS = 30000;
export const PREROLL_MAX_ADS = 1; // pre-roll nunca usa pod — sempre 1 único anúncio

interface Props {
  /** Se false, nunca mostra pre-roll (ex: trailers curtos, embed) */
  enabled?: boolean;
  children: React.ReactNode;
}

export default function AdPrerollGate({ enabled = true, children }: Props) {
  const [phase, setPhase]     = useState<'checking' | 'ad' | 'content'>(enabled ? 'checking' : 'content');
  const [adUrl, setAdUrl]     = useState<string | null>(null);
  const [skipAt, setSkipAt]   = useState<number | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const skippedRef      = useRef(false);
  const adRef            = useRef<VastAd | null>(null);
  const firedQuartiles   = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) { setPhase('content'); return; }
    let cancelled = false;

    (async () => {
      try {
        // FIX (pré-carregamento): se a página de conteúdo já disparou o
        // prefetch (ver app/main/content/[id]/page.tsx + lib/adPrefetch.ts)
        // e ele ainda estiver fresco, usa-o directo — sem esperar por
        // adsApi.status() nem por fetchVastAd() de novo. Se não houver
        // prefetch (ex: utilizador chegou aqui por link directo, sem passar
        // pela página de detalhes), cai exactamente no fluxo de sempre.
        const prefetched = await consumePrefetchedPreroll();
        let ad: VastAd | null = prefetched;

        if (!ad) {
          const ctx = await adsApi.status();
          const vastUrl = ctx?.network?.vast_preroll_url || ctx?.network?.vast_url;
          const supportsPreroll = Array.isArray(ctx?.formats) && ctx.formats.includes('pre-roll');

          if (!ctx.show_ads || !vastUrl || !supportsPreroll) {
            if (!cancelled) setPhase('content');
            return;
          }

          ad = await fetchVastAd(vastUrl);
        }

        if (!ad) {
          console.log('[preroll] evento=ausencia_de_anuncio — iniciando conteúdo');
          if (!cancelled) setPhase('content');
          return;
        }

        console.log('[preroll] evento=vast_carregado');
        adRef.current = ad;
        firedQuartiles.current = new Set();
        firePixels(ad.impressions);

        if (!cancelled) {
          setSkipAt(ad.skipOffsetSeconds);
          setAdUrl(ad.mediaUrl);
          setPhase('ad');
        }
      } catch {
        console.log('[preroll] evento=erro_vast — iniciando conteúdo');
        if (!cancelled) setPhase('content');
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (phase !== 'ad') return;
    const hardTimeout = setTimeout(() => {
      console.log('[preroll] evento=timeout — iniciando conteúdo');
      finishAd();
    }, AD_HARD_TIMEOUT_MS);
    return () => clearTimeout(hardTimeout);
  }, [phase]);

  function finishAd() {
    if (skippedRef.current) return;
    skippedRef.current = true;
    adRef.current = null;
    setPhase('content');
  }

  function handlePlay() {
    console.log('[preroll] evento=anuncio_iniciado');
    fireTrackingEvent(adRef.current, 'start');
  }

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const el = e.currentTarget;
    if (!el.duration || !Number.isFinite(el.duration)) return;
    const pct = el.currentTime / el.duration;

    const quartile = pct >= 0.98 ? 'complete' : pct >= 0.75 ? 'thirdQuartile' : pct >= 0.5 ? 'midpoint' : pct >= 0.25 ? 'firstQuartile' : null;
    if (quartile && quartile !== 'complete' && !firedQuartiles.current.has(quartile)) {
      firedQuartiles.current.add(quartile);
      fireTrackingEvent(adRef.current, quartile);
    }

    if (skipAt !== null && el.currentTime >= skipAt && !canSkip) setCanSkip(true);
  }

  function handleEnded() {
    console.log('[preroll] evento=anuncio_concluido');
    fireTrackingEvent(adRef.current, 'complete');
    finishAd();
  }

  function handleError() {
    console.log('[preroll] evento=erro_vast (falha ao tocar o media file)');
    fireVastError(adRef.current, 901);
    finishAd();
  }

  function handleSkip() {
    console.log('[preroll] evento=anuncio_pulado');
    fireTrackingEvent(adRef.current, 'skip');
    finishAd();
  }

  if (phase === 'checking') {
    return (
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-ring" />
      </div>
    );
  }

  if (phase === 'ad' && adUrl) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
        <video
          src={adUrl}
          autoPlay
          playsInline
          onPlay={handlePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleError}
          style={{ width: '100%', height: '100%' }}
        />
        <div style={{
          position: 'absolute', top: 10, left: 10, padding: '3px 9px', borderRadius: 5,
          background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11,
        }}>
          Anúncio
        </div>
        {canSkip && (
          <button
            onClick={handleSkip}
            style={{
              position: 'absolute', bottom: 14, right: 14, padding: '7px 14px', borderRadius: 6,
              background: 'rgba(0,0,0,.75)', color: '#fff', fontSize: 12, border: '1px solid rgba(255,255,255,.3)',
              cursor: 'pointer',
            }}
          >
            Pular anúncio ▶
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
