'use client';
/**
 * /auth/tv — login de TV por código, fluxo invertido (sem QR/polling/WebSocket).
 *
 * No telemóvel (já autenticado, app.pixgo.qzz.io/main/connect-tv) a pessoa
 * pede um código de 6 dígitos; aqui, na TV, introduz esse código com o
 * comando remoto (teclado numérico navegável por D-pad, usando os mesmos
 * primitivos — Focusable/tv-navigation — já usados no resto da app). Ao
 * completar os 6 dígitos, uma ÚNICA requisição a /auth/device/activate
 * autentica a TV de imediato: sem estado "waiting" a consultar.
 *
 * Sessão resultante dura exactamente o mesmo que um login tradicional
 * (365d, JWT_ACCESS_TTL no backend) — só o próprio código é curto (poucos
 * minutos, controlado pelo servidor). Contrato completo em
 * routes/device.js (api-core).
 */

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Focusable from '@/components/ui/Focusable';
import { useAuthStore } from '@/store/auth';

const CODE_LENGTH = 6;
const KEYPAD_ROWS: (string | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'back'],
];

type Phase = 'entering' | 'submitting' | 'error';

export default function TVCodeLoginPage() {
  const params = useSearchParams();
  const { t } = useTranslation();
  const loginWithDeviceCode = useAuthStore(s => s.loginWithDeviceCode);

  const [digits, setDigits] = useState('');
  const [phase, setPhase]   = useState<Phase>('entering');
  const [error, setError]   = useState('');

  const returnTo = params.get('return_to') || (typeof window !== 'undefined' ? `${window.location.origin}/main` : '/main');

  const submit = useCallback(async (code: string) => {
    setPhase('submitting');
    setError('');
    try {
      await loginWithDeviceCode(code);
      window.location.href = returnTo; // sai da SPA — return_to pode ser outro subdomínio
    } catch (err: any) {
      setDigits('');
      setPhase('error');
      if (err.status === 404) setError(t('auth.tvCodeInvalid', 'Código inválido.'));
      else if (err.status === 410) setError(t('auth.tvCodeExpired', 'Código expirado. Peça um novo no telemóvel.'));
      else if (err.status === 409) setError(t('auth.tvCodeUsed', 'Este código já foi utilizado.'));
      else setError(t('auth.tvActivateError', 'Não foi possível entrar. Tente novamente.'));
    }
  }, [loginWithDeviceCode, returnTo, t]);

  const pressDigit = useCallback((d: string) => {
    if (phase === 'submitting') return;
    setDigits(prev => {
      const next = (prev + d).slice(0, CODE_LENGTH);
      if (next.length === CODE_LENGTH) submit(next);
      return next;
    });
  }, [phase, submit]);

  const pressBack = useCallback(() => {
    if (phase === 'submitting') return;
    setDigits(prev => prev.slice(0, -1));
  }, [phase]);

  const goToPasswordLogin = () => {
    const HUB_LOGIN_URL = 'https://app.pixgo.qzz.io/auth/login';
    window.location.href = `${HUB_LOGIN_URL}?return_to=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="auth-page">
      <div className="tv-activate-card">
        <h1 className="auth-title" style={{ fontSize: '1.8rem', textAlign: 'center' }}>
          {t('auth.tvCodeTitle', 'Introduza o código do telemóvel')}
        </h1>
        <p className="tv-activate-steps" style={{ textAlign: 'center' }}>
          {t('auth.tvCodeSteps', 'No telemóvel, entre na conta e abra Conta > Conectar TV.')}
        </p>

        {/* 6 caixas do código, sem input de texto — só reflectem os toques do teclado abaixo */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '18px 0' }}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 44, height: 56, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', fontWeight: 700,
                background: 'rgba(255,255,255,0.06)',
                border: digits.length === i ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: 'var(--color-text)',
              }}
            >
              {digits[i] || ''}
            </div>
          ))}
        </div>

        {phase === 'submitting' && <div className="loading-ring" style={{ margin: '8px auto' }} />}
        {error && (
          <p className="tv-activate-steps" style={{ textAlign: 'center', color: 'var(--color-danger, #e5484d)' }}>
            {error}
          </p>
        )}

        {/* Teclado numérico — navegação D-pad via Focusable/tv-navigation, igual ao resto da app */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12, justifyContent: 'center', marginTop: 8 }}>
          {KEYPAD_ROWS.flat().map((key, idx) => {
            if (key === null) return <div key={`empty-${idx}`} />;
            if (key === 'back') {
              return (
                <Focusable
                  key="back"
                  as="button"
                  onEnterPress={pressBack}
                  style={{ width: 72, height: 56, borderRadius: 8, fontSize: '1.1rem', background: 'rgba(255,255,255,0.08)', color: 'var(--color-text)', border: 'none' }}
                >
                  ⌫
                </Focusable>
              );
            }
            return (
              <Focusable
                key={key}
                as="button"
                autoFocus={key === '1'}
                onEnterPress={() => pressDigit(key)}
                style={{ width: 72, height: 56, borderRadius: 8, fontSize: '1.4rem', fontWeight: 600, background: 'rgba(255,255,255,0.08)', color: 'var(--color-text)', border: 'none' }}
              >
                {key}
              </Focusable>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Focusable as="button" onEnterPress={goToPasswordLogin} className="tv-activate-steps" style={{ background: 'none', border: 'none', textDecoration: 'underline' }}>
            {t('auth.tvUsePassword', 'Entrar com utilizador e senha')}
          </Focusable>
        </div>
      </div>
    </div>
  );
}
