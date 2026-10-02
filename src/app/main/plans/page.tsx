'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { paymentsApi } from '@/lib/api';
import CheckIcon from '@mui/icons-material/Check';
import PlansNoticeModal from '@/components/modals/PlansNoticeModal';

// ─────────────────────────────────────────────────────────────────────────
// v3.0 — Preço, nome e features vêm SEMPRE do backend (GET /api/payments/plans,
// PLANS já limpo de cripto). Antes disto era um array PLANS fixo aqui no
// frontend — se o preço mudasse no backend (ou no Hotmart), esta página
// ficava desactualizada sem ninguém notar. "highlight" (querystring) vem do
// RateLimitModal do player, quando a pessoa chega aqui a partir do aviso de
// limite atingido — destaca o plano que já lhe foi sugerido lá.
// ─────────────────────────────────────────────────────────────────────────

const HUB_CHECKOUT_URL = 'https://app.pixgo.qzz.io/main/plans/checkout';

type Plan = {
  id: string; name: string; price: number; label: string;
  billing_cycle: string | null; max_profiles: number; max_downloads: number | null;
  features: string[];
  // Presentes só quando GET /api/payments/plans aplica um override de país
  // (ver routes/payments.js + lib/plan-pricing.js no api-core — MZ →
  // currency:'MZN', gateway:'zumbopay'). Ausentes = preço BRL/Hotmart normal.
  currency?: string;
  gateway?: string;
};

const PAYMENT_METHODS = [
  { name: 'Pix',        icon: '/payment-icons/pix.svg' },
  { name: 'Visa',       icon: '/payment-icons/visa.svg' },
  { name: 'Mastercard', icon: '/payment-icons/mastercard.svg' },
  { name: 'Boleto',     icon: '/payment-icons/boleto.svg' },
];

// FIX: pedido explícito — quando o país detectado é Moçambique, o backend
// já devolve currency:'MZN' nos planos (gateway ZumboPay) em vez do preço
// BRL/Hotmart default. Nesse caso só o M-Pesa deve aparecer como método de
// pagamento; nos restantes casos, mantém-se a lista tradicional acima.
const MPESA_METHOD = { name: 'M-Pesa', icon: '/payment-icons/M-PESA_LOGO-01.svg' };

export default function PlansPage() {
  const { t }  = useTranslation();
  const sp     = useSearchParams();
  const highlight = sp.get('highlight'); // vindo do modal de limite atingido, se aplicável
  const plan   = useAuthStore(s => s.plan);
  const isPremium = plan && plan.id !== 'free' && plan.is_active;

  // Aviso jurídico: abre SEMPRE que se entra nesta página (sem memória).
  const [showNotice, setShowNotice] = useState(true);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Basta 1 plano vir com currency:'MZN' (todos os pagos partilham o mesmo
  // override de país) para saber que o gateway activo é o ZumboPay/M-Pesa.
  const isMZN = plans.some(p => p.currency === 'MZN');
  const paymentMethods = isMZN ? [MPESA_METHOD] : PAYMENT_METHODS;

  useEffect(() => {
    let active = true;
    paymentsApi.plans()
      .then((data: Plan[]) => { if (active) setPlans((data || []).filter(p => p.id !== 'free')); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // OTIMIZAÇÃO (produção): handleSubscribe navega via window.location.href
  // para outro domínio (HUB_CHECKOUT_URL), então router.prefetch (só
  // funciona para rotas do mesmo app Next) não se aplica aqui. O
  // equivalente cross-origin é um preconnect — resolve DNS/TLS desse
  // domínio ANTES do clique em "Assinar", em vez de só no momento do clique.
  useEffect(() => {
    const origin = new URL(HUB_CHECKOUT_URL).origin;
    const link = document.createElement('link');
    link.rel  = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const handleSubscribe = (planId: string) => {
    // FIX: usava sempre "${origin}/main" — o utilizador perdia a página
    // onde estava (ex.: a meio de um vídeo) e voltava sempre para a home
    // depois do checkout. Agora preserva a página actual completa.
    const returnTo = encodeURIComponent(
      `${window.location.origin}${window.location.pathname}${window.location.search}`
    );
    window.location.href = `${HUB_CHECKOUT_URL}?plan=${planId}&return_to=${returnTo}`;
  };

  return (
    <div>
      {showNotice && <PlansNoticeModal onDismiss={() => setShowNotice(false)} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('plans.title', 'Planos')}</h1>
          <p className="page-subtitle">{t('plans.subtitle', 'Escolha o plano que melhor se adapta ao seu uso')}</p>
          {isMZN && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <img src={MPESA_METHOD.icon} alt="M-Pesa" style={{ height: 26 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('plans.payWithMpesa', 'Pague por M-Pesa')}</span>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="page-loading"><div className="loading-ring" /></div>}

      {!loading && error && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Não foi possível carregar os planos agora. Tenta novamente em instantes.
        </p>
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 28 }}>
          {plans.map(p => {
            const isCurrent  = plan?.id === p.id && isPremium;
            // "Melhor valor" é o anual por convenção de negócio (mais barato
            // por mês) — a menos que a pessoa tenha chegado aqui vinda do
            // modal de limite atingido com outro plano sugerido, esse ganha
            // prioridade visual.
            const isFeatured = highlight ? p.id === highlight : p.billing_cycle === 'annual';
            return (
              <div key={p.id} className={`plan-card ${isFeatured ? 'featured' : ''}`} style={{ flex: '1 1 280px', minWidth: 260, maxWidth: 340, position: 'relative' }}>
                {isFeatured && <span className="badge badge-red" style={{ position: 'absolute', top: 14, right: 14 }}>Melhor valor</span>}
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 14 }}>{p.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {(p.features || []).map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                      <CheckIcon style={{ fontSize: 16, color: 'var(--color-secondary)', flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    <CheckIcon style={{ fontSize: 16, color: 'var(--color-secondary)', flexShrink: 0, marginTop: 1 }} />
                    {p.max_profiles} {p.max_profiles === 1 ? 'perfil' : 'perfis'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    <CheckIcon style={{ fontSize: 16, color: 'var(--color-secondary)', flexShrink: 0, marginTop: 1 }} />
                    {p.max_downloads == null ? 'Downloads ilimitados' : `Até ${p.max_downloads} downloads/mês`}
                  </div>
                </div>
                {isCurrent ? (
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} disabled>Plano atual</button>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleSubscribe(p.id)}>
                    Assinar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>Métodos de pagamento aceites</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {paymentMethods.map(m => (
            <img key={m.name} src={m.icon} alt={m.name} title={m.name} style={{ height: 32, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
