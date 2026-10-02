'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';

import { shouldAutoFocus } from '@/lib/tv-navigation';

interface Props {
  onAccept:  () => void;
  onDismiss: () => void;
}

export default function DisclaimerModal({ onAccept, onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <div role="dialog" aria-modal="true" data-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        width: '100%', maxWidth: 520,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        animation: 'scaleIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 22px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img src="/logo.svg" alt="Pixgo" style={{ height: 28, width: 'auto' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
            {t('disclaimer.title')}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
            {t('disclaimer.subtitle')}
          </p>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((n, idx) => (
            <React.Fragment key={n}>
              <div style={{ marginBottom: idx === 6 ? 4 : 16 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 5 }}>
                  {t(`disclaimer.s${n}t`)}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>
                  {t(`disclaimer.s${n}`)}
                </p>
              </div>
              {idx < 6 && <div style={{ height: 1, background: 'var(--color-border)', margin: '14px 0' }} />}
            </React.Fragment>
          ))}

          <a
            href={`mailto:${t('disclaimer.email')}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'monospace', fontSize: '0.82rem',
              color: 'var(--color-primary)', fontWeight: 700,
              textDecoration: 'none',
              padding: '6px 10px',
              background: 'rgba(229,9,20,0.06)',
              border: '1px solid rgba(229,9,20,0.18)',
              borderRadius: 6,
            }}
          >
            {t('disclaimer.email')}
          </a>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '14px 22px',
          display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <button
            onClick={onAccept}
            className="btn btn-primary"
            autoFocus={shouldAutoFocus()}
            style={{ flex: 1, justifyContent: 'center', minWidth: 130 }}
          >
            <CheckIcon style={{ fontSize: 16 }} />
            {t('disclaimer.accept')}
          </button>
          <button
            onClick={onDismiss}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center', minWidth: 130, fontSize: '0.82rem' }}
          >
            <BlockIcon style={{ fontSize: 15 }} />
            {t('disclaimer.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
