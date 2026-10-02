// src/components/copyright/CopyrightShell.tsx
// Estrutura das páginas públicas de direitos autorais: cabeçalho com o logo
// oficial, conteúdo e rodapé institucional. Usa as mesmas classes do restante
// da plataforma (.header, .logo, .dropdown, .btn).
'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import TranslateIcon from '@mui/icons-material/Translate';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { LANGUAGES, changeLanguageLazy } from '@/i18n';

// Cada documento legal tem o seu próprio link no rodapé (aba correspondente
// da página /legal).
const LEGAL_LINKS: { tab: string; labelKey: string }[] = [
  { tab: 'notice',   labelKey: 'legal.tabNotice' },
  { tab: 'tos',      labelKey: 'legal.tabTos' },
  { tab: 'privacy',  labelKey: 'legal.tabPrivacy' },
  { tab: 'cookies',  labelKey: 'legal.tabCookies' },
  { tab: 'upload',   labelKey: 'legal.tabUpload' },
  { tab: 'security', labelKey: 'legal.tabSecurity' },
  { tab: 'contact',  labelKey: 'legal.tabContact' },
];

const COPYRIGHT_LEGAL_LINKS: { tab: string; labelKey: string }[] = [
  { tab: 'ipr',     labelKey: 'legal.tabIpr' },
  { tab: 'dmca',    labelKey: 'legal.tabDmca' },
  { tab: 'counter', labelKey: 'legal.tabCounter' },
];

const BOTTOM_STRIP = ['tos', 'privacy', 'cookies', 'notice', 'contact'];

function Header() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const isPortal = pathname.startsWith('/copyright/portal');
  const isReport = !isPortal && pathname.startsWith('/copyright');
  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  return (
    <header className="header">
      <Link href="/main" className="logo" aria-label="Pixgo">
        <img src="/logo.svg" alt="Pixgo" />
      </Link>
      <span className="cr-header-label">{t('copyright.shell.center')}</span>
      <nav className="cr-nav" aria-label={t('copyright.shell.mainNav')}>
        <Link href="/copyright" className={isReport ? 'active' : ''}>{t('copyright.shell.navReport')}</Link>
        <Link href="/copyright/portal" className={isPortal ? 'active' : ''}>{t('copyright.shell.navPortal')}</Link>
      </nav>

      <div className="header-actions">
        <div className="cr-lang" ref={ref}>
          <button
            type="button"
            className="cr-lang-btn"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <TranslateIcon style={{ fontSize: 16 }} />
            {current.code.toUpperCase()}
          </button>
          {open && (
            <div className="dropdown" role="listbox">
              {LANGUAGES.map(l => (
                <div
                  key={l.code}
                  role="option"
                  aria-selected={l.code === current.code}
                  className="dropdown-item"
                  style={l.code === current.code ? { color: 'var(--color-text-light)' } : undefined}
                  onClick={() => { changeLanguageLazy(l.code); setOpen(false); }}
                >
                  {l.native}
                </div>
              ))}
            </div>
          )}
        </div>
        <Link href="/main" className="cr-back">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <span>{t('copyright.shell.backToPlatform')}</span>
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const legalLabel = (tab: string) => {
    const all = [...LEGAL_LINKS, ...COPYRIGHT_LEGAL_LINKS];
    return t(all.find(l => l.tab === tab)!.labelKey);
  };

  return (
    <footer className="cr-footer">
      <div className="cr-footer-inner">
        <div className="cr-footer-grid">
          <div className="cr-footer-brand">
            <img src="/logo.svg" alt="Pixgo" />
            <p>{t('copyright.footer.tagline')}</p>
          </div>

          <nav aria-label={t('copyright.footer.colCopyright')}>
            <h2>{t('copyright.footer.colCopyright')}</h2>
            <ul>
              <li><Link href="/copyright">{t('copyright.shell.navReport')}</Link></li>
              <li><Link href="/copyright/portal">{t('copyright.shell.navPortal')}</Link></li>
              {COPYRIGHT_LEGAL_LINKS.map(l => (
                <li key={l.tab}><Link href={`/legal?tab=${l.tab}`}>{t(l.labelKey)}</Link></li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('copyright.footer.colLegal')}>
            <h2>{t('copyright.footer.colLegal')}</h2>
            <ul className="two">
              {LEGAL_LINKS.map(l => (
                <li key={l.tab}><Link href={`/legal?tab=${l.tab}`}>{t(l.labelKey)}</Link></li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="cr-footer-bottom">
          <span className="cr-footer-copy">
            &copy; {year} Pixgo. {t('copyright.footer.rights')}
          </span>
          <nav className="cr-footer-legal" aria-label={t('copyright.footer.legalNav')}>
            {BOTTOM_STRIP.map(tab => (
              <Link key={tab} href={`/legal?tab=${tab}`}>{legalLabel(tab)}</Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default function CopyrightShell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="cr-root">
      <Header />
      <main className="cr-main">
        <div className={`cr-container${narrow ? ' narrow' : ''}`}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
