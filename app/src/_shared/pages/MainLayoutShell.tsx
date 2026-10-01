'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../store/auth';
import AppShell, { NavItem } from '../components/layout/AppShell';
import MobileNav from '../components/layout/MobileNav';

// Vazio (padrão) = login local, usado pelo hub central (app.pixgo.qzz.io).
// Nas plataformas satélite, NEXT_PUBLIC_ACCOUNT_URL aponta para o hub central —
// sem sessão válida (cookie partilhado), o utilizador é mandado pra lá em
// vez de existir um /auth/login duplicado em cada subdomínio.
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL || '';

// Rotas acessíveis sem sessão: a página inicial (agora landing pública com
// botões Iniciar/Registrar) e as páginas institucionais/legais. Todas as
// outras continuam a exigir login, exactamente como antes.
const PUBLIC_PATHS = ['/main', '/main/about', '/main/terms', '/main/privacy', '/main/security', '/main/cookies', '/main/copyright', '/main/faq'];

export default function MainLayoutShell({ children, extraNav = [] }: { children: React.ReactNode; extraNav?: NavItem[] }) {
  const pathname  = usePathname();
  const isPublic  = PUBLIC_PATHS.includes(pathname || '');
  const fetchMe   = useAuthStore(s => s.fetchMe);
  const hydrated  = useAuthStore(s => s.hydrated);
  const user      = useAuthStore(s => s.user);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchMe().then(ok => {
      // Em página pública nunca redireciona — só serve para o header saber
      // se há sessão (mostrar avatar em vez de Iniciar/Registrar).
      if (!ok && !isPublic) {
        const returnTo = encodeURIComponent(window.location.href);
        const loginUrl = ACCOUNT_URL ? `${ACCOUNT_URL}/auth/login?return_to=${returnTo}` : `/auth/login?return_to=${returnTo}`;
        window.location.href = loginUrl;
        return;
      }
      setChecked(true);
    });
  }, []);

  // Página pública: renderiza assim que o pedido de sessão terminar (com ou
  // sem utilizador), sem exigir login nem bloquear com o spinner.
  if (isPublic) {
    if (!checked) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-dark)' }}>
        <div className="loading-ring" />
      </div>
    );
    return (
      <>
        <AppShell extraNav={extraNav}>{children}</AppShell>
        <MobileNav extraNav={extraNav} />
      </>
    );
  }

  if (!hydrated || !checked || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-dark)' }}>
      <div className="loading-ring" />
    </div>
  );

  return (
    <>
      <AppShell extraNav={extraNav}>{children}</AppShell>
      <MobileNav extraNav={extraNav} />
    </>
  );
}
