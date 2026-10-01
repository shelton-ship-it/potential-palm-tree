'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import GoogleAuthButton from '../components/ui/GoogleAuthButton';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Platform';

export default function LoginPage() {
  const router  = useRouter();
  const params  = useSearchParams();
  const { t }   = useTranslation();
  const login          = useAuthStore(s => s.login);
  const loginWithGoogle = useAuthStore(s => s.loginWithGoogle);
  const loading         = useAuthStore(s => s.loading);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');

  // return_to: manda de volta pra ferramenta que pediu o login (SSO entre
  // os subdomínios *.pixgo.qzz.io) — sem isso, vai pro hub. Partilhado
  // entre o login tradicional e o Google.
  const goAfterAuth = () => {
    const returnTo = params.get('return_to');
    if (returnTo) window.location.href = decodeURIComponent(returnTo);
    else router.push('/main');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username.trim(), password);
      goAfterAuth();
    } catch (err: any) {
      setError(err.status === 401 ? t('auth.invalidCredentials') : t('auth.loginFailed'));
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      goAfterAuth();
    } catch (err: any) {
      setError(err.error === 'AccountExistsUnlinked' ? err.message : t('auth.googleLoginFailed'));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card scale-in">
        <div className="auth-logo">
          <img src="/logo.svg" alt={PLATFORM_NAME} />
        </div>

        <h1 className="auth-title">{t('auth.welcomeBack')}</h1>

        {error && (
          <div className="error-msg">
            <ErrorOutlineIcon style={{ fontSize: 18 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="on">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">{t('auth.username')}</label>
            <div className="input-wrap">
              <PersonOutlineIcon className="input-icon" style={{ fontSize: 18 }} />
              <input
                className="form-input"
                type="text"
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <div className="input-wrap">
              <LockOutlinedIcon className="input-icon" style={{ fontSize: 18 }} />
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: 42 }}
              />
              <button type="button" className="input-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPw ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
              </button>
            </div>
          </div>

          <button className="auth-btn" type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? <span className="spinner spinner-sm" /> : t('auth.signIn')}
          </button>
        </form>

        <div className="auth-divider-text"><span>{t('auth.orContinueWith')}</span></div>

        <GoogleAuthButton onCredential={handleGoogleCredential} disabled={loading} />

        <div className="auth-divider" />

        <p className="auth-link">
          {t('auth.noAccount')}{' '}
          <Link href={params.get('return_to') ? `/auth/register?return_to=${params.get('return_to')}` : '/auth/register'}>{t('auth.signUp')}</Link>
        </p>
      </div>
    </div>
  );
}
