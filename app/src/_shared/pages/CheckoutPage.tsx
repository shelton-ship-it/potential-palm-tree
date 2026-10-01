'use client';
import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import LockIcon from '@mui/icons-material/Lock';
import ZumboPayCheckout from './ZumboPayCheckout';
import { API_BASE } from '../lib/api';
import { authedFetch } from '../store/auth';

// Links de checkout Hotmart — um por plano, definidos no env de CADA
// plataforma (a API é única; o checkout é externo e específico do produto
// Hotmart de cada serviço).
const CHECKOUT_LINKS: Record<string, string | undefined> = {
  monthly:   process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_MONTHLY,
  quarterly: process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_QUARTERLY,
  annual:    process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_ANNUAL,
};

const CHECKOUT_RETURN_COOKIE = 'pixgo_checkout_return';

// Cookie curto (1h) no domínio partilhado .pixgo.qzz.io — as Thank You Pages
// da Hotmart são URLs FIXAS (configuradas no painel deles, não dá pra passar
// dinamicamente por parâmetro), então é assim que elas, já de volta aqui,
// sabem pra qual das plataformas reencaminhar o utilizador.
function setCheckoutReturnCookie(url: string) {
  const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
  document.cookie = `${CHECKOUT_RETURN_COOKIE}=${encodeURIComponent(url)}; expires=${expires}; path=/; domain=.pixgo.qzz.io; secure; samesite=lax`;
}

// v3.0 — WIDGET EMBUTIDO em vez de redirect. Código exactamente como
// fornecido pela Hotmart: carrega o script + CSS uma vez; a classe
// "hotmart-fb" no <a> é o que o script deles intercepta para abrir o
// checkout embutido (overlay), sem sair desta página.
let widgetLoaded = false;
function loadHotmartWidget() {
  if (widgetLoaded) return;
  widgetLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://static.hotmart.com/checkout/widget.min.js';
  document.head.appendChild(script);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'https://static.hotmart.com/css/hotmart-fb.min.css';
  document.head.appendChild(link);
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore(s => s.user);
  const planId = params.get('plan') || 'monthly';
  const checkoutUrl = CHECKOUT_LINKS[planId];
  const returnTo = params.get('return_to');

  // Resolução de gateway — SEMPRE decidida pelo backend (país/preço/gateway),
  // nunca pelo frontend (regra "backend como autoridade"). Se este endpoint
  // novo falhar por qualquer razão, cai em segurança para o fluxo Hotmart
  // existente, que não é afectado por nada disto.
  const [gateway, setGateway] = React.useState<{
    gateway: 'hotmart' | 'zumbopay'; currency: string; amount: number | null; label: string | null;
  } | null>(null);

  useEffect(() => {
    authedFetch(`${API_BASE}/api/payments/gateway?plan=${encodeURIComponent(planId)}`)
      .then(r => r.json())
      .then(setGateway)
      .catch(() => setGateway({ gateway: 'hotmart', currency: 'USD', amount: null, label: null }));
  }, [planId]);

  useEffect(() => {
    if (gateway?.gateway === 'hotmart') loadHotmartWidget();
  }, [gateway]);

  // Guarda o return_to já ao entrar nesta página (antes do clique) — como o
  // checkout agora acontece embutido, sem navegação, é mais seguro gravar o
  // cookie assim que sabemos para onde regressar do que só no clique.
  useEffect(() => {
    if (returnTo) setCheckoutReturnCookie(decodeURIComponent(returnTo));
  }, [returnTo]);

  if (!gateway) {
    return <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (gateway.gateway === 'zumbopay') {
    return (
      <ZumboPayCheckout
        planId={planId}
        amount={gateway.amount ?? 0}
        currency={gateway.currency}
        label={gateway.label}
        // FIX: a rota real é /main/plans/checkout/success (a anterior, /main/plans/success,
        // não existe → 404 após pagar). O return_to segue no cookie definido à entrada.
        onSuccess={() => router.replace('/main/plans/checkout/success')}
      />
    );
  }

  // ── A partir daqui, fluxo Hotmart EXISTENTE — nenhuma linha alterada ──────

  if (!checkoutUrl) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto' }}>
        <div className="card">
          <div className="card-body">
            <div className="alert alert-warning">Checkout indisponível para este plano no momento.</div>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => router.back()}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A Hotmart identifica o comprador pelo e-mail no checkout — passamos o
  // e-mail da conta já logada para pré-preencher e permitir ligar a compra
  // ao utilizador certo via webhook (ver api-core/routes/plans.js).
  const url = new URL(checkoutUrl);
  url.searchParams.set('checkoutMode', '2'); // modo embutido/overlay, não redirect
  if (user?.email) url.searchParams.set('email', user.email);

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{t('plans.checkoutTitle')}</div>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 20 }}>
            {t('plans.checkoutDesc')}
          </p>

          {/* Ícones dos métodos aceites (fora de MZ) no topo — mesmo
              espírito do badge M-Pesa do ZumboPayCheckout.tsx. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <img src="/payment-icons/pix.svg" alt="Pix" style={{ height: 24 }} />
            <img src="/payment-icons/visa.svg" alt="Visa" style={{ height: 24 }} />
            <img src="/payment-icons/mastercard.svg" alt="Mastercard" style={{ height: 24 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 22 }}>
            <LockIcon style={{ fontSize: 18, color: 'var(--color-secondary)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{t('plans.securePaymentHotmart', 'Pagamento processado com segurança por Pix ou Visa/Mastercard')}</span>
          </div>

          {/* Botão real do widget da Hotmart — não é um <button> normal.
              onClick preventDefault + classe hotmart-fb: exactamente o
              snippet fornecido pela Hotmart, o script deles é que faz o
              resto (abrir o checkout embutido ao clicar). */}
          <a
            onClick={(e) => e.preventDefault()}
            href={url.toString()}
            className="hotmart-fb hotmart__button-checkout"
            style={{ display: 'block' }}
          >
            <img
              src="https://static.hotmart.com/img/btn-buy-green.png"
              alt={t('plans.continueToPayment')}
              style={{ maxWidth: '100%' }}
            />
          </a>

          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => router.back()}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
