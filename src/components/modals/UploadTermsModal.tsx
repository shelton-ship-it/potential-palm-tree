'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';

import { shouldAutoFocus } from '@/lib/tv-navigation';

interface Props {
  onAccept: () => void;
  onClose: () => void;
}

// UploadTermsModal.tsx — termos e políticas específicos do envio de
// conteúdo, mostrados uma vez (persistido em localStorage) antes de dar
// acesso ao formulário real. Distinto do DisclaimerModal geral (esse é
// sobre a plataforma como um todo, mostrado após login).
export default function UploadTermsModal({ onAccept, onClose }: Props) {
  const { t } = useTranslation();

  const sections = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);

  return (
    <div role="dialog" aria-modal="true" data-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t('upload.termsTitle')}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('upload.termsSubtitle')}</p>
          </div>
          <button onClick={onClose} data-modal-close className="icon-btn" style={{ width: 32, height: 32, flexShrink: 0 }}>
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {sections.map(s => (
            <div key={s} style={{ marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 6 }}>
                {t(`upload.${s}t`)}
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {t(`upload.${s}`)}
              </p>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            {t('upload.decline')}
          </button>
          <button onClick={onAccept} className="btn btn-primary" autoFocus={shouldAutoFocus()} style={{ flex: 1, justifyContent: 'center' }}>
            {t('upload.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
