'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import { authApi } from '../../lib/api';
import { LANGUAGES } from '../../i18n';

import HomeIcon              from '@mui/icons-material/Home';
import BoltIcon              from '@mui/icons-material/Bolt';
import SettingsIcon          from '@mui/icons-material/Settings';
import TuneIcon              from '@mui/icons-material/Tune';
import LogoutIcon            from '@mui/icons-material/Logout';
import TranslateIcon         from '@mui/icons-material/Translate';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MenuIcon              from '@mui/icons-material/Menu';
import EmailIcon             from '@mui/icons-material/Email';
import NotificationsNoneIcon     from '@mui/icons-material/NotificationsNone';
import GavelOutlinedIcon         from '@mui/icons-material/GavelOutlined';

import InstallPWAButton from '../ui/InstallPWAButton';

// ── Configuração por plataforma ─────────────────────────────────────────────
// PLATFORM_NAME / PLATFORM_LOGO / SUPPORT_EMAIL vêm do env de cada deploy —
// é a única coisa que muda entre CompressHub, ConvertAll, EditPDF, etc.
// NAV é passado pela página (main/layout.tsx) porque o item "ferramenta
// principal" difere por plataforma (ex: /main/compress, /main/convert).
export interface NavItem { href: string; label: string; Icon: React.ElementType; }

import { LEGAL_LINKS, SUPPORT_EMAIL, legalLinksFor } from '../../lib/legalLinks';

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Platform';

// Vazio nas apps que TÊM login/planos/conta próprios (o hub central,
// app.pixgo.qzz.io). Nas plataformas satélite, aponta pro hub — não duplicam mais
// essas páginas, só linkam pra lá.
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL || '';
const PLANS_HREF   = ACCOUNT_URL ? `${ACCOUNT_URL}/main/plans`   : '/main/plans';
const ACCOUNT_HREF = ACCOUNT_URL ? `${ACCOUNT_URL}/main/account` : '/main/account';
const LOGIN_HREF    = ACCOUNT_URL ? `${ACCOUNT_URL}/auth/login`   : '/auth/login';
const SETTINGS_HREF      = ACCOUNT_URL ? `${ACCOUNT_URL}/main/settings`      : '/main/settings';
const NOTIFICATIONS_HREF = ACCOUNT_URL ? `${ACCOUNT_URL}/main/notifications` : '/main/notifications';

const BASE_NAV: NavItem[] = [
  { href: '/main', label: 'nav.home', Icon: HomeIcon },
];

export default function AppShell({ children, extraNav = [] }: { children: React.ReactNode; extraNav?: NavItem[] }) {
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const user   = useAuthStore(s => s.user);
  const plan   = useAuthStore(s => s.plan);
  const logout = useAuthStore(s => s.logout);

  // O sidebar começa sempre fechado — só abre quando o utilizador clica no
  // botão de menu. Antes abria sozinho em ecrãs largos; deixou de o fazer.
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [legalMenuOpen, setLegalMenuOpen] = useState(false);

  const userRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const isPremium = plan && plan.id !== 'free';

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setSidebarOpen(false);
  }, [pathname]);

  // Ao redimensionar para largura de telemóvel, fecha o sidebar (evita
  // ficar preso aberto por cima do conteúdo). Não o reabre automaticamente
  // ao voltar para ecrã largo — continua a exigir clique no utilizador.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth <= 768) setSidebarOpen(false); };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setSidebarOpen(false);
  };

  const handleLogout = async () => { await logout(); window.location.href = LOGIN_HREF; };

  const handleLangChange = async (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('platform_lang', code);
    setLangMenuOpen(false);
    if (user) authApi.setLanguage(code).catch(() => {});
  };

  const initials = (user?.name || user?.username || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const isActive = (href: string) => (href === '/main' ? pathname === '/main' : pathname.startsWith(href));
  const currentLang = LANGUAGES.find(l => l.code === (i18n.language || 'pt').slice(0, 2)) || LANGUAGES[0];

  const NAV = [...BASE_NAV, ...extraNav];
  const legalLinks = legalLinksFor(i18n.language);
  const isHome = pathname === '/main';

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Menu</div>
            {NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
                <Icon style={{ fontSize: 17 }} />{t(label as any, label)}
              </Link>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-section-label">{t('nav.account', 'Conta')}</div>

            <Link href={PLANS_HREF} className={`nav-item ${!ACCOUNT_URL && isActive('/main/plans') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
              <BoltIcon style={{ fontSize: 17 }} />{t('nav.upgrade', 'Planos')}
              {!isPremium && <span className="nav-badge">Free</span>}
            </Link>

            <Link href={NOTIFICATIONS_HREF} className={`nav-item ${!ACCOUNT_URL && isActive('/main/notifications') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
              <NotificationsNoneIcon style={{ fontSize: 17 }} />{t('nav.notifications', 'Notificações')}
            </Link>

            <Link href={SETTINGS_HREF} className={`nav-item ${!ACCOUNT_URL && isActive('/main/settings') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
              <TuneIcon style={{ fontSize: 17 }} />{t('nav.preferences', 'Definições')}
            </Link>

            <Link href={ACCOUNT_HREF} className={`nav-item ${!ACCOUNT_URL && isActive('/main/account') ? 'active' : ''}`} onClick={closeSidebarOnMobile}>
              <SettingsIcon style={{ fontSize: 17 }} />{t('nav.settings', 'Conta')}
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">{t('nav.institutional', 'Institucional')}</div>
            <button
              className="nav-item"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => setLegalMenuOpen(v => !v)}
              aria-expanded={legalMenuOpen}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GavelOutlinedIcon style={{ fontSize: 17 }} />{t('nav.legalInfo', 'Informações legais')}
              </span>
              <KeyboardArrowDownIcon style={{ fontSize: 15, transform: legalMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }} />
            </button>
            {legalMenuOpen && (
              <div style={{ padding: '2px 10px 4px 33px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {legalLinks.map(l => (
                  <a key={l.href} href={l.href} className="nav-item" style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {l.label}
                  </a>
                ))}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="nav-item" style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  <EmailIcon style={{ fontSize: 14 }} />{SUPPORT_EMAIL}
                </a>
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0 10px 8px' }}>
            <InstallPWAButton style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '7px 8px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600 }} />
          </div>
          <button className="nav-item" style={{ width: '100%', color: 'var(--color-text-muted)' }} onClick={handleLogout}>
            <LogoutIcon style={{ fontSize: 17 }} />{t('nav.signOut', 'Sair')}
          </button>
        </div>
      </aside>

      <div className={`main-content ${sidebarOpen ? '' : 'full-width'}`}>
        <header className="header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar" style={{ marginRight: 12 }}>
            <MenuIcon style={{ fontSize: 21, color: 'var(--color-text-light)' }} />
          </button>
          <Link href="/main" className="logo" style={{ marginRight: 16, flexShrink: 0 }}>
            <img src="/logo.svg" alt={PLATFORM_NAME} />
          </Link>

          <div style={{ flex: 1 }} />

          <div className="header-actions">
            <Link href={NOTIFICATIONS_HREF} className="icon-btn" aria-label="Notifications">
              <NotificationsNoneIcon style={{ fontSize: 19 }} />
            </Link>

            <div style={{ position: 'relative' }} ref={langRef}>
              <button className="icon-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, width: 'auto', paddingInline: 10 }} onClick={() => setLangMenuOpen(v => !v)}>
                <TranslateIcon style={{ fontSize: 17 }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace' }}>{currentLang.code.toUpperCase()}</span>
                <KeyboardArrowDownIcon style={{ fontSize: 13 }} />
              </button>
              {langMenuOpen && (
                <div className="dropdown fade-in" style={{ minWidth: 155 }}>
                  {LANGUAGES.map(lang => (
                    <div key={lang.code} className="dropdown-item" style={{ fontWeight: lang.code === (i18n.language || 'pt').slice(0, 2) ? 700 : 400 }} onClick={() => handleLangChange(lang.code)}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', width: 22, flexShrink: 0 }}>{lang.code.toUpperCase()}</span>{lang.native}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} ref={userRef}>
              <div className="avatar-btn" onClick={() => setUserMenuOpen(v => !v)} title={user?.name}>{initials}</div>
              {userMenuOpen && (
                <div className="dropdown fade-in">
                  <div style={{ padding: '11px 15px 9px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>@{user?.username}</div>
                    <span className={`badge ${isPremium ? 'badge-red' : 'badge-gray'}`} style={{ marginTop: 6, display: 'inline-flex', textTransform: 'capitalize' }}>{plan?.id || 'free'}</span>
                  </div>
                  {[
                    { label: t('nav.settings', 'Conta'), href: ACCOUNT_HREF },
                    { label: t('nav.preferences', 'Definições'), href: SETTINGS_HREF },
                    { label: t('nav.upgrade', 'Planos'), href: PLANS_HREF },
                  ].map(item => (
                    <div key={item.href} className="dropdown-item" onClick={() => { window.location.href = item.href; setUserMenuOpen(false); }}>{item.label}</div>
                  ))}
                  <div className="dropdown-sep" />
                  <div className="dropdown-item danger" onClick={handleLogout}>
                    <LogoutIcon style={{ fontSize: 15 }} />{t('nav.signOut', 'Sair')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content fade-in">{children}</main>

        {!isHome && (
          <footer className="app-footer">
            <div className="app-footer-legal">
              {legalLinks.map(l => (
                <a key={l.href} href={l.href} className="app-footer-legal-link">{l.label}</a>
              ))}
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer-support">
              <EmailIcon style={{ fontSize: 13, flexShrink: 0 }} />
              <span>{t('contact.support', 'Suporte')}: <strong>{SUPPORT_EMAIL}</strong></span>
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}
