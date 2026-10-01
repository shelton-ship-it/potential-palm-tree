'use client';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Platform';

export default function LanguageModal({ onClose }: { onClose: () => void }) {
  const { i18n } = useTranslation();
  const [selected, setSelected] = useState(i18n.language?.slice(0, 2) || 'pt');

  const handleContinue = () => {
    i18n.changeLanguage(selected);
    localStorage.setItem('platform_lang', selected);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal scale-in" style={{ maxWidth: 400 }}>
        <div style={{ padding: '32px 28px 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <img src="/logo.svg" alt={PLATFORM_NAME} style={{ height: 30 }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>Escolha o idioma</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 24 }}>Pode alterar mais tarde nas definições</p>
        </div>

        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LANGUAGES.map(lang => (
            <div
              key={lang.code}
              className={`lang-option ${selected === lang.code ? 'selected' : ''}`}
              onClick={() => setSelected(lang.code)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <span className="lang-flag" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>{lang.code.toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div className="lang-name">{lang.native}</div>
                <div className="lang-native">{lang.label}</div>
              </div>
              {selected === lang.code && <CheckCircleOutlineIcon style={{ color: 'var(--color-primary)', fontSize: 20 }} />}
            </div>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          <button className="auth-btn" onClick={handleContinue}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
