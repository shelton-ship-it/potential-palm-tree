'use client';
/**
 * /offline-player — reprodução de downloads GARANTIDAMENTE sem rede.
 *
 * Porque não usar /main/watch/[id]?offline=1 para isto? Porque essa é uma
 * rota dinâmica do App Router: mesmo sendo um Client Component, a PRIMEIRA
 * visita a um [id] novo ainda depende de o Next.js buscar o payload da
 * rota (RSC/chunk específico) — se isso nunca foi pré-carregado enquanto
 * havia rede, não há como o Service Worker adivinhar esse pedido (os
 * nomes dos ficheiros só existem depois do build, com hash). Resultado:
 * sem rede E sem essa rota já visitada antes, a página fica em branco ou
 * cai no /offline — foi o bug reportado.
 *
 * Esta página resolve isso por ser uma URL FIXA e sem parâmetro de rota
 * dinâmica (o id vem por query string, lido em runtime): sendo fixa, entra
 * em STATIC_URLS do sw.js e o próprio cacheFirst() do SW já guarda os seus
 * chunks JS na primeira vez que é aberta (basta abri-la uma vez com rede,
 * nem que seja automaticamente a seguir a um download). A partir daí, é
 * 100% local — lê tudo do IndexedDB (getDownloadMeta) e nunca chama
 * contentApi/API nenhuma.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ShakaPlayer from '@/components/player/ShakaPlayer';
import { getDownloadMeta } from '@/lib/downloads';

type Phase = 'loading' | 'ready' | 'not-found';

export default function OfflinePlayerPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('id') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [meta, setMeta]   = useState<any>(null);

  useEffect(() => {
    if (!id) { setPhase('not-found'); return; }
    let cancelled = false;
    getDownloadMeta(id)
      .then(m => {
        if (cancelled) return;
        if (m?.keyHex && m?.hasInit) { setMeta(m); setPhase('ready'); }
        else setPhase('not-found');
      })
      .catch(() => { if (!cancelled) setPhase('not-found'); });
    return () => { cancelled = true; };
  }, [id]);

  if (phase === 'loading') {
    return (
      <div className="auth-page">
        <div className="loading-ring" />
      </div>
    );
  }

  if (phase === 'not-found') {
    return (
      <div className="auth-page">
        <div className="auth-card scale-in" style={{ textAlign: 'center' }}>
          <h1 className="auth-title">Download não encontrado</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Este título não está descarregado neste dispositivo, ou o download é antigo
            (feito antes de suportarmos reprodução 100% offline).
          </p>
          <button className="auth-btn" onClick={() => router.push('/main/downloads')}>Ver meus downloads</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <ShakaPlayer
        offlinePlayback={{ contentId: id, keyHex: meta.keyHex, segCount: meta.segCount }}
        poster={meta.poster}
        onClose={() => router.push('/main/downloads')}
      />
    </div>
  );
}
