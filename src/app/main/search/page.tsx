'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { searchApi } from '@/lib/api';
import ContentCard from '@/components/ui/ContentCard';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export default function SearchPage() {
  const router  = useRouter();
  const sp      = useSearchParams();
  const { t }   = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,   setQuery]   = useState(sp.get('q') || '');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total,   setTotal]   = useState(0);
  const debounce  = useRef<any>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setTotal(0); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.search(query, { limit: 24 });
        setResults(res.results ?? []);
        setTotal(res.pagination?.total ?? 0);
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 340);
    return () => clearTimeout(debounce.current);
  }, [query]);

  return (
    <div>
      {/* FIX (redundância, pedido explícito): "Pesquisar" já está no
          sidebar/bottom-nav; ver mesma limpeza em catalog/channels/mylist.
          Mantém-se só o espaçamento do page-header, sem <h1>. */}
      <div className="page-header" />
      <div style={{ position: 'relative', marginBottom: 28, maxWidth: 560 }}>
        <SearchIcon style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
        {/* FIX (pedido explícito): placeholder tinha texto fixo
            ("Buscar filmes, séries, anime..."), removido — nada deve
            aparecer no placeholder deste campo. */}
        <input ref={inputRef} className="form-input" style={{ height: 48, paddingLeft: 46, fontSize: '1rem' }} placeholder="" value={query} onChange={e => setQuery(e.target.value)} autoCorrect="off" autoCapitalize="off" spellCheck={false} />
        {loading && <span className="input-spinner-slot"><span className="spinner spinner-sm" /></span>}
      </div>
      {/* FIX (pedido explícito, "limpar sem remorso"): secção "Em alta" com
          termos genéricos de género (action/comedy/drama/...) removida — a
          página de busca não deve sugerir nada antes da pessoa escrever;
          searchApi.popular()/estado `popular` também removidos abaixo, já
          que deixaram de ter para onde ir. */}
      {query.trim() && !loading && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><SearchOffIcon style={{ fontSize: 28 }} /></div>
          <div className="empty-title">{t('search.noResults')} "{query}"</div>
          <div className="empty-desc">{t('search.noResultsDesc')}</div>
        </div>
      )}
      {results.length > 0 && (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>{total} {t('search.results')} "{query}"</div>
          <div className="content-grid" data-tv-container>
            {results.map(item => (
              <ContentCard key={item.id} id={item.id} title={item.meta?.title || item.title} poster={item.meta?.poster || item.poster} year={item.year} type={item.type} rating={item.meta?.rating || item.rating} href={`/main/watch/${item.id}`} onClick={() => router.push(`/main/watch/${item.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
