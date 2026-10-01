'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import CheckIcon from '@mui/icons-material/Check';
import { plansApi, API_BASE } from '../lib/api';
import { useAuthStore, authedFetch } from '../store/auth';
import { formatPlanPrice } from '../lib/planPrice';
import PlansNoticeModal from '../components/modals/PlansNoticeModal';

export interface PlanFeatures {
  free?: string[];
  monthly?: string[];
  quarterly?: string[];
  annual?: string[];
}

// Moeda/preço exibidos: vêm de GET /api/plans (backend decide por país — para
// MZ traz currency:'MZN' e o valor em meticais; ver lib/planPrice.ts). O
// símbolo por omissão (NEXT_PUBLIC_CURRENCY_SYMBOL, R$) só é usado quando o
// backend não manda `currency`.

export default function PlansPage({ features }: { features: PlanFeatures }) {
  const { t } = useTranslation();
  // Aviso jurídico: abre SEMPRE que se entra nesta página (sem memória).
  const [showNotice, setShowNotice] = useState(true);
  const router = useRouter();
  const params = useSearchParams();
  const plan = useAuthStore(s => s.plan);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // FIX: quando esta página chega com ?return_to= (ex.: vindo de outra
  // plataforma *.pixgo.qzz.io), o botão "Assinar" tinha de continuar a
  // levar esse parâmetro para o checkout — senão perdia-se aqui e o
  // CheckoutSuccessPage nunca sabia para onde reencaminhar no fim.
  const returnTo = params.get('return_to');

  // Modal de "limite atingido" — uma ferramenta (compresshub/etc) redirecciona
  // para cá com ?limit_reached=1 quando o heartbeat dela devolve 403
  // (10min/dia esgotados no free — ver middleware/tool-usage.js do
  // api-core). Preço/nome vêm sempre de `plans` (já buscado do backend
  // acima) — nada aqui é hardcoded.
  const limitReached = params.get('limit_reached') === '1';
  const [showLimitModal, setShowLimitModal] = useState(limitReached);

  useEffect(() => {
    plansApi.list().then((res: any) => setPlans(res.plans || [])).finally(() => setLoading(false));
  }, []);

  // Gateway activo (decidido SEMPRE pelo backend, por país) — só serve aqui
  // para mostrar o badge "Pague por M-Pesa" no topo quando for ZumboPay/MZ.
  // Falha silenciosa: sem badge, o resto da página não é afectado.
  const [isMZ, setIsMZ] = useState(false);
  useEffect(() => {
    let active = true;
    authedFetch(`${API_BASE}/api/payments/gateway?plan=monthly`, { cache: 'no-store' })
      .then(r => r.json())
      .then(g => { if (active) setIsMZ(g?.gateway === 'zumbopay'); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="page-loading"><span className="loading-ring" /></div>;
  }

  const monthly = plans.find(p => p.id === 'monthly');
  // Moeda dos planos pagos (ex.: MZN em Moçambique) — o plano grátis herda-a.
  const listCurrency: string | undefined = plans.find(p => p.currency)?.currency;

  return (
    <div>
      {showNotice && <PlansNoticeModal onDismiss={() => setShowNotice(false)} />}
      {showLimitModal && monthly && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal scale-in" style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ padding: '32px 26px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏱</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 8 }}>
                Limite diário atingido
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 18, lineHeight: 1.6 }}>
                Você atingiu o limite gratuito de uso desta ferramenta hoje. Assine para uso ilimitado em todas as plataformas.
              </p>
              <div style={{
                background: 'var(--color-bg-darker)', borderRadius: 10, padding: '16px 18px',
                marginBottom: 18, border: '1px solid var(--color-primary)',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  {t(`plans.${monthly.id}`, monthly.name)}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}>
                  por apenas {formatPlanPrice(monthly)}/mês
                </div>
                {(features.monthly || []).length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {(features.monthly || []).map((f, i) => <li key={i} style={{ marginBottom: 4 }}>✓ {f}</li>)}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push(`/main/plans/checkout?plan=monthly${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ''}`)}
                >
                  Assinar
                </button>
                <button className="btn btn-ghost btn-sm" data-modal-close onClick={() => setShowLimitModal(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('plans.title')}</h1>
          <p className="page-subtitle">{t('plans.subtitle')}</p>
          {isMZ && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <img src="/payment-icons/M-PESA_LOGO-01.svg" alt="M-Pesa" style={{ height: 26 }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('plans.payWithMpesa', 'Pague por M-Pesa')}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {plans.map(p => {
          const isCurrent = plan?.id === p.id && plan?.is_active !== false;
          const featured = p.id === 'annual';
          return (
            <div key={p.id} className={`plan-card ${featured ? 'featured' : ''}`} style={{ flex: '1 1 280px', minWidth: 260, maxWidth: 340 }}>
              {featured && <span className="badge badge-red" style={{ position: 'absolute', top: 14, right: 14 }}>Melhor valor</span>}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 4 }}>
                {t(`plans.${p.id}`, p.name)}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, marginBottom: 14 }}>
                {formatPlanPrice(p, listCurrency)}
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {!p.is_free && (p.id === 'annual' ? '/ano' : p.id === 'quarterly' ? '/trimestre' : '/mês')}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {(features[p.id as keyof PlanFeatures] || []).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    <CheckIcon style={{ fontSize: 16, color: 'var(--color-secondary)', flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} disabled>{t('plans.current')}</button>
              ) : p.is_free ? (
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} disabled>{t('plans.free')}</button>
              ) : (
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push(`/main/plans/checkout?plan=${p.id}${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ''}`)}>
                  {t('plans.subscribe')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
