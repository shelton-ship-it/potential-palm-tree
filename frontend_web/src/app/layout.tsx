import './globals.css';
import type { Metadata, Viewport } from 'next';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title:       { default: 'Pixgo', template: '%s · Pixgo' },
  description: 'Pixgo — Stream movies, series, anime and live TV.',
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:          true,
    statusBarStyle:   'black-translucent',
    title:            'Pixgo',
    startupImage:     '/icons/icon-512.png',
  },
  icons: {
    icon:  [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  other: {
    'msapplication-TileColor': '#e50914',
    'msapplication-TileImage': '/icons/icon-144.png',
  },
};

export const viewport: Viewport = {
  themeColor:           '#e50914',
  width:                'device-width',
  initialScale:         1,
  viewportFit:          'cover',   // important for notch/safe-area
  userScalable:         false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800;900&display=swap" rel="stylesheet" />
        {/* PWA service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
        {/* TV: prevent text selection with remote */}
        <style>{`
          @media (hover: none) and (pointer: coarse) {
            * { -webkit-user-select: none; user-select: none; }
            input, textarea { -webkit-user-select: text; user-select: text; }
          }
        `}</style>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
