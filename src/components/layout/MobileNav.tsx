'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import HomeIcon     from '@mui/icons-material/Home';
import MovieIcon    from '@mui/icons-material/Movie';
import LiveTvIcon   from '@mui/icons-material/LiveTv';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SearchIcon   from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';

const BASE_ITEMS = [
  { href:'/main',          Icon: HomeIcon,     labelKey:'nav.home' },
  { href:'/main/catalog',  Icon: MovieIcon,    labelKey:'nav.catalog' },
  { href:'/main/channels', Icon: LiveTvIcon,   labelKey:'nav.liveTV' },
  { href:'/main/mylist',   Icon: BookmarkIcon, labelKey:'nav.myList' },
  { href:'/main/search',   Icon: SearchIcon,   labelKey:'nav.search' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { t }    = useTranslation();
  const plan     = useAuthStore(s => s.plan);

  const canDownload = !!(plan && plan.id !== 'free' && plan.is_active);

  // Substitui "search" por "downloads" no mobile quando o plano permite
  const items = canDownload
    ? [...BASE_ITEMS.slice(0, 4), { href:'/main/downloads', Icon: DownloadIcon, labelKey:'nav.downloads' }]
    : BASE_ITEMS;

  const isActive = (href: string) =>
    href === '/main' ? pathname === '/main' : pathname.startsWith(href);

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
      {items.map(({ href, Icon, labelKey }) => (
        <Link
          key={href}
          href={href}
          className={`mobile-nav-item ${isActive(href) ? 'active' : ''}`}
          aria-label={t(labelKey as any)}
        >
          <Icon style={{ fontSize: 22 }} />
          <span>{t(labelKey as any)}</span>
        </Link>
      ))}
    </nav>
  );
}
