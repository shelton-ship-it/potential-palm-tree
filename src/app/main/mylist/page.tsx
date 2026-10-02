'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { myListApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { isLikelyTV } from '@/lib/tv-navigation';
import ContentCard from '@/components/ui/ContentCard';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import toast from 'react-hot-toast';

export default function MyListPage() {
  const router    = useRouter();
  const { t }     = useTranslation();
  const profileId = useAuthStore(s => s.activeProfileId);

  const [items,     setItems]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }
    try {
      const res = await myListApi.list({ profileId, limit: 100 });
      setItems(res.items ?? []);
    } catch {
      toast.error(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  // OTIMIZAÇÃO (produção): antes esperava a resposta do servidor para só
  // depois tirar o item da grelha — o clique ficava "sem reação" durante
  // o round-trip. Agora remove da UI já, e só reverte + avisa se o
  // pedido ao servidor falhar mesmo.
  const remove = (contentId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (!profileId) return;

    const removedEntry = items.find(i => (i.content_id || i.contentId) === contentId);
    setItems(p => p.filter(i => (i.content_id || i.contentId) !== contentId));
    toast(t('myList.removed'), { icon: '🗑' });

    myListApi.remove(profileId, contentId).catch(() => {
      if (removedEntry) setItems(p => [removedEntry, ...p]);
      toast.error(t('errors.networkError'));
    });
  };

  return (
    <div>
      {/* FIX (redundância entre navegação e página, pedido explícito): o
          nome desta secção ("Minha Coleção") já aparece no sidebar/bottom-nav
          — <h1> removido, fica só o ícone + contagem. */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookmarkIcon style={{ color: 'var(--color-primary)', fontSize: 24 }} />
          <p className="page-subtitle" style={{ margin: 0 }}>{items.length} {t('myList.saved')}</p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="loading-ring" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BookmarkIcon style={{ fontSize: 28 }} /></div>
          <div className="empty-title">{t('myList.empty')}</div>
          <div className="empty-desc">{t('myList.emptyDesc')}</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }}
            onClick={() => router.push('/main/catalog')}>
            {t('myList.browse')}
          </button>
        </div>
      ) : (
        <div className="content-grid" data-tv-container>
          {items.map(entry => {
            const content = entry.content;
            const cid     = entry.content_id || entry.contentId;
            if (!content) return null;
            const isFocused = focusedId === cid;

            return (
              <div
                key={cid}
                tabIndex={0}
                data-tv-focusable
                className="mylist-card-wrap"
                style={{ position: 'relative', borderRadius: 12, outline: 'none' }}
                onFocus={() => { if (isLikelyTV()) setFocusedId(cid); }}
                onBlur={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setFocusedId(null);
                  }
                }}
                onClick={() => router.push(`/main/watch/${content.id}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/main/watch/${content.id}`);
                  }
                  if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    remove(cid, e);
                  }
                }}
              >
                <ContentCard
                  id={content.id}
                  title={content.meta?.title || content.title}
                  poster={content.meta?.poster || content.poster}
                  year={content.year}
                  type={content.type}
                  href={`/main/watch/${content.id}`}
                  onClick={() => router.push(`/main/watch/${content.id}`)}
                />

                {/* Botão remover — mouse: CSS hover; TV: isFocused */}
                <button
                  tabIndex={-1}
                  onClick={e => remove(cid, e)}
                  title="Remover da lista (Delete)"
                  className="mylist-remove-btn"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 32, height: 32, borderRadius: 6,
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(229,9,20,0.4)',
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary)',
                    opacity: isFocused ? 1 : 0,
                    transition: 'opacity 0.15s',
                    pointerEvents: isFocused ? 'auto' : 'none',
                  }}
                >
                  <DeleteOutlineIcon style={{ fontSize: 16 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (hover: hover) and (pointer: fine) {
          .mylist-card-wrap:hover .mylist-remove-btn {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
        }
        /* Toque: sem hover não há como revelar o botão — fica sempre visível
           (é uma acção, não um efeito de hover). */
        @media (hover: none), (pointer: coarse) {
          .mylist-remove-btn { opacity: 1 !important; pointer-events: auto !important; }
        }
        .tv-mode .mylist-card-wrap:focus > .content-card,
        .tv-mode .mylist-card-wrap:focus-visible > .content-card {
          border-color: rgba(229,9,20,0.6) !important;
          transform: translateY(-3px) scale(1.015) !important;
          box-shadow: 0 8px 24px rgba(229,9,20,0.3), 0 0 0 3px rgba(229,9,20,0.5) !important;
        }
        .mylist-card-wrap:focus { outline: none !important; }
        .mylist-card-wrap:focus-visible { outline: none !important; }
        .tv-mode .mylist-card-wrap:focus .mylist-remove-btn {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}