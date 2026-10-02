'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { listDownloads, deleteDownload } from '@/lib/downloads';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MovieIcon from '@mui/icons-material/Movie';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function DownloadsPage() {
  const router = useRouter();
  const { t }  = useTranslation();
  const plan   = useAuthStore(s => s.plan);

  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const canDownload = !!(plan && plan.id !== 'free' && plan.is_active);

  const load = useCallback(async () => {
    try {
      const items   = await listDownloads();
      const now     = Date.now();
      const valid   = items.filter(d => new Date(d.expiresAt).getTime() > now);
      const expired = items.filter(d => new Date(d.expiresAt).getTime() <= now);
      await Promise.all(expired.map(d => deleteDownload(d.contentId)));
      setDownloads(valid);
    } catch {
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (contentId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    try {
      await deleteDownload(contentId);
      setDownloads(p => p.filter(d => d.contentId !== contentId));
    } catch {}
  };

  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DownloadIcon style={{ color: 'var(--color-primary)', fontSize: 24 }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Downloads</h1>
            <p className="page-subtitle">
              {downloads.length} {downloads.length === 1 ? 'título guardado' : 'títulos guardados'}
            </p>
          </div>
        </div>
      </div>

      {!canDownload && (
        <div className="alert" style={{
          marginBottom: 20, background: 'rgba(229,9,20,0.08)',
          border: '1px solid rgba(229,9,20,0.2)', borderRadius: 10,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
          flexWrap: 'wrap',
        }}>
          <WarningAmberIcon style={{ color: 'var(--color-primary)', fontSize: 20, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Download disponível nos planos Mensal e Anual
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
              Faça upgrade para descarregar conteúdo para assistir offline.
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => router.push('/main/plans')}>
            Ver planos
          </button>
        </div>
      )}

      {loading ? (
        <div className="page-loading"><div className="loading-ring" /></div>
      ) : downloads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><DownloadIcon style={{ fontSize: 28 }} /></div>
          <div className="empty-title">Sem downloads</div>
          <div className="empty-desc">
            {canDownload
              ? 'Abre um filme ou série e clica em "Baixar" para assistir offline.'
              : 'Disponível nos planos Mensal e Anual.'}
          </div>
          {canDownload && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/main/catalog')}>
              Explorar catálogo
            </button>
          )}
        </div>
      ) : (
        <div className="content-grid" data-tv-container>
          {downloads.map(d => {
            const days         = daysLeft(d.expiresAt);
            const expiringSoon = days <= 3;
            const isFocused    = focusedId === d.contentId;

            return (
              <div
                key={d.contentId}
                tabIndex={0}
                data-tv-focusable
                className="dl-card-wrap"
                style={{ position: 'relative', borderRadius: 10, outline: 'none' }}
                onFocus={() => setFocusedId(d.contentId)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedId(null);
                }}
                onClick={() => router.push(`/main/watch/${d.contentId}?offline=1`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/main/watch/${d.contentId}?offline=1`); }
                  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(d.contentId, e); }
                }}
              >
                <div style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', background: 'var(--color-card)', border: '1px solid var(--color-border)', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--color-bg-darker)' }}>
                    {d.poster
                      ? <img src={d.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MovieIcon style={{ fontSize: 28, color: 'var(--color-text-muted)' }} /></div>}

                    <div className="dl-play-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', opacity: isFocused ? 1 : 0, transition: 'opacity 0.15s' }}>
                      <PlayArrowIcon style={{ fontSize: 36, color: '#fff' }} />
                    </div>

                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.75)', borderRadius: 4, padding: '2px 6px', fontSize: '0.65rem', fontFamily: 'monospace', color: expiringSoon ? '#ff7070' : 'rgba(255,255,255,0.7)' }}>
                      {expiringSoon ? `⚠ ${days}d` : `${days}d`}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace' }}>{d.quality?.toUpperCase()}</span>
                      <span>Expira {new Date(d.expiresAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>

                <button
                  tabIndex={-1}
                  onClick={e => remove(d.contentId, e)}
                  title="Remover download (Delete)"
                  className="dl-remove-btn"
                  style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 6, background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(229,9,20,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', opacity: isFocused ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: isFocused ? 'auto' : 'none' }}>
                  <DeleteOutlineIcon style={{ fontSize: 16 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (hover: hover) and (pointer: fine) {
          .dl-card-wrap:hover .dl-remove-btn  { opacity: 1 !important; pointer-events: auto !important; }
          .dl-card-wrap:hover .dl-play-overlay { opacity: 1 !important; }
        }
        /* Toque: sem hover o botão de remover ficava inalcançável — sempre visível. */
        @media (hover: none), (pointer: coarse) {
          .dl-remove-btn { opacity: 1 !important; pointer-events: auto !important; }
        }
        .tv-mode .dl-card-wrap:focus > div:first-child { border-color: rgba(229,9,20,0.55) !important; box-shadow: 0 0 0 3px rgba(229,9,20,0.25) !important; }
        .dl-card-wrap:focus-visible { outline: none !important; }
        .tv-mode .dl-card-wrap:focus::after { content: 'Del = remover'; position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: rgba(255,255,255,0.55); font-size: 0.6rem; padding: 2px 8px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 10; }
      `}</style>
    </div>
  );
}