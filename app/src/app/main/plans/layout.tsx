// layout.tsx (Server Component) — fluxo de pagamento nunca estático/cacheado.
// As páginas filhas são 'use client', por isso a config de segmento vive aqui.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
