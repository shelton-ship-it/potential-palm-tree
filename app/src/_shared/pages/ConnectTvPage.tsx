'use client';
/**
 * ConnectTvPage.tsx — hub (app.pixgo.qzz.io/main/connect-tv)
 *
 * Lado "telemóvel" do login de TV — fluxo invertido (pedido explícito do
 * utilizador, sem QR/polling/WebSocket): esta página, já autenticada, PEDE
 * o código ao servidor e mostra-o em ecrã; a pessoa introduz esse código
 * directamente na TV (ver /auth/tv no frontend_web), que se autentica numa
 * única requisição. Substitui a versão anterior (ActivatePage), que fazia o
 * inverso — nunca chegou a ser ligada a uma rota real.
 *
 * Sessão resultante na TV dura exactamente o mesmo que um login tradicional
 * (365d) — só o próprio código é curto (poucos minutos, controlado pelo
 * servidor). Ver routes/device.js no api-core para o contrato completo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { authApi } from '../lib/api';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

type Status = 'checking' | 'loading' | 'ready' | 'expired' | 'error';

export default function ConnectTvPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const hydrated = useAuthStore(s => s.hydrated);
  const fetchMe  = useAuthStore(s => s.fetchMe);

  const [status, setStatus] = useState<Status>('checking');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
  }, []);

  const requestCode = useCallback(async () => {
    stopCountdown();
    setStatus('loading');
    try {
      const res = await authApi.requestDeviceCode();
      setCode(res.code);
      setSecondsLeft(res.expires_in);
      setStatus('ready');
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            stopCountdown();
            setStatus('expired');
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setStatus('error');
    }
  }, [stopCountdown]);

  useEffect(() => {
    fetchMe().then(ok => {
      if (!ok) {
        const returnTo = `${window.location.origin}/main/connect-tv`;
        router.replace(`/auth/login?return_to=${encodeURIComponent(returnTo)}`);
        return;
      }
      requestCode();
    });
    return () => stopCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking' || !hydrated) {
    return (
      <div className="auth-page">
        <div className="loading-ring" />
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="auth-page">
      <div className="auth-card scale-in">
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center' }}>
          <LiveTvIcon style={{ fontSize: 40, color: 'var(--color-primary)' }} />
        </div>

        <h1 className="auth-title" style={{ textAlign: 'center' }}>
          {t('connectTv.title', 'Conectar TV')}
        </h1>

        {status === 'error' && (
          <div className="error-msg">
            <ErrorOutlineIcon style={{ fontSize: 18 }} />
            {t('connectTv.genericError', 'Não foi possível gerar o código. Tente novamente.')}
          </div>
        )}

        {(status === 'loading') && <div className="loading-ring" style={{ margin: '20px auto' }} />}

        {status === 'ready' && (
          <>
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 18 }}>
              {t('connectTv.instructions', 'Na sua TV, abra a Pixgo e introduza o código abaixo.')}
            </p>
            <div
              style={{
                textAlign: 'center', fontSize: '2.2rem', fontWeight: 700,
                letterSpacing: '0.3em', padding: '16px 0', color: 'var(--color-primary)',
              }}
            >
              {code.slice(0, 3)} {code.slice(3)}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {t('connectTv.expiresIn', 'Expira em')} {mm}:{ss}
            </p>
          </>
        )}

        {(status === 'expired' || status === 'error') && (
          <button className="auth-btn" onClick={requestCode} style={{ marginTop: 12 }}>
            <RefreshIcon style={{ fontSize: 18, marginRight: 6 }} />
            {t('connectTv.newCode', 'Gerar novo código')}
          </button>
        )}
      </div>
    </div>
  );
}
