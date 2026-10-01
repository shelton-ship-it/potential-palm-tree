'use client';
// FIX: no upload original, o conteúdo real desta página estava salvo como
// "pages.tsx" (nome errado — Next.js App Router só reconhece "page.tsx"),
// enquanto o "page.tsx" real ficava vazio. A rota /main/downloads ficava
// em branco em produção. Mesmo padrão de bug já visto em main/catalog/page.tsx
// — corrigido movendo o conteúdo real para o nome de ficheiro correto.
// listDownloads()/deleteDownload() (lib/downloads.ts) são 100% locais via
// IndexedDB — esta página já funciona offline por natureza, sem depender
// de nenhum pedido de rede.
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { listDownloads, listActiveDownloads, deleteDownload, cancelDownload, type ActiveDownloadMeta } from '@/lib/downloads';
import { isLikelyTV } from '@/lib/tv-navigation';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MovieIcon from '@mui/icons-material/Movie';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export default function DownloadsPage() {
  const router = useRouter();
  const { t }  = useTranslation();
  const plan   = useAuthStore(s => s.plan);

  const [downloads, setDownloads] = useState<any[]>([]);
  const [active,    setActive]    = useState<ActiveDownloadMeta[]>([]);
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

  // FIX: downloads em curso (ou que falharam) lêem-se sempre do IndexedDB,
  // nunca de um store em memória — por isso sobrevivem a um refresh da
  // página e aparecem aqui mesmo que tenham sido iniciados noutra página
  // (ou, em conjunto com o resumidor automático em main/layout.tsx, noutra
  // sessão). O polling a cada 1.5s mantém a barra de progresso a andar
  // enquanto a descarga decorre.
  const loadActive = useCallback(async () => {
    try { setActive(await listActiveDownloads()); } catch { setActive([]); }
  }, []);

  useEffect(() => { load(); loadActive(); }, [load, loadActive]);

  // OTIMIZAÇÃO (produção): abrir um download já concluído só fazia
  // router.push, nunca pré-buscado.
  useEffect(() => {
    downloads.forEach(d => router.prefetch(`/offline-player?id=${d.contentId}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloads]);

  useEffect(() => {
    const timer = setInterval(loadActive, 1500);
    return () => clearInterval(timer);
  }, [loadActive]);

  // Quando um download activo termina (deixa de aparecer em listActiveDownloads),
  // a lista de concluídos é recarregada para o mostrar de imediato.
  const prevActiveCount = React.useRef(0);
  useEffect(() => {
    if (prevActiveCount.current > 0 && active.length < prevActiveCount.current) load();
    prevActiveCount.current = active.length;
  }, [active.length, load]);

  const cancelActive = async (contentId: string) => {
    cancelDownload(contentId);
    await deleteDownload(contentId);
    setActive(a => a.filter(d => d.contentId !== contentId));
  };

  const retryActive = (contentId: string) => {
    router.push(`/main/content/${contentId}`);
  };

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

      {active.length > 0 && (
        <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.map(d => (
            <div key={d.contentId} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10,
            }}>
              {d.poster
                ? <img src={d.poster} alt="" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                : <div style={{ width: 56, height: 32, borderRadius: 6, background: 'var(--color-bg-darker)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MovieIcon style={{ fontSize: 16, color: 'var(--color-text-muted)' }} /></div>}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <span style={{ fontSize: '0.72rem', color: d.status === 'error' ? '#ff7070' : 'var(--color-text-muted)', flexShrink: 0, fontFamily: 'monospace' }}>
                    {d.status === 'error' ? 'Falhou' : `${d.progress}%`}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, width: `${d.progress}%`,
                    background: d.status === 'error' ? '#ff7070' : 'var(--color-primary)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {d.status === 'error' ? (
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0, gap: 4 }} onClick={() => retryActive(d.contentId)} title="Tentar novamente">
                  <ErrorOutlineIcon style={{ fontSize: 15 }} /> Repetir
                </button>
              ) : null}
              <button
                onClick={() => cancelActive(d.contentId)}
                title="Cancelar download"
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <CloseIcon style={{ fontSize: 15 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="page-loading"><div className="loading-ring" /></div>
      ) : downloads.length === 0 && active.length === 0 ? (
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
                onFocus={() => { if (isLikelyTV()) setFocusedId(d.contentId); }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusedId(null);
                }}
                onClick={() => router.push(`/offline-player?id=${d.contentId}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/offline-player?id=${d.contentId}`); }
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