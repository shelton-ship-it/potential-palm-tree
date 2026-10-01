'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { shouldAutoFocus } from '@/lib/tv-navigation';

interface Props {
  onDismiss: () => void; // "Entendi" e "Ocultar" levam ao mesmo sítio (avançar para o UploadGuideModal)
}

// UploadRulesModal.tsx — pedido explícito: distinto do UploadTermsModal
// (esse é o consentimento formal, Aceito/Não aceito, mostrado uma única vez
// e persistido em localStorage antes de dar acesso ao formulário). Este
// modal é um lembrete, não um novo consentimento — por isso não tem
// Aceito/Recusa, e reaparece sempre que se entra em /main/upload, mesmo
// depois dos termos já terem sido aceites. Segue o mesmo padrão visual do
// DisclaimerModal/UploadTermsModal (header com título/subtítulo, corpo com
// secções tituladas, rodapé com dois botões).
export default function UploadRulesModal({ onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <div role="dialog" aria-modal="true" data-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
        borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)', animation: 'scaleIn 0.2s ease',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
            {t('uploadRules.title')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {t('uploadRules.subtitle')}
          </p>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {Array.from({ length: 3 }, (_, i) => i + 1).map((n, idx) => (
            <React.Fragment key={n}>
              <div style={{ marginBottom: idx === 2 ? 0 : 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 6 }}>
                  {t(`uploadRules.s${n}t`)}
                </h3>
                <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                  {t(`uploadRules.s${n}`)}
                </p>
              </div>
              {idx < 2 && <div style={{ height: 1, background: 'var(--color-border)', margin: '16px 0' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={onDismiss} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', minWidth: 130 }}>
            {t('uploadRules.hide')}
          </button>
          <button onClick={onDismiss} className="btn btn-primary" autoFocus={shouldAutoFocus()} style={{ flex: 1, justifyContent: 'center', minWidth: 130 }}>
            {t('uploadRules.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
