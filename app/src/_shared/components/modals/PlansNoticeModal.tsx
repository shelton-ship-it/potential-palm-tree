'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onDismiss: () => void;
}

// PlansNoticeModal.tsx — aviso jurídico sobre as assinaturas. Aparece SEMPRE
// que se entra em /plans e ao clicar na aba "Assinatura" da conta (nunca fica
// memorizado: sem localStorage, sem "não mostrar outra vez"). Só fecha no
// botão "Entendi" — o fundo não fecha o modal, de propósito, para que a
// leitura seja deliberada. Texto no mesmo registo dos Termos de Serviço:
// a plataforma não vende conteúdo; cobra pelo uso do serviço (SaaS/player).
export default function PlansNoticeModal({ onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="plans-notice-title" data-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
        borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <h2 id="plans-notice-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
            {t('plansNotice.title')}
          </h2>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {['p1', 'p2', 'p3'].map((k, i) => (
            <p key={k} style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: i === 2 ? 0 : '0 0 12px' }}>
              {t(`plansNotice.${k}`)}
            </p>
          ))}
        </div>
        <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <button onClick={onDismiss} className="btn btn-primary"  style={{ width: '100%', justifyContent: 'center' }}>
            {t('plansNotice.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
