'use client';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguageLazy } from '@/i18n';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Focusable from '@/components/ui/Focusable';
import { shouldAutoFocus } from '@/lib/tv-navigation';

export default function LanguageModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(i18n.language?.slice(0, 2) || 'pt');

  const handleContinue = () => {
    changeLanguageLazy(selected); // carrega o bundle do idioma antes de trocar
    localStorage.setItem('pixgo_lang', selected);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" data-modal="true" style={{ zIndex: 9999 }}>
      <div className="modal scale-in" style={{ maxWidth: 400 }}>
        <div style={{ padding: '32px 28px 0', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <img src="/logo.svg" alt="Pixgo" style={{ height: 44 }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>
            {t('language.title')}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 24 }}>
            {t('language.subtitle')}
          </p>
        </div>

        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LANGUAGES.map((lang, i) => (
            <Focusable
              key={lang.code}
              className={`lang-option ${selected === lang.code ? 'selected' : ''}`}
              onClick={() => setSelected(lang.code)}
              autoFocus={i === 0 && shouldAutoFocus()}
            >
              <span className="lang-flag">{lang.flag}</span>
              <div style={{ flex: 1 }}>
                <div className="lang-name">{lang.native}</div>
                <div className="lang-native">{lang.label}</div>
              </div>
              {selected === lang.code && (
                <CheckCircleOutlineIcon style={{ color: 'var(--color-primary)', fontSize: 20 }} />
              )}
            </Focusable>
          ))}
        </div>

        <div style={{ padding: '20px 24px 26px' }}>
          <Focusable as="button" className="auth-btn" onClick={handleContinue}>
            {t('language.continue')}
          </Focusable>
        </div>
      </div>
    </div>
  );
}
