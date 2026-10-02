'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { searchApi, authApi } from '@/lib/api';
import { loginRedirectUrl } from '@/lib/auth-redirect';
import { LANGUAGES, changeLanguageLazy } from '@/i18n';

import HomeIcon         from '@mui/icons-material/Home';
import MovieIcon        from '@mui/icons-material/Movie';
import LiveTvIcon       from '@mui/icons-material/LiveTv';
import BookmarkIcon     from '@mui/icons-material/Bookmark';
import SearchIcon       from '@mui/icons-material/Search';
import SettingsIcon     from '@mui/icons-material/Settings';
import LogoutIcon       from '@mui/icons-material/Logout';
import BoltIcon         from '@mui/icons-material/Bolt';
import TranslateIcon    from '@mui/icons-material/Translate';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon         from '@mui/icons-material/Menu';
import CloudUploadIcon  from '@mui/icons-material/CloudUpload';
import DownloadIcon     from '@mui/icons-material/Download';
import ChildCareIcon    from '@mui/icons-material/ChildCare';
import CheckIcon        from '@mui/icons-material/Check';
import GavelIcon        from '@mui/icons-material/Gavel';
import FlagOutlinedIcon  from '@mui/icons-material/FlagOutlined';
import Focusable         from '@/components/ui/Focusable';
import InstallPWAButton  from '@/components/ui/InstallPWAButton';
import AndroidIcon       from '@mui/icons-material/Android';
import { focusFirstInPage, shouldAutoFocus } from '@/lib/tv-navigation';

const NAV = [
  { href:'/main',           labelKey:'nav.home',      Icon: HomeIcon },
  { href:'/main/catalog',   labelKey:'nav.catalog',   Icon: MovieIcon },
  { href:'/main/channels',  labelKey:'nav.liveTV',    Icon: LiveTvIcon },
  { href:'/main/mylist',    labelKey:'nav.myList',    Icon: BookmarkIcon },
  { href:'/main/search',    labelKey:'nav.search',    Icon: SearchIcon },
];

function countValidDownloads(cb: (n: number) => void) {
  try {
    const req = indexedDB.open('pixgo-offline', 2); // manter em sync com DB_VERSION em lib/downloads.ts
    // FIX: sem isto, se este open() corresse antes do openDB() de
    // lib/downloads.ts, a BD ficava criada vazia (sem nenhuma object
    // store) — e como a versão pedida não muda, o onupgradeneeded de
    // downloads.ts nunca mais disparava para criar 'download-meta' /
    // 'download-segments'. Resultado: "One of the specified object
    // stores was not found" ao tentar baixar. Idempotente — se as
    // stores já existirem (criadas por downloads.ts primeiro), não faz
    // nada aqui.
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('download-meta'))
        db.createObjectStore('download-meta', { keyPath: 'contentId' });
      if (!db.objectStoreNames.contains('download-segments'))
        db.createObjectStore('download-segments');
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('download-meta')) { db.close(); cb(0); return; }
      const tx  = db.transaction('download-meta', 'readonly');
      const all = tx.objectStore('download-meta').getAll();
      let n = 0;
      all.onsuccess = () => {
        const now   = Date.now();
        n = (all.result || []).filter((d: any) => new Date(d.expiresAt).getTime() > now).length;
      };
      all.onerror   = () => {};
      tx.oncomplete = () => { db.close(); cb(n); };
      tx.onerror    = () => { db.close(); cb(0); };
    };
    req.onerror   = () => cb(0);
    // FIX: mesmo motivo do openDB() em lib/downloads.ts — sem isto, uma
    // conexão bloqueada aqui trava em silêncio, sem nunca chamar cb().
    req.onblocked = () => cb(0);
  } catch { cb(0); }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { t, i18n } = useTranslation();
  const user  = useAuthStore(s => s.user);
  const plan  = useAuthStore(s => s.plan);
  const logout= useAuthStore(s => s.logout);
  const profiles         = useAuthStore(s => s.profiles);
  const activeProfileId  = useAuthStore(s => s.activeProfileId);
  const setActiveProfile = useAuthStore(s => s.setActiveProfile);
  const activeProfile    = profiles.find(p => p.id === activeProfileId) || null;

  // On mobile (≤768px) sidebar starts closed; on desktop starts open
  const [sidebarOpen,    setSidebarOpen]    = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 768;
  });
  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const [langMenuOpen,   setLangMenuOpen]   = useState(false);
  const [query,          setQuery]          = useState('');
  const [results,        setResults]        = useState<any[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [showDrop,       setShowDrop]       = useState(false);
  const [downloadCount,  setDownloadCount]  = useState(0);

  const userRef   = useRef<HTMLDivElement>(null);
  const langRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounce  = useRef<any>(null);

  const canDownload = !!(plan && plan.id !== 'free' && plan.is_active);
  const isPremium   = plan && plan.id !== 'free';

  useEffect(() => {
    if (!canDownload) { setDownloadCount(0); return; }
    countValidDownloads(setDownloadCount);
    const iv = setInterval(() => countValidDownloads(setDownloadCount), 15000);
    return () => clearInterval(iv);
  }, [canDownload, pathname]);

  // OTIMIZAÇÃO (produção): AppShell envolve TODAS as páginas autenticadas —
  // um único prefetch aqui, uma vez, cobre os botões "Ver planos"/"Upgrade"
  // (account, content, watch, downloads, channels), "Downloads", "Upload" e
  // o link do logo/home espalhados por vários ficheiros, sem precisar de
  // repetir router.prefetch em cada página individualmente.
  //
  // FIX (navegação lenta na sidebar): esta lista cobria só as páginas da
  // secção "Conta" — faltavam exactamente as rotas que estão no próprio
  // NAV do sidebar/bottom-nav (Sinal Aberto, Minha Coleção, Pesquisar) e
  // "Termos" no rodapé. Resultado: clicar em "Catálogo"/"Planos"/etc. era
  // instantâneo (rota já pré-buscada), mas clicar em "Canais", "Minha
  // Lista" ou "Buscar" tinha sempre o atraso do primeiro carregamento.
  // Agora cobre TODAS as rotas alcançáveis a partir do sidebar, não só as
  // que já tinham sido tratadas à parte.
  useEffect(() => {
    [
      '/main', '/main/catalog', '/main/channels', '/main/mylist', '/main/search',
      '/main/plans', '/main/downloads', '/main/upload', '/main/account', '/main/legal',
      '/copyright',
    ].forEach(r => router.prefetch(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // FIX: foca o primeiro elemento navegável de cada página assim que a
    // rota muda — antes disto nenhuma página fazia isto (mesmo estando
    // documentado em focusFirstInPage()), pelo que a navegação por D-pad
    // não tinha ponto de partida previsível em páginas como downloads,
    // legal, buscar, catálogo, etc. shouldAutoFocus() (não isLikelyTV()
    // sozinho) — reage a quem está mesmo a navegar por teclado/comando
    // agora, incluindo num portátil normal com trackpad, sem roubar o
    // foco a quem de facto está a usar o rato.
    if (shouldAutoFocus()) focusFirstInPage();
  }, [pathname]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current   && !userRef.current.contains(e.target as Node))   setUserMenuOpen(false);
      if (langRef.current   && !langRef.current.contains(e.target as Node))   setLangMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowDrop(false); setUserMenuOpen(false); setLangMenuOpen(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setShowDrop(false); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchApi.search(query, { limit: 6 });
        setResults(res.results ?? []);
        setShowDrop(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  // OTIMIZAÇÃO (produção): resultados do dropdown de busca (máx. 6) só
  // navegavam via router.push, nunca pré-buscados.
  useEffect(() => {
    results.forEach(r => router.prefetch(`/main/watch/${r.id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // FIX (pedido explícito — TV tem de ver /auth/tv, não o hub externo):
  // este handler chamava router.push('/auth/login') directo, ignorando
  // loginRedirectUrl() (que já sabe escolher /auth/tv numa TV — ver
  // lib/auth-redirect.ts). Sem isto, sair da conta numa TV mandava sempre
  // para o hub de utilizador e senha, mesmo tendo /auth/tv disponível.
  const handleLogout = async () => { await logout(); router.push(loginRedirectUrl()); };

  const handleLangChange = async (code: string) => {
    await changeLanguageLazy(code);
    localStorage.setItem('pixgo_lang', code);
    setLangMenuOpen(false);
    authApi.setLanguage(code).catch(() => {});
  };

  const initials = (user?.name || user?.username || '?')
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  const isActive = (href: string) =>
    href === '/main' ? pathname === '/main' : pathname.startsWith(href);

  const currentLang = LANGUAGES.find(l => l.code === (i18n.language || 'pt').slice(0, 2)) || LANGUAGES[0];


  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  // Sync sidebar open/closed with window width
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      <div className="app-shell">
        {/* Overlay: closes sidebar when clicking outside on mobile */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-section-label">Menu</div>
              {NAV.map(({ href, labelKey, Icon }) => (
                <Link key={href} href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                  <Icon style={{ fontSize: 17 }} />{t(labelKey as any)}
                </Link>
              ))}

              {/* Denúncia de direitos autorais, logo após "Pesquisar". Link
                  (navegação do lado do cliente, rota pré-buscada acima) como
                  os restantes botões do menu. */}
              <Link href="/copyright" className="nav-item nav-report" onClick={closeSidebarOnMobile}>
                <FlagOutlinedIcon style={{ fontSize: 17, color: 'var(--color-primary)' }} />{t('nav.reportCopyright')}
              </Link>
            </div>

            <div className="nav-section">
              <div className="nav-section-label">Conta</div>

              {/* Downloads */}
              {canDownload ? (
                <Link href="/main/downloads" className={`nav-item ${isActive('/main/downloads') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                  <DownloadIcon style={{ fontSize: 17 }} />
                  Downloads
                  {downloadCount > 0 && (
                    <span className="nav-badge" style={{ background:'var(--color-primary)', color:'#fff', marginLeft:'auto' }}>
                      {downloadCount}
                    </span>
                  )}
                </Link>
              ) : (
                <Link href="/main/plans" className="nav-item" style={{ color:'rgba(255,255,255,0.35)' }} title="Download disponível nos planos Mensal e Anual" onClick={closeSidebarOnMobile}>
                  <DownloadIcon style={{ fontSize: 17 }} />
                  Downloads
                  <span className="nav-badge" style={{ background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)', marginLeft:'auto', fontSize:'0.6rem' }}>PRO</span>
                </Link>
              )}

              <button className="nav-item" style={{ width:'100%', textAlign:'left', color:'rgba(255,255,255,0.55)' }} onClick={() => { router.push('/main/upload'); closeSidebarOnMobile(); }}>
                <CloudUploadIcon style={{ fontSize:17 }} />{t('nav.upload')}
              </button>

              <Link href="/main/plans" className={`nav-item ${isActive('/main/plans') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                <BoltIcon style={{ fontSize:17 }} />{t('nav.upgrade')}
                {!isPremium && <span className="nav-badge">Free</span>}
              </Link>

              <Link href="/main/account" className={`nav-item ${isActive('/main/account') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                <SettingsIcon style={{ fontSize:17 }} />{t('nav.account')}
              </Link>

              <Link href="/main/legal" className={`nav-item ${isActive('/main/legal') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                <GavelIcon style={{ fontSize:17 }} />{t('legal.title')}
              </Link>
            </div>
          </nav>

          <div className="sidebar-footer">
            <div style={{ padding:'10px 10px 8px', borderTop:'1px solid rgba(255,255,255,0.05)', marginBottom:4 }}>
              <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)', marginBottom:7 }}>{t('contact.copyright')}</div>
              <Link href="/copyright" className="sidebar-report" onClick={closeSidebarOnMobile}>
                <FlagOutlinedIcon style={{ fontSize: 16, color: 'var(--color-primary)' }} />
                {t('contact.reportCopyrightButton')}
              </Link>
            </div>
            <div style={{ padding: '0 10px 8px' }}>
              <InstallPWAButton
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  width: '100%', padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600,
                }}
              />
            </div>
            {/* Placeholder — link definitivo do APK a publicar em
                app.pixgo.qzz.io; troca o href quando o ficheiro estiver
                disponível lá. */}
            <div style={{ padding: '0 10px 8px' }}>
              <a
                href="https://app.pixgo.qzz.io/download/android"
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  width: '100%', padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <AndroidIcon style={{ fontSize: 15 }} />
                Baixar app Android
              </a>
            </div>
            <button className="nav-item" style={{ width:'100%', color:'var(--color-text-muted)' }} onClick={handleLogout}>
              <LogoutIcon style={{ fontSize:17 }} />{t('nav.signOut')}
            </button>
          </div>
        </aside>

        <div className={`main-content ${sidebarOpen ? '' : 'full-width'}`}>
          <header className="header">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar" style={{ marginRight:12 }}>
              <MenuIcon style={{ fontSize:21, color:'var(--color-text-light)' }} />
            </button>
            <Link href="/main" className="logo" style={{ marginRight:16, flexShrink:0 }}>
              <img src="/logo.svg" alt="Pixgo" />
            </Link>

            <div ref={searchRef} style={{ flex:1, maxWidth:380, position:'relative' }}>
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <SearchIcon style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--color-text-muted)', pointerEvents:'none', zIndex:1 }} />
                <input className="search-input" style={{ width:'100%', paddingLeft:33 }} placeholder={t('nav.search') + '...'} value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setShowDrop(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && query.trim()) { router.push(`/main/search?q=${encodeURIComponent(query.trim())}`); setShowDrop(false); setQuery(''); }
                    if (e.key === 'Escape') setShowDrop(false);
                  }} />
                {searching && <span className="input-spinner-slot" style={{ right: 10 }}><span className="spinner spinner-sm" /></span>}
              </div>
              {showDrop && (
                <div className="search-dropdown fade-in">
                  {results.length > 0 ? (
                    <>
                      {results.map((r, i) => (
                        <Focusable key={r.id} autoFocus={i === 0} className="search-item" onClick={() => { router.push(`/main/watch/${r.id}`); setQuery(''); setShowDrop(false); }}>
                          {(r.meta?.poster || r.poster) && <img src={r.meta?.poster || r.poster} alt="" />}
                          <div>
                            <div className="search-item-title">{r.meta?.title || r.title}</div>
                            <div className="search-item-meta">{r.year} · {r.type}</div>
                          </div>
                        </Focusable>
                      ))}
                      <Focusable className="search-view-all" onClick={() => { router.push(`/main/search?q=${encodeURIComponent(query)}`); setShowDrop(false); }}>Ver todos os resultados →</Focusable>
                    </>
                  ) : (
                    <div className="search-empty">{t('common.noResults')}</div>
                  )}
                </div>
              )}
            </div>

            <div className="header-actions">
              <div style={{ position:'relative' }} ref={langRef}>
                <Focusable as="button" className="icon-btn" style={{ display:'flex', alignItems:'center', gap:5, width:'auto', paddingInline:10 }} onClick={() => setLangMenuOpen(v => !v)}>
                  <TranslateIcon style={{ fontSize:17 }} />
                  <span style={{ fontSize:'0.7rem', fontWeight:700, fontFamily:'monospace' }}>{currentLang.code.toUpperCase()}</span>
                  <KeyboardArrowDownIcon style={{ fontSize:13 }} />
                </Focusable>
                {langMenuOpen && (
                  <div className="dropdown fade-in" style={{ minWidth:155 }}>
                    {LANGUAGES.map((lang, i) => (
                      <Focusable key={lang.code} autoFocus={i === 0} className="dropdown-item" style={{ fontWeight: lang.code === (i18n.language||'pt').slice(0,2) ? 700 : 400 }} onClick={() => handleLangChange(lang.code)}>
                        <span style={{ fontSize:'1.1rem' }}>{lang.flag}</span>{lang.native}
                      </Focusable>
                    ))}
                  </div>
                )}
              </div>

              {canDownload && (
                <div style={{ position:'relative' }}>
                  <button className="icon-btn" onClick={() => router.push('/main/downloads')} title="Downloads">
                    <DownloadIcon style={{ fontSize:19 }} />
                    {downloadCount > 0 && (
                      <span style={{ position:'absolute', top:4, right:4, width:8, height:8, borderRadius:'50%', background:'var(--color-primary)' }} />
                    )}
                  </button>
                </div>
              )}

              <div style={{ position:'relative' }} ref={userRef}>
                <Focusable className="avatar-btn" onClick={() => setUserMenuOpen(v => !v)} title={activeProfile?.name || user?.name}>{initials}</Focusable>
                {userMenuOpen && (
                  <div className="dropdown fade-in">
                    <div style={{ padding:'11px 15px 9px', borderBottom:'1px solid var(--color-border)' }}>
                      <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{user?.name}</div>
                      <div style={{ fontSize:'0.74rem', color:'var(--color-text-muted)', marginTop:2 }}>@{user?.username}</div>
                      {user?.email && <div style={{ fontSize:'0.72rem', color:'var(--color-text-muted)', marginTop:1 }}>{user.email}</div>}
                      <span className={`badge ${isPremium ? 'badge-red' : 'badge-gray'}`} style={{ marginTop:6, display:'inline-flex', textTransform:'capitalize' }}>{plan?.id || 'free'}</span>
                    </div>

                    {profiles.length > 0 && (
                      <>
                        <div style={{ padding:'9px 15px 4px', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>
                          {t('nav.profiles')}
                        </div>
                        {profiles.map((p, i) => (
                          <Focusable
                            key={p.id}
                            autoFocus={i === 0}
                            className="dropdown-item"
                            style={{ display:'flex', alignItems:'center', gap:8 }}
                            onClick={() => { setActiveProfile(p.id); setUserMenuOpen(false); }}
                          >
                            <span style={{
                              width:22, height:22, borderRadius:'50%', flexShrink:0,
                              background:'linear-gradient(135deg,var(--color-primary),#8c3bff)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:'0.68rem', fontWeight:800, color:'#fff',
                            }}>
                              {(p.name || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            {p.is_kid && <ChildCareIcon style={{ fontSize:14, color:'var(--color-text-muted)', flexShrink:0 }} />}
                            {p.id === activeProfileId && <CheckIcon style={{ fontSize:15, color:'var(--color-primary)', flexShrink:0 }} />}
                          </Focusable>
                        ))}
                        <div className="dropdown-sep" />
                      </>
                    )}

                    {[
                      { label: t('nav.account'), href:'/main/account' },
                      { label: t('nav.upgrade'), href:'/main/plans' },
                      { label: t('nav.myList'),  href:'/main/mylist' },
                      ...(canDownload ? [{ label: 'Downloads', href:'/main/downloads' }] : []),
                    ].map((item, i) => (
                      <Focusable key={item.href} autoFocus={profiles.length === 0 && i === 0} className="dropdown-item" onClick={() => { router.push(item.href); setUserMenuOpen(false); }}>{item.label}</Focusable>
                    ))}
                    <div className="dropdown-sep" />
                    <Focusable className="dropdown-item" onClick={() => { router.push('/main/upload'); setUserMenuOpen(false); }}>
                      <CloudUploadIcon style={{ fontSize:15 }} />{t('nav.upload')}
                    </Focusable>
                    <div className="dropdown-sep" />
                    <Focusable className="dropdown-item danger" onClick={handleLogout}>
                      <LogoutIcon style={{ fontSize:15 }} />{t('nav.signOut')}
                    </Focusable>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="page-content fade-in">{children}</main>
        </div>
      </div>
    </>
  );
}