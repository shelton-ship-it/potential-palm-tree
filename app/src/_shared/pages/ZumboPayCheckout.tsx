'use client';
// ZumboPayCheckout.tsx — checkout embutido ZumboPay (MZ), dentro da própria
// página do Pixgo — nunca faz `window.location = checkout_url`.
//
// M-Pesa / e-Mola: STK push (POST /api/payments/zumbopay/charge) — o cliente
// recebe o PIN directamente no telemóvel; esta página só faz polling do
// NOSSO backend (não existe endpoint de status de /charges na doc do
// ZumboPay — a confirmação real só chega pelo webhook).
//
// Cartão: a doc do ZumboPay só documenta checkout hospedado (checkout_url,
// iframe MPGS) para Visa/Mastercard — não há tokenização própria. Para não
// enviar o utilizador para fora do Pixgo, carregamos esse checkout_url num
// <iframe> dentro desta página (mesmo espírito do widget overlay que a
// Hotmart já usa noutro sítio deste ficheiro — ver CheckoutPage.tsx).
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LockIcon from '@mui/icons-material/Lock';
import { API_BASE } from '../lib/api';
import { authedFetch } from '../store/auth';

type Method = 'mpesa' | 'emola' | 'card';

interface Props {
  planId: string;
  amount: number;
  currency: string;
  label?: string | null;
  onSuccess: () => void; // navega para a página de sucesso já existente
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 5 * 60 * 1000; // 5 min — depois disso, pede para verificar de novo manualmente

export default function ZumboPayCheckout({ planId, amount, currency, label, onSuccess }: Props) {
  const { t } = useTranslation();
  const [method, setMethod]   = useState<Method>('mpesa');
  const [msisdn, setMsisdn]   = useState('');
  const [status, setStatus]   = useState<'idle' | 'starting' | 'pending' | 'failed' | 'timeout'>('idle');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function startPolling(transactionId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await authedFetch(`${API_BASE}/api/payments/zumbopay/status/${transactionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          onSuccess();
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setStatus('failed');
        }
      } catch { /* falha de rede pontual — tenta de novo no próximo tick */ }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setStatus(s => (s === 'pending' ? 'timeout' : s));
    }, POLL_TIMEOUT_MS);
  }

  async function handleStart() {
    setErrorMsg(null);
    setStatus('starting');
    try {
      const body: Record<string, unknown> = { plan: planId, method };
      if (method !== 'card') body.msisdn = msisdn;

      const res = await authedFetch(`${API_BASE}/api/payments/zumbopay/charge`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('failed');
        setErrorMsg(data?.message || t('plans.paymentFailed'));
        return;
      }

      if (method === 'card' && data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        setStatus('pending');
        startPolling(data.transaction_id);
        return;
      }

      // M-Pesa/e-Mola: cliente já está a receber o popup do PIN no telemóvel.
      setStatus('pending');
      startPolling(data.transaction_id);
    } catch (err) {
      setStatus('failed');
      setErrorMsg(t('plans.paymentFailed'));
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{t('plans.checkoutTitle')}</div>
        </div>
        <div className="card-body">
          {/* Badge "Pague por M-Pesa" + ícone SVG no topo — pedido explícito
              para as páginas de pagamento em MZ mostrarem logo de início
              qual é o método suportado, antes mesmo de o utilizador reparar
              nos botões de método mais abaixo. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
            <img src="/payment-icons/M-PESA_LOGO-01.svg" alt="M-Pesa" style={{ height: 28 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {t('plans.payWithMpesa', 'Pague por M-Pesa')}
            </span>
          </div>

          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>
            {label || `${amount} ${currency}`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', borderRadius: 10, margin: '16px 0 22px' }}>
            <LockIcon style={{ fontSize: 18, color: 'var(--color-secondary)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{t('plans.securePaymentZumbopay', 'Pagamento processado com segurança pela NETHOST')}</span>
          </div>

          {status === 'pending' && checkoutUrl && (
            <iframe
              src={checkoutUrl}
              title="ZumboPay Checkout"
              style={{ width: '100%', height: 520, border: 'none', borderRadius: 12, marginBottom: 16 }}
            />
          )}

          {status !== 'pending' || !checkoutUrl ? (
            <>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {/* Só M-Pesa por agora — carteira e-Mola indisponível no
                    painel (pendente aprovação do lado do ZumboPay) e cartão
                    "Em breve". Voltar a incluir 'emola'/'card' assim que as
                    wallets existirem e ZUMBOPAY_WALLET_EMOLA/_CARD forem
                    configuradas. */}
                {(['mpesa'] as Method[]).map(m => (
                  <button
                    key={m}
                    className={`btn ${method === m ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMethod(m)}
                    disabled={status === 'starting' || status === 'pending'}
                  >
                    {m === 'mpesa' ? 'M-Pesa' : m === 'emola' ? 'e-Mola' : 'Cartão'}
                  </button>
                ))}
              </div>

              {method !== 'card' && (
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="84xxxxxxx ou 86xxxxxxx"
                  value={msisdn}
                  onChange={e => setMsisdn(e.target.value)}
                  disabled={status === 'starting' || status === 'pending'}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 16, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'inherit' }}
                />
              )}

              {status === 'pending' && (
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  {method === 'card'
                    ? t('plans.zumbopayCardPending', 'A carregar checkout seguro…')
                    : t('plans.zumbopayStkPending', 'Confirma o PIN no teu telemóvel para concluir o pagamento.')}
                </div>
              )}

              {status === 'timeout' && (
                <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                  {t('plans.zumbopayTimeout', 'Ainda não recebemos confirmação — se já pagaste, aguarda mais um pouco; caso contrário, tenta novamente.')}
                </div>
              )}

              {status === 'failed' && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {errorMsg || t('plans.paymentFailed')}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleStart}
                disabled={status === 'starting' || status === 'pending' || (method !== 'card' && msisdn.trim().length < 9)}
              >
                {status === 'starting' ? t('common.loading') : t('plans.continueToPayment')}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
