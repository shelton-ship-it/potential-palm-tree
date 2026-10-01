import '../_shared/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Providers } from '@/_shared';

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Pixgo';
const PLATFORM_DESC  = process.env.NEXT_PUBLIC_PLATFORM_DESC  || 'A tua conta Pixgo.';
const THEME_COLOR    = process.env.NEXT_PUBLIC_THEME_COLOR    || '#e50914';

export const metadata: Metadata = {
  title:       { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: PLATFORM_DESC,
  manifest:    '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: PLATFORM_NAME, startupImage: '/icons/icon-512.png' },
  icons: {
    icon:  [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  other: { 'msapplication-TileColor': THEME_COLOR, 'msapplication-TileImage': '/icons/icon-144.png' },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR, width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800;900&display=swap" rel="stylesheet" />
        {/*
          FIX: o botão "Instalar aplicação" abria o diálogo mas o clique em
          "Instalar" não fazia nada. Causa: o custom element <pwa-install>
          só era registado por um import() dinâmico disparado dentro de um
          useEffect do próprio botão — a essa altura o beforeinstallprompt
          do browser (que só dispara uma vez, e só é entregue a quem já
          estiver a ouvir nesse preciso momento) já podia ter disparado e
          sido perdido. Carregar o custom element aqui, beforeInteractive,
          garante que o listener interno da biblioteca está pronto antes da
          página se tornar interactiva — antes de o browser decidir disparar
          o evento.
        */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@khmyznikov/pwa-install@0.6.4/dist/pwa-install.js"
          type="module"
          strategy="beforeInteractive"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function() {});
          }
        `}} />
      </head>
      <body>
        {/* Elemento único, partilhado por todos os botões "Instalar
            aplicação" da app (ver InstallPWAButton.tsx) — presente desde o
            primeiro paint, não criado tardiamente por um portal. */}
        {/* @ts-ignore — web component */}
        <pwa-install manual-apple="true" manual-chrome="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
