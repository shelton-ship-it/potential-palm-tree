// src/components/Providers.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import i18n, { ensureLanguageLoaded } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import LanguageModal from '@/components/modals/LanguageModal';
import DisclaimerModal from '@/components/modals/DisclaimerModal';
import TVNavigationInit from '@/components/TVNavigationInit';
import AntiDevtoolsInit from '@/components/AntiDevtoolsInit';

const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#e50914' },
    secondary:  { main: '#1ce783' },
    background: { default: '#0a0a0c', paper: '#121216' },
  },
  typography: { fontFamily: "'Poppins', sans-serif" },
});

// Shows disclaimer once per session after login
function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const user     = useAuthStore(s => s.user);
  const hydrated = useAuthStore(s => s.hydrated);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hydrated || !user) return;
    const dismissed = localStorage.getItem('pixgo_disclaimer_dismissed');
    if (dismissed !== 'true') setShow(true);
  }, [hydrated, user?.id]);

  return (
    <>
      {children}
      {show && (
        <DisclaimerModal
          onAccept={() => setShow(false)}
          onDismiss={() => { localStorage.setItem('pixgo_disclaimer_dismissed', 'true'); setShow(false); }}
        />
      )}
    </>
  );
}

function AppCore({ children }: { children: React.ReactNode }) {
  const fetchMe  = useAuthStore(s => s.fetchMe);
  // Rodada 1 (set/2026): se a store já veio hidratada de forma síncrona a
  // partir do cache local (ver store/auth.ts), não há motivo para mostrar
  // o spinner e bloquear em rede — renderiza já, e fetchMe() abaixo só
  // revalida em segundo plano (e pode nem chegar a bater na API, se o
  // cache ainda estiver dentro do TTL).
  const [ready, setReady] = useState(() => useAuthStore.getState().hydrated);

  useEffect(() => {
    if (ready) {
      fetchMe(); // revalidação silenciosa, não bloqueia render
    } else {
      fetchMe().finally(() => setReady(true));
    }
  }, []);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
      <div className="loading-ring" />
    </div>
  );

  return (
    <DisclaimerGate>
      {children}
    </DisclaimerGate>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [i18nReady, setI18nReady] = useState(false);
  const [showLang,  setShowLang]  = useState(false);

  useEffect(() => {
    const chosen = localStorage.getItem('pixgo_lang');
    if (!chosen) {
      setShowLang(true);
      setI18nReady(true);
    } else {
      // Idioma já foi carregado de forma síncrona em i18n/index.ts
      // (detectInitialLang lê o mesmo localStorage); isto só garante que
      // não avançamos antes do bundle desse idioma estar mesmo pronto.
      ensureLanguageLoaded(chosen).finally(() => setI18nReady(true));
    }
  }, []);

  if (!i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />

        {/* Motor de navegação por D-pad, montado incondicionalmente, ANTES
            de qualquer modal (incluindo o LanguageModal) — sem isto, o
            primeiro ecrã que qualquer TV nova vê fica sem resposta ao
            controle remoto. */}
        <TVNavigationInit />

        {/* Anti-DevTools global — desligado em TV e em desenvolvimento,
            ver comentário completo em AntiDevtoolsInit.tsx */}
        <AntiDevtoolsInit />

        {/* Language FIRST — blocks everything until chosen */}
        {showLang && (
          <LanguageModal
            onClose={() => setShowLang(false)}
          />
        )}

        {/* Only render app after language is picked */}
        {!showLang && (
          <AppCore>{children}</AppCore>
        )}

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#121216',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#1ce783', secondary: '#000' } },
            error:   { iconTheme: { primary: '#e50914', secondary: '#fff' } },
          }}
        />
      </ThemeProvider>
    </I18nextProvider>
  );
}
