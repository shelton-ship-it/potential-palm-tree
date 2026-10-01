'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { shouldAutoFocus } from '@/lib/tv-navigation';

interface Props {
  onDismiss: () => void;
}

// UploadGuideModal.tsx — pedido explícito: aparece logo a seguir ao
// UploadRulesModal (nunca sozinho), com o mesmo par de botões
// Entendi/Ocultar. Enquanto o UploadRulesModal é sobre regras e
// consequências, este é puramente prático — como preencher o formulário
// que vem a seguir. Mesmo padrão visual dos outros modais.
export default function UploadGuideModal({ onDismiss }: Props) {
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
            {t('uploadGuide.title')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {t('uploadGuide.subtitle')}
          </p>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {Array.from({ length: 4 }, (_, i) => i + 1).map((n, idx) => (
            <React.Fragment key={n}>
              <div style={{ marginBottom: idx === 3 ? 0 : 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 6 }}>
                  {t(`uploadGuide.s${n}t`)}
                </h3>
                <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                  {t(`uploadGuide.s${n}`)}
                </p>
              </div>
              {idx < 3 && <div style={{ height: 1, background: 'var(--color-border)', margin: '16px 0' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={onDismiss} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', minWidth: 130 }}>
            {t('uploadGuide.hide')}
          </button>
          <button onClick={onDismiss} className="btn btn-primary" autoFocus={shouldAutoFocus()} style={{ flex: 1, justifyContent: 'center', minWidth: 130 }}>
            {t('uploadGuide.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
