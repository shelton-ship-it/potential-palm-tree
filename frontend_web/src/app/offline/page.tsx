'use client';
/**
 * /offline — fallback do Service Worker (public/sw.js) quando uma navegação
 * falha por falta de rede e a página pedida não estava em cache. Antes
 * disto, o SW devolvia texto plano sem estilo ("Offline", 503) para
 * QUALQUER página não cacheada — agora só entra aqui como último recurso
 * (ver NAV_FALLBACK/cacheFirst no sw.js), e dá acesso directo aos downloads
 * já guardados, que continuam a funcionar sem rede (ShakaPlayer lê-os do
 * IndexedDB via offlinePlayback — ver watch/[id]/page.tsx).
 */

import Link from 'next/link';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';

export default function OfflinePage() {
  return (
    <div className="auth-page">
      <div className="auth-card scale-in" style={{ textAlign: 'center' }}>
        <WifiOffIcon style={{ fontSize: 44, color: 'var(--color-text-muted)' }} />
        <h1 className="auth-title" style={{ marginTop: 12 }}>Sem ligação à internet</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Não foi possível carregar esta página offline.
        </p>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Os conteúdos já descarregados continuam disponíveis para ver sem rede.
        </p>

        <Link href="/main/downloads" className="auth-btn">
          <DownloadDoneIcon style={{ fontSize: 18 }} />
          Ver meus downloads
        </Link>

        <button
          className="auth-btn"
          style={{ background: 'transparent', border: '1px solid var(--color-border)', marginTop: 10 }}
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
