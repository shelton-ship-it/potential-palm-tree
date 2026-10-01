'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import HomeIcon    from '@mui/icons-material/Home';
import BoltIcon    from '@mui/icons-material/Bolt';
import SettingsIcon from '@mui/icons-material/Settings';
import type { NavItem } from './AppShell';

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL || '';
const PLANS_HREF   = ACCOUNT_URL ? `${ACCOUNT_URL}/main/plans`   : '/main/plans';
const ACCOUNT_HREF = ACCOUNT_URL ? `${ACCOUNT_URL}/main/account` : '/main/account';

const BASE_ITEMS: NavItem[] = [
  { href: '/main',      label: 'nav.home',     Icon: HomeIcon },
  { href: PLANS_HREF,   label: 'nav.upgrade',  Icon: BoltIcon },
  { href: ACCOUNT_HREF, label: 'nav.settings', Icon: SettingsIcon },
];

export default function MobileNav({ extraNav = [] }: { extraNav?: NavItem[] }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const items = [BASE_ITEMS[0], ...extraNav, ...BASE_ITEMS.slice(1)];
  const isActive = (href: string) => {
    if (href.startsWith('http')) return false; // link externo (hub central) — nunca "activo" localmente
    return href === '/main' ? pathname === '/main' : pathname.startsWith(href);
  };

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
      {items.map(({ href, Icon, label }) => (
        <Link key={href} href={href} className={`mobile-nav-item ${isActive(href) ? 'active' : ''}`} aria-label={t(label as any, label)}>
          <Icon style={{ fontSize: 22 }} />
          <span>{t(label as any, label)}</span>
        </Link>
      ))}
    </nav>
  );
}
