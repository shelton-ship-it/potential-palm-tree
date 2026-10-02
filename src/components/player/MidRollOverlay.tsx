'use client';
import React, { useEffect, useRef, useState } from 'react';
import { adsApi } from '@/lib/api';
import { fetchVastPod, firePixels, fireTrackingEvent, fireVastError, type VastAd } from '@/lib/vast';
import type { ShakaPlayerHandle } from './ShakaPlayer';

// components/player/MidRollOverlay.tsx
//
// Mid-roll VAST 3.0 HilltopAds (zona 7373461) a cada MIDROLL_INTERVAL de
// tempo de reprodução EFECTIVO (currentTime do vídeo — nunca tempo absoluto
// da página), com protecção contra seek e ad pod (até MAX_ADS_PER_MIDROLL
// anúncios por interrupção). Nunca recarrega/reinicia o HLS: o <ShakaPlayer>
// continua montado o tempo todo, este overlay só pausa/retoma (via o handle
// mínimo pause()/play()) e sobrepõe o anúncio visualmente por cima.
//
// Plug-and-play, mesma regra de sempre: só liga com show_ads:true,
// 'mid-roll' no formats da plataforma, e uma zona VAST configurada
// (ver lib/ad-network.js — HILLTOPADS_VAST_TAG_URL).

// ── Configuração (declarativa, no topo do ficheiro) ─────────────────────────
export const MIDROLL_INTERVAL      = 10 * 60; // 10 minutos de reprodução efectiva (era 20)
export const MAX_ADS_PER_MIDROLL   = 2;        // pod: no máx. 2 anúncios por corte
export const PREFETCH_LEAD_S       = 60;       // começa a buscar o VAST 60s antes do corte

const MIN_DURATION_S        = 60;  // conteúdo mais curto que isto nunca tem mid-roll
const END_BUFFER_S          = 15;  // não dispara um ponto a menos de 15s do fim
const SEEK_JUMP_THRESHOLD_S = 3;   // delta de currentTime maior que isto = seek, não playback normal
const AD_FETCH_TIMEOUT_MS   = 4000;
const AD_HARD_TIMEOUT_MS    = 30000; // trava dura por anúncio do pod — nunca deixa o utilizador preso

// Gera os pontos de corte periódicos (20, 40, 60, 80, 100min...) até onde a
// duração do conteúdo permitir — não é uma lista fixa, cresce com o vídeo.
function eligibleMidrollPoints(duration: number): number[] {
  const points: number[] = [];
  for (let t = MIDROLL_INTERVAL; t < duration - END_BUFFER_S; t += MIDROLL_INTERVAL) points.push(t);
  return points;
}

interface AdsConfig {
  vastUrl: string | null;
  eligible: boolean;
}

// Estado do anúncio, separado de propósito do estado do conteúdo (currentTime/
// duration continuam a viver no watch/[id]/page.tsx via props, como já era).
interface AdState {
  playing:         boolean;
  type:            'midroll' | null;
  currentMidroll:  number | null;   // índice dentro dos pontos elegíveis
  playedMidrolls:  Set<number>;     // índices já tocados/pulados — nunca repete
  contentPosition: number;          // posição do conteúdo no momento do corte
}

function freshAdState(): AdState {
  return { playing: false, type: null, currentMidroll: null, playedMidrolls: new Set(), contentPosition: 0 };
}

interface Props {
  currentTime: number;
  duration:    number;
  playerRef:   React.RefObject<ShakaPlayerHandle | null>;
  enabled?:    boolean;
}

export default function MidRollOverlay({ currentTime, duration, playerRef, enabled = true }: Props) {
  const [adUrl, setAdUrl]         = useState<string | null>(null);
  const [skipAt, setSkipAt]       = useState<number | null>(null); // segundos, no tempo do PRÓPRIO anúncio
  const [canSkip, setCanSkip]     = useState(false);
  const [podLabel, setPodLabel]   = useState<string | null>(null); // "Anúncio 1/2", só exibido quando pod > 1

  const configRef      = useRef<AdsConfig | null>(null);
  const adStateRef     = useRef<AdState>(freshAdState());
  const lastTimeRef    = useRef(0);
  const triggeringRef  = useRef(false);
  const adRef          = useRef<VastAd | null>(null);
  const firedQuartiles = useRef<Set<string>>(new Set());
  const podAdsRef      = useRef<VastAd[]>([]);
  const podIndexRef    = useRef(0);
  // FIX (pré-carregamento): guarda o fetch do PRÓXIMO mid-roll já em curso,
  // iniciado PREFETCH_LEAD_S antes do corte — quando triggerMidroll() chega,
  // o anúncio já pode estar pronto, sem espera perceptível.
  const prefetchRef    = useRef<{ idx: number; promise: Promise<VastAd[]> } | null>(null);

  // Carrega a config (uma vez por montagem — o cache de 30s em adsApi.status()
  // já evita requests repetidos entre AdPrerollGate/MidRollOverlay/etc).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    adsApi.status().then(ctx => {
      if (cancelled) return;
      configRef.current = {
        vastUrl:  ctx?.network?.vast_midroll_url || ctx?.network?.vast_url || null,
        eligible: !!ctx.show_ads && Array.isArray(ctx.formats) && ctx.formats.includes('mid-roll'),
      };
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  // ── Detecção de pontos de corte (a cada MIDROLL_INTERVAL) + protecção
  // contra seek ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { lastTimeRef.current = currentTime; return; }
    const cfg = configRef.current;
    const prev = lastTimeRef.current;

    if (!cfg?.eligible || !cfg.vastUrl || !duration || duration < MIN_DURATION_S) {
      lastTimeRef.current = currentTime;
      return;
    }

    const eligiblePoints = eligibleMidrollPoints(duration);
    const delta = currentTime - prev;
    const isSeek = Math.abs(delta) > SEEK_JUMP_THRESHOLD_S;

    if (isSeek) {
      // Seek pra FRENTE (ex: 10:00 -> 50:00): os pontos de 20:00/40:00 que
      // ficaram entre a posição antiga e a nova são marcados como "vistos"
      // sem tocar anúncio nenhum — não dispara em catch-up. Seek pra TRÁS
      // não desmarca nada — o Set impede repetir um mid-roll já tocado de
      // verdade, mesmo se o utilizador voltar atrás.
      if (delta > 0) {
        eligiblePoints.forEach((t, idx) => {
          if (t > prev && t <= currentTime && !adStateRef.current.playedMidrolls.has(idx)) {
            adStateRef.current.playedMidrolls.add(idx);
            console.log(`[midroll] evento=seek_skip ponto=#${idx} (${t}s) — marcado como visto, sem anúncio`);
          }
        });
      }
      // Um seek muda qual é o "próximo" ponto — descarta qualquer prefetch
      // em curso (não é desperdício grave, é só 1 fetch VAST a menos de
      // reaproveitar; o próximo tick do effect prefetcha o ponto certo).
      prefetchRef.current = null;
      lastTimeRef.current = currentTime;
      return;
    }

    lastTimeRef.current = currentTime;

    // FIX (pré-carregamento): assim que faltar PREFETCH_LEAD_S para o
    // próximo corte ainda não tocado, começa a buscar o VAST em background
    // — não espera o triggerMidroll() chegar pra só então pedir o anúncio.
    const nextIdx = eligiblePoints.findIndex((t, i) => !adStateRef.current.playedMidrolls.has(i) && t > currentTime);
    if (nextIdx !== -1) {
      const t = eligiblePoints[nextIdx];
      if ((t - currentTime) <= PREFETCH_LEAD_S && prefetchRef.current?.idx !== nextIdx) {
        console.log(`[midroll] evento=prefetch_iniciado ponto=#${nextIdx} (${t}s), faltam ${(t - currentTime).toFixed(0)}s`);
        prefetchRef.current = { idx: nextIdx, promise: fetchVastPod(cfg.vastUrl!, MAX_ADS_PER_MIDROLL, AD_FETCH_TIMEOUT_MS) };
      }
    }

    if (adStateRef.current.playing || triggeringRef.current) return;

    const idx = eligiblePoints.findIndex((t, i) => t > prev && t <= currentTime && !adStateRef.current.playedMidrolls.has(i));
    if (idx === -1) return;

    triggerMidroll(idx, eligiblePoints[idx], cfg.vastUrl!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, enabled]);

  // ── Trava dura por anúncio do pod — nunca deixa o utilizador preso ───────
  useEffect(() => {
    if (!adUrl) return;
    const t = setTimeout(() => {
      console.log('[midroll] evento=timeout — avançando pod/retomando conteúdo');
      advancePodOrFinish('timeout');
    }, AD_HARD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adUrl]);

  function triggerMidroll(idx: number, timestampSec: number, vastUrl: string) {
    triggeringRef.current = true;
    adStateRef.current.playing         = true;
    adStateRef.current.type            = 'midroll';
    adStateRef.current.currentMidroll  = idx;
    adStateRef.current.contentPosition = timestampSec;

    console.log(`[midroll] evento=cue_point_atingido ponto=#${idx} (${timestampSec}s) — a pedir VAST (pod até ${MAX_ADS_PER_MIDROLL})`);
    playerRef.current?.pause();

    // Usa o prefetch já em curso (ou já resolvido) se for exactamente para
    // este ponto de corte — caso contrário (prefetch não chegou a tempo, ex:
    // seek ou início de sessão sem os 60s de antecedência), refaz o fetch
    // normal na hora, como antes.
    const prefetched = prefetchRef.current?.idx === idx ? prefetchRef.current.promise : null;
    prefetchRef.current = null;
    const adsPromise = prefetched || fetchVastPod(vastUrl, MAX_ADS_PER_MIDROLL, AD_FETCH_TIMEOUT_MS);

    // UMA única requisição — nunca refaz o pedido pra "completar" o pod;
    // usa exactamente os <Ad> que essa resposta trouxer (0, 1 ou mais).
    adsPromise.then(ads => {
      if (!ads.length) {
        console.log('[midroll] evento=ausencia_de_anuncio — retomando conteúdo');
        finish('no-fill');
        return;
      }
      console.log(`[midroll] evento=vast_carregado pod=${ads.length}/${MAX_ADS_PER_MIDROLL}`);
      podAdsRef.current = ads;
      podIndexRef.current = 0;
      playPodAd(0);
    }).catch(() => {
      console.log('[midroll] evento=erro_vast — retomando conteúdo');
      finish('error');
    });
  }

  function playPodAd(i: number) {
    const ad = podAdsRef.current[i];
    if (!ad) { finish('complete'); return; } // guarda de segurança, não deve acontecer
    adRef.current = ad;
    firedQuartiles.current = new Set();
    firePixels(ad.impressions);
    setSkipAt(ad.skipOffsetSeconds);
    setCanSkip(false);
    setPodLabel(podAdsRef.current.length > 1 ? `Anúncio ${i + 1}/${podAdsRef.current.length}` : null);
    setAdUrl(ad.mediaUrl);
  }

  // Avança pro próximo anúncio do pod já obtido, ou encerra se não houver
  // mais nenhum — nunca espera por um "segundo anúncio" que não veio na
  // resposta original, e nunca refaz um pedido VAST pra tentar arranjar um.
  function advancePodOrFinish(reason: 'complete' | 'error' | 'timeout' | 'skip') {
    const next = podIndexRef.current + 1;
    if (next < podAdsRef.current.length) {
      podIndexRef.current = next;
      playPodAd(next);
    } else {
      finish(reason);
    }
  }

  function finish(reason: 'complete' | 'error' | 'timeout' | 'skip' | 'no-fill') {
    if (!adStateRef.current.playing) return; // já terminou por outro caminho (evita corrida onEnded/timeout)
    const idx = adStateRef.current.currentMidroll;
    if (idx !== null) adStateRef.current.playedMidrolls.add(idx);
    adStateRef.current.playing        = false;
    adStateRef.current.type           = null;
    adStateRef.current.currentMidroll = null;
    triggeringRef.current = false;
    adRef.current = null;
    podAdsRef.current = [];
    podIndexRef.current = 0;
    setAdUrl(null);
    setSkipAt(null);
    setCanSkip(false);
    setPodLabel(null);
    console.log(`[midroll] evento=encerramento motivo=${reason} — retomando conteúdo`);
    playerRef.current?.play();
  }

  function handleAdPlay() {
    console.log(`[midroll] evento=anuncio_iniciado (${podIndexRef.current + 1}/${podAdsRef.current.length})`);
    fireTrackingEvent(adRef.current, 'start');
  }

  function handleAdTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
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

  function handleAdEnded() {
    console.log('[midroll] evento=anuncio_concluido');
    fireTrackingEvent(adRef.current, 'complete');
    advancePodOrFinish('complete');
  }

  function handleAdError() {
    console.log('[midroll] evento=erro_vast (falha ao tocar o media file do pod)');
    fireVastError(adRef.current, 901);
    advancePodOrFinish('error'); // segundo ad inválido/inexistente -> não bloqueia, segue ou encerra
  }

  function handleSkip() {
    console.log('[midroll] evento=anuncio_pulado');
    fireTrackingEvent(adRef.current, 'skip');
    advancePodOrFinish('skip');
  }

  if (!adUrl) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#000' }}>
      <video
        src={adUrl}
        autoPlay
        playsInline
        onPlay={handleAdPlay}
        onTimeUpdate={handleAdTimeUpdate}
        onEnded={handleAdEnded}
        onError={handleAdError}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute', top: 10, left: 10, padding: '3px 9px', borderRadius: 5,
        background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11,
      }}>
        {podLabel || 'Anúncio'}
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
