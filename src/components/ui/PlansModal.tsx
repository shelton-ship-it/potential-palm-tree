'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

// components/ui/PlansModal.tsx
//
// Modal de planos — pedido explícito: aparece só no /catalogo (nunca em
// /main, a home), só para utilizadores no plano free (inclui expirado —
// mesma regra usada em middleware/rate-limit.js), e no máximo 1x por
// dia (persistente via localStorage, não sessionStorage — sobrevive a
// fechar/reabrir o browser).
//
// Preço/nome/features vêm SEMPRE de GET /api/payments/plans (lib/edgeone.js
// PLANS) — nada aqui é hardcoded, mesma fonte de verdade que RateLimitModal
// já usa para o modal de "limite diário atingido".
//
// Falha silenciosa: se o fetch dos planos falhar, o modal simplesmente não
// aparece (não vale a pena mostrar um erro por causa disto) — e o
// localStorage só é marcado quando o modal REALMENTE abre com dados, para
// não "queimar" o dia por causa de uma falha de rede.

const SEEN_KEY = 'px_plans_modal_last_seen';

type Plan = {
  id: string;
  name: string;
  price: number;
  label: string;
  billing_cycle: string | null;
  features: string[];
};

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, suficiente pra "1x por dia"
}

export default function PlansModal() {
  const router    = useRouter();
  const user      = useAuthStore(s => s.user);
  const hydrated  = useAuthStore(s => s.hydrated);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [open, setOpen]   = useState(false);
  // FIX: pedido explícito — o modal aparecia centralizado no documento
  // inteiro (via position:fixed), o que em certos webviews (ex.: TV) não
  // acompanha o scroll real do utilizador, fazendo o modal "aparecer"
  // longe da parte do ecrã onde a pessoa está a ver o catálogo. Guardamos
  // o scroll actual e usamos position:absolute ancorado a esse valor (ver
  // overlayTop abaixo), em vez de confiar cegamente no fixed.
  const [overlayTop, setOverlayTop] = useState(() =>
    typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0
  );

  // Mesma regra de "é free" usada no backend (isPlanActive): id 'free' ou
  // sem plan_id reconhecido conta como free. Não tentamos replicar a
  // verificação de expiração aqui (não temos expires_at no user do store) —
  // se necessário no futuro, dá pra ler de GET /api/payments/subscription,
  // que já faz essa conta correctamente no servidor.
  const isFree = !!user && (!user.plan_id || user.plan_id === 'free');

  useEffect(() => {
    if (!hydrated || !isFree) return; // espera o auth carregar; nunca mostra a pagantes

    let lastSeen: string | null = null;
    try { lastSeen = localStorage.getItem(SEEN_KEY); } catch { /* modo privado, etc — trata como "nunca visto" */ }
    if (lastSeen === todayStr()) return;

    let cancelled = false;
    paymentsApi.plans()
      .then((data: Plan[]) => {
        if (cancelled || !Array.isArray(data) || !data.length) return;
        setPlans(data);
        setOpen(true);
        try { localStorage.setItem(SEEN_KEY, todayStr()); } catch { /* best-effort */ }
      })
      .catch(() => { /* falha silenciosa — não é crítico o suficiente pra incomodar */ });

    return () => { cancelled = true; };
  }, [hydrated, isFree]);

  // Mantém o overlay colado à parte do ecrã onde o utilizador está,
  // mesmo que ele continue a fazer scroll com o modal já aberto (ou que
  // o próprio "fixed" falhe silenciosamente no webview em uso).
  useEffect(() => {
    if (!open) return;
    const updatePosition = () => setOverlayTop(window.scrollY || window.pageYOffset || 0);
    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  // OTIMIZAÇÃO (produção): botão "Ver planos" só fazia router.push, nunca
  // pré-buscado — assim que o modal abre com dados, já prepara a rota.
  useEffect(() => {
    if (open) router.prefetch('/main/plans');
  }, [open, router]);

  if (!open || !plans) return null;

  const paid      = plans.filter(p => p.id !== 'free');
  const featured  = paid.find(p => p.billing_cycle === 'monthly') || paid[0];
  const others    = paid.filter(p => p.id !== featured?.id);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      style={{ position: 'absolute', top: overlayTop, left: 0, right: 0, bottom: 'auto', height: '100vh' }}
    >
      <div className="modal scale-in" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ padding: '32px 26px' }}>
          {/* FIX (pedido explícito): este modal é promocional — deve mostrar
              só o essencial da assinatura (o plano pago em destaque), nunca
              informação sobre a limitação do plano Free (nem o texto
              genérico que existia aqui antes, nem o número de horas vindo
              de PLANS.free.features em lib/edgeone.js). Título trocado de
              "Conheça os nossos planos" para "Aproveite a promoção". */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 18 }}>
            Aproveite a promoção
          </h2>

          {featured && (
            <div style={{
              background: 'var(--color-bg-darker)', borderRadius: 10, padding: '16px 18px',
              marginBottom: 14, border: '1px solid var(--color-primary)', textAlign: 'left',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {featured.name}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 900 }}>
                {featured.label}
              </div>
              {featured.features?.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {featured.features.map((f, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>✓ {f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {others.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 18 }}>
              Também disponível: {others.map(p => p.label).join(' · ')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => router.push('/main/plans')}>
              Ver planos
            </button>
            <button className="btn btn-ghost btn-sm" data-modal-close onClick={() => setOpen(false)}>
              Continuar no grátis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
