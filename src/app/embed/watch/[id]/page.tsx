'use client';
import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ShakaPlayer from '@/components/player/ShakaPlayer';

// app/embed/watch/[id]/page.tsx
//
// Página de embed para o app mobile: renderiza o componente ShakaPlayer
// REAL, sem NENHUMA alteração à sua lógica interna — zero transcrição,
// zero reimplementação. O mobile carrega este URL numa WebView, passando
// token/poster/episode por query string; o componente cuida do resto
// exactamente como já faz no site (handshake ECDH, hls.js, BinLoader,
// heartbeat, tudo inalterado).
//
// Propositalmente FORA de /main/ — o layout de /main/ (main/layout.tsx)
// exige o Zustand auth store hidratado a partir do localStorage e
// redirecciona para /auth/login se não encontrar token aí. O ShakaPlayer
// não depende do auth store — só precisa do token como prop — por isso
// esta página não precisa (nem deve) daquele layout.
//
// Eventos do player são repassados à app Flutter via o JavaScript channel
// 'PixgoBridge' (window.PixgoBridge.postMessage), com o mesmo formato que
// o watch_screen.dart já espera.

function bridge(msg: Record<string, any>) {
  try {
    (window as any).PixgoBridge?.postMessage(JSON.stringify(msg));
  } catch { /* channel pode não estar pronto ainda */ }
}

export default function EmbedWatchPage() {
  const { id }   = useParams<{ id: string }>();
  const sp       = useSearchParams();

  const token         = sp.get('token')      || '';
  const poster        = sp.get('poster')     || undefined;
  const episode       = sp.get('episode')    || undefined;
  const nextEpisodeId = sp.get('nextEpisodeId') || undefined;
  const startTime     = Number(sp.get('startTime') || '0') || 0;

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.pixgo.qzz.io';

  const streamApiUrl = useMemo(() => {
    const base = `${API_BASE}/api/content/${id}/stream`;
    return episode ? `${base}?episode=${episode}` : base;
  }, [id, episode]);

  if (!token) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Token em falta.
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShakaPlayer
        streamApiUrl={streamApiUrl}
        token={token}
        poster={poster}
        startTime={startTime}
        autoPlay
        onTimeUpdate={(current, duration) => bridge({ type: 'progress', currentTime: current, duration })}
        onEnded={() => bridge({ type: 'ended' })}
        onNextEpisode={() => {
          if (nextEpisodeId) {
            bridge({ type: 'next_episode', episodeId: nextEpisodeId });
          }
        }}
        onFreeTimeExhausted={(plans, message) => bridge({ type: 'freetime_exhausted', plans, message })}
        onSessionReplaced={(message) => bridge({ type: 'session_replaced', message })}
      />
    </div>
  );
}
