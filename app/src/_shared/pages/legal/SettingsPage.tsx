'use client';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { LANGUAGES } from '../../i18n';
import { authApi, plansApi } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import InstallPWAButton from '../../components/ui/InstallPWAButton';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

interface SettingsContent {
  title: string;
  subtitle: string;
  language: string;
  languageDesc: string;
  app: string;
  appDesc: string;
  account: string;
  accountDesc: string;
  legal: string;
  legalDesc: string;
  links: { href: string; label: string }[];
}

const CONTENT: Record<LegalLang, SettingsContent> = {
  pt: {
    title: 'Definições',
    subtitle: 'Preferências gerais da plataforma.',
    language: 'Idioma',
    languageDesc: 'Escolha o idioma em que a plataforma e as ferramentas são apresentadas.',
    app: 'Aplicação',
    appDesc: 'Instale o Pixgo como aplicação no seu dispositivo para um acesso mais rápido.',
    account: 'Conta e faturação',
    accountDesc: 'Dados de perfil, palavra passe e plano de subscrição.',
    legal: 'Legal e institucional',
    legalDesc: 'Informação sobre a plataforma, segurança dos dados e condições de utilização.',
    links: [
      { href: '/main/about',      label: 'Quem somos' },
      { href: '/main/security',   label: 'Segurança e proteção de dados' },
      { href: '/main/terms',      label: 'Termos e condições' },
      { href: '/main/copyright',  label: 'Direitos de autor' },
      { href: '/main/cookies',    label: 'Política de cookies' },
      { href: '/main/faq',        label: 'Perguntas frequentes' },
    ],
  },
  en: {
    title: 'Settings',
    subtitle: 'General platform preferences.',
    language: 'Language',
    languageDesc: 'Choose the language the platform and tools are shown in.',
    app: 'Application',
    appDesc: 'Install Pixgo as an app on your device for faster access.',
    account: 'Account and billing',
    accountDesc: 'Profile details, password, and subscription plan.',
    legal: 'Legal and institutional',
    legalDesc: 'Information about the platform, data security, and terms of use.',
    links: [
      { href: '/main/about',      label: 'About us' },
      { href: '/main/security',   label: 'Security and data protection' },
      { href: '/main/terms',      label: 'Terms and conditions' },
      { href: '/main/copyright',  label: 'Copyright' },
      { href: '/main/cookies',    label: 'Cookie policy' },
      { href: '/main/faq',        label: 'Frequently asked questions' },
    ],
  },
  es: {
    title: 'Definiciones',
    subtitle: 'Preferencias generales de la plataforma.',
    language: 'Idioma',
    languageDesc: 'Elija el idioma en el que se muestran la plataforma y las herramientas.',
    app: 'Aplicación',
    appDesc: 'Instale Pixgo como aplicación en su dispositivo para un acceso más rápido.',
    account: 'Cuenta y facturación',
    accountDesc: 'Datos de perfil, contraseña y plan de suscripción.',
    legal: 'Legal e institucional',
    legalDesc: 'Información sobre la plataforma, la seguridad de los datos y las condiciones de uso.',
    links: [
      { href: '/main/about',      label: 'Quiénes somos' },
      { href: '/main/security',   label: 'Seguridad y protección de datos' },
      { href: '/main/terms',      label: 'Términos y condiciones' },
      { href: '/main/copyright',  label: 'Derechos de autor' },
      { href: '/main/cookies',    label: 'Política de cookies' },
      { href: '/main/faq',        label: 'Preguntas frecuentes' },
    ],
  },
};

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL || '';
const ACCOUNT_HREF = ACCOUNT_URL ? `${ACCOUNT_URL}/main/account` : '/main/account';

export default function SettingsPage() {
  const lang = useLegalLang();
  const content = CONTENT[lang];
  const { i18n } = useTranslation();
  const user = useAuthStore(s => s.user);
  const plan = useAuthStore(s => s.plan);
  const logout = useAuthStore(s => s.logout);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  useEffect(() => {
    const saved = (localStorage.getItem('platform_theme') as 'dark' | 'light' | null) || 'dark';
    setTheme(saved); document.documentElement.dataset.theme = saved;
    if (user) plansApi.status().then(setSubscription).catch(() => {});
  }, [user]);
  const changeTheme = (next: 'dark' | 'light') => { setTheme(next); localStorage.setItem('platform_theme', next); document.documentElement.dataset.theme = next; };
  const cancelRenewal = async () => {
    if (!window.confirm('Confirma o cancelamento da renovação da subscrição?')) return;
    await plansApi.cancel(); setSubscriptionMessage('A renovação foi cancelada. O acesso permanece válido até ao termo contratado.');
    plansApi.status().then(setSubscription).catch(() => {});
  };

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('platform_lang', code);
    if (user) authApi.setLanguage(code).catch(() => {});
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <div className="page-kicker">{{ pt: 'Preferências', en: 'Preferences', es: 'Preferencias' }[lang]}</div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SettingsOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />
            {content.title}
          </h1>
          <p className="page-subtitle">{content.subtitle}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">{content.language}</div></div>
        <div className="card-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>{content.languageDesc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LANGUAGES.map(l => {
              const active = (i18n.language || 'pt').slice(0, 2) === l.code;
              return (
                <div
                  key={l.code}
                  onClick={() => handleLangChange(l.code)}
                  className={`lang-option ${active ? 'selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="lang-flag" style={{ fontFamily: 'monospace', fontWeight: 800 }}>{l.code.toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <div className="lang-name">{l.native}</div>
                  </div>
                  {active && <CheckCircleIcon style={{ color: 'var(--color-primary)', fontSize: 19 }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">Tema da interface</div></div>
        <div className="card-body"><p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>Escolha o tema visual. A preferência fica guardada neste dispositivo.</p><div style={{ display: 'flex', gap: 10 }}><button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeTheme('light')}><LightModeIcon style={{ fontSize: 17 }} /> Claro</button><button className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeTheme('dark')}><DarkModeIcon style={{ fontSize: 17 }} /> Escuro</button></div></div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">Estado da subscrição</div></div>
        <div className="card-body"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}><div><strong>{(subscription?.plan || plan)?.is_active ? `Subscrição activa · ${(subscription?.plan || plan)?.name}` : 'Plano gratuito'}</strong>{(subscription?.plan || plan)?.expires_at && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 5 }}>Válida até {new Date((subscription?.plan || plan).expires_at).toLocaleDateString('pt-PT')}</p>}{!user && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 5 }}>Inicie sessão para consultar a sua subscrição.</p>}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a className="btn btn-secondary" href="/main/plans">Gerir planos</a>{user && (subscription?.plan || plan)?.is_active && <button className="btn btn-secondary" onClick={cancelRenewal}>Cancelar renovação</button>}</div></div>{subscriptionMessage && <p style={{ color: 'var(--color-secondary)', marginTop: 12 }}>{subscriptionMessage}</p>}</div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">{content.app}</div></div>
        <div className="card-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>{content.appDesc}</p>
          <InstallPWAButton className="btn btn-secondary" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">{content.account}</div></div>
        <div className="card-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>{content.accountDesc}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a href={ACCOUNT_HREF} className="btn btn-secondary">{content.account}</a>{user && <button className="btn btn-secondary" onClick={() => logout().then(() => { window.location.href = '/auth/login'; })}><LogoutIcon style={{ fontSize: 17 }} /> Sair</button>}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{content.legal}</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {content.links.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className="dropdown-item"
              style={{ padding: '13px 17px', borderBottom: i === content.links.length - 1 ? 'none' : '1px solid var(--color-border)', justifyContent: 'space-between' }}
            >
              <span>{link.label}</span>
              <ChevronRightIcon style={{ fontSize: 18 }} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
