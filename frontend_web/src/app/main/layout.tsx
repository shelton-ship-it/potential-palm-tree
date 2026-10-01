'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import AppShell from '@/components/layout/AppShell';
import PixelChatbot from '@/components/PixelChatbot';
import { loginRedirectUrl } from '@/lib/auth-redirect';
import { resumeInterruptedDownloads } from '@/lib/downloads-resume';
import { pushHistory, replaceHistoryTop } from '@/lib/nav-history';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const token        = useAuthStore(s => s.token);
  const hydrated     = useAuthStore(s => s.hydrated);

  useEffect(() => {
    // FIX: preserva a página actual (ex.: /main/watch/123) no return_to,
    // para o hub devolver o utilizador exactamente aqui depois do login —
    // antes caía sempre em /main (ver src/lib/auth-redirect.ts).
    if (hydrated && !token) router.replace(loginRedirectUrl());
  }, [hydrated, token]);

  useEffect(() => {
    // FIX: retoma automaticamente qualquer download que tenha ficado a
    // meio (refresh, fecho da aba, queda de rede) assim que há sessão —
    // sem isto, o download ficava parado para sempre em X% até o
    // utilizador reabrir manualmente o título e clicar em Baixar de novo.
    if (hydrated && token) resumeInterruptedDownloads();
  }, [hydrated, token]);

  // FIX (voltar sempre ia para a home, em qualquer página): ponto único de
  // rastreio da nossa pilha de navegação (ver lib/nav-history.ts) — regista
  // cada mudança de pathname/searchParams dentro de /main/*. Usamos
  // window.history.length pra distinguir uma navegação real (router.push —
  // o histórico do browser cresce) de uma troca de filtros na mesma página
  // (router.replace, ex.: categoria do catálogo — histórico não cresce),
  // já que ambas disparam usePathname/useSearchParams da mesma forma.
  const prevHistoryLenRef = useRef<number>(typeof window !== 'undefined' ? window.history.length : 0);
  useEffect(() => {
    const qs  = searchParams.toString();
    const url = pathname + (qs ? `?${qs}` : '');
    const len = window.history.length;
    if (len > prevHistoryLenRef.current) pushHistory(url);
    else                                 replaceHistoryTop(url);
    prevHistoryLenRef.current = len;
  }, [pathname, searchParams]);

  if (!hydrated) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-bg-dark)' }}>
      <div className="loading-ring" />
    </div>
  );

  if (!token) return null;

  return (
    <>
      <AppShell>{children}</AppShell>
      {/* FIX (pedido explícito): a bottom nav própria do mobile ("banida")
          deixou de existir — o sidebar (com o botão de menu no header,
          ver AppShell.tsx) já cobre a navegação em qualquer largura de
          ecrã, overlay incluído no mobile (.sidebar-overlay). Duas
          barras de navegação a fazer a mesma coisa era redundante. */}
      <PixelChatbot />
    </>
  );
}
