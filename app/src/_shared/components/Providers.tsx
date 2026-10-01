'use client';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import i18n from '../i18n';
import LanguageModal from './modals/LanguageModal';
import AntiDevtoolsInit from './AntiDevtoolsInit';

const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#e50914' },
    secondary:  { main: '#1ce783' },
    background: { default: '#0a0a0c', paper: '#121216' },
  },
  typography: { fontFamily: "'Poppins', sans-serif" },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [i18nReady, setI18nReady] = useState(false);
  const [showLang, setShowLang]   = useState(false);

  useEffect(() => {
    const chosen = localStorage.getItem('platform_lang');
    if (!chosen) setShowLang(true);
    else i18n.changeLanguage(chosen);
    setI18nReady(true);
  }, []);

  if (!i18nReady) return null;

  // Sem verificação de sessão aqui — cada página decide se precisa de
  // utilizador autenticado. MainLayoutShell (rotas /main/*) faz o próprio
  // fetchMe() e redireciona pro login central se preciso; páginas públicas
  // (login, registo) não precisam de esperar nada.
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AntiDevtoolsInit />

        {showLang && <LanguageModal onClose={() => setShowLang(false)} />}
        {!showLang && children}

        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#121216', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Poppins', sans-serif", fontSize: '0.875rem' },
            success: { iconTheme: { primary: '#1ce783', secondary: '#000' } },
            error:   { iconTheme: { primary: '#e50914', secondary: '#fff' } },
          }}
        />
      </ThemeProvider>
    </I18nextProvider>
  );
}
