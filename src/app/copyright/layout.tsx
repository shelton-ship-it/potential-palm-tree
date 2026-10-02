// src/app/copyright/layout.tsx
// As páginas de denúncia (formulário, resposta e Portal de Proteção) mostram o
// estado atual das notificações e nunca podem ser cacheadas: renderização
// dinâmica sem revalidação. Complementa os cabeçalhos no-store de
// next.config.js e edgeone.json e a exclusão no service worker (public/sw.js).
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'Pixgo',
  robots: { index: false, follow: false },
};

export default function CopyrightLayout({ children }: { children: React.ReactNode }) {
  return children;
}
