'use client';
import React from 'react';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TvIcon from '@mui/icons-material/Tv';
import LanguageIcon from '@mui/icons-material/Language';
import AppleIcon from '@mui/icons-material/Apple';
import InstallPWAButton from '../../components/ui/InstallPWAButton';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

// Os links reais de download (.apk) são definidos por variável de ambiente,
// apontando para o asset publicado nas GitHub Releases da plataforma.
// Enquanto não estiverem definidos, os botões ficam desativados.
const APK_PHONE_URL = process.env.NEXT_PUBLIC_APK_PHONE_URL || '';
const APK_TV_URL    = process.env.NEXT_PUBLIC_APK_TV_URL    || '';
const WEB_URL        = process.env.NEXT_PUBLIC_WEB_URL       || 'https://pixgo.qzz.io';

interface DownloadContent {
  title: string;
  subtitle: string;
  phone: { badge: string; title: string; desc: string; req: string; reqValue: string; size: string; sizeValue: string; cta: string; soon: string };
  tv: { badge: string; title: string; desc: string; req: string; reqValue: string; size: string; sizeValue: string; cta: string; note: string };
  web: { badge: string; title: string; desc: string; compat: string; compatValue: string; cta: string; note: string };
  showcaseLabel: string;
  showcasePhoneCaption: string;
  installLabel: string;
  steps: { title: string; body: string }[];
}

const CONTENT: Record<LegalLang, DownloadContent> = {
  pt: {
    title: 'Transferir a aplicação',
    subtitle: 'Leve as ferramentas Pixgo consigo. Transfira para Android ou Android TV, ou instale diretamente a partir do browser.',
    phone: {
      badge: 'Telemóvel e tablet', title: 'Aplicação Android', desc: 'Acesso rápido ao conjunto de plataformas digitais Pixgo, com a sua conta e plano sincronizados automaticamente.',
      req: 'Requer', reqValue: 'Android 8 ou superior', size: 'Tamanho', sizeValue: 'A definir', cta: 'Transferir APK', soon: 'Ligação a disponibilizar em breve.',
    },
    tv: {
      badge: 'Ecrã grande', title: 'Android TV', desc: 'Pensada para o comando. Navegação simplificada, adequada a televisores e caixas com Android TV.',
      req: 'Requer', reqValue: 'Android TV 9 ou superior', size: 'Tamanho', sizeValue: 'A definir', cta: 'Transferir APK', note: 'Consulte o guia de instalação abaixo.',
    },
    web: {
      badge: 'iOS e Web', title: 'Instalar como aplicação', desc: 'Disponível como aplicação progressiva. Instale diretamente do browser em iPhone, iPad ou computador, sem loja de aplicações.',
      compat: 'Compatível com', compatValue: 'Safari, Chrome, Edge', cta: 'Aceder à plataforma',
      note: 'Em Safari: toque em Partilhar e depois em "Adicionar ao ecrã principal".',
    },
    showcaseLabel: 'A plataforma em ação',
    showcasePhoneCaption: 'As ferramentas pensadas para o ecrã do telemóvel.',
    installLabel: 'Instalar no Android',
    steps: [
      { title: '1. Permita fontes desconhecidas', body: 'O Android bloqueia instalações fora da Play Store por padrão. Em Definições, Segurança, ative "Instalar aplicações desconhecidas" para o seu navegador.' },
      { title: '2. Transfira o ficheiro .apk', body: 'Toque no botão de transferência acima. O ficheiro fica guardado na pasta de transferências do telemóvel ou da televisão.' },
      { title: '3. Abra e instale', body: 'Abra o ficheiro transferido e confirme a instalação. A aplicação fica pronta a usar em menos de um minuto, com a sua conta já sincronizada.' },
    ],
  },
  en: {
    title: 'Download the app',
    subtitle: 'Take the Pixgo tools with you. Download for Android or Android TV, or install directly from the browser.',
    phone: {
      badge: 'Phone and tablet', title: 'Android application', desc: 'Fast access to the whole suite of Pixgo digital platforms, with your account and plan synced automatically.',
      req: 'Requires', reqValue: 'Android 8 or higher', size: 'Size', sizeValue: 'To be defined', cta: 'Download APK', soon: 'Download link coming soon.',
    },
    tv: {
      badge: 'Big screen', title: 'Android TV', desc: 'Built for the remote. Simplified navigation, suited to TVs and boxes running Android TV.',
      req: 'Requires', reqValue: 'Android TV 9 or higher', size: 'Size', sizeValue: 'To be defined', cta: 'Download APK', note: 'See the full installation guide below.',
    },
    web: {
      badge: 'iOS and Web', title: 'Install as an app', desc: 'Available as a progressive web app. Install directly from the browser on iPhone, iPad, or computer, with no app store required.',
      compat: 'Compatible with', compatValue: 'Safari, Chrome, Edge', cta: 'Go to the platform',
      note: 'On Safari: tap Share, then "Add to Home Screen".',
    },
    showcaseLabel: 'The platform in action',
    showcasePhoneCaption: 'The tools, built for the phone screen.',
    installLabel: 'Installing on Android',
    steps: [
      { title: '1. Allow unknown sources', body: 'Android blocks installations from outside the Play Store by default. In Settings, Security, enable "Install unknown apps" for your browser.' },
      { title: '2. Download the .apk file', body: 'Tap the download button above. The file is saved to the downloads folder on your phone or TV.' },
      { title: '3. Open and install', body: 'Open the downloaded file and confirm the installation. The app is ready to use in under a minute, with your account already synced.' },
    ],
  },
  es: {
    title: 'Descargar la aplicación',
    subtitle: 'Lleve las herramientas Pixgo con usted. Descargue para Android o Android TV, o instale directamente desde el navegador.',
    phone: {
      badge: 'Teléfono y tableta', title: 'Aplicación Android', desc: 'Acceso rápido al conjunto de plataformas digitales Pixgo, con su cuenta y plan sincronizados automáticamente.',
      req: 'Requiere', reqValue: 'Android 8 o superior', size: 'Tamaño', sizeValue: 'Por definir', cta: 'Descargar APK', soon: 'Enlace de descarga disponible próximamente.',
    },
    tv: {
      badge: 'Pantalla grande', title: 'Android TV', desc: 'Pensada para el mando. Navegación simplificada, adecuada para televisores y dispositivos con Android TV.',
      req: 'Requiere', reqValue: 'Android TV 9 o superior', size: 'Tamaño', sizeValue: 'Por definir', cta: 'Descargar APK', note: 'Consulte la guía de instalación a continuación.',
    },
    web: {
      badge: 'iOS y Web', title: 'Instalar como aplicación', desc: 'Disponible como aplicación progresiva. Instale directamente desde el navegador en iPhone, iPad u ordenador, sin tienda de aplicaciones.',
      compat: 'Compatible con', compatValue: 'Safari, Chrome, Edge', cta: 'Acceder a la plataforma',
      note: 'En Safari: toque Compartir y luego "Añadir a pantalla de inicio".',
    },
    showcaseLabel: 'La plataforma en acción',
    showcasePhoneCaption: 'Las herramientas, pensadas para la pantalla del teléfono.',
    installLabel: 'Instalar en Android',
    steps: [
      { title: '1. Permita orígenes desconocidos', body: 'Android bloquea las instalaciones fuera de la Play Store de forma predeterminada. En Ajustes, Seguridad, active "Instalar aplicaciones desconocidas" para su navegador.' },
      { title: '2. Descargue el archivo .apk', body: 'Toque el botón de descarga anterior. El archivo se guarda en la carpeta de descargas del teléfono o del televisor.' },
      { title: '3. Abra e instale', body: 'Abra el archivo descargado y confirme la instalación. La aplicación queda lista para usar en menos de un minuto, con su cuenta ya sincronizada.' },
    ],
  },
};

export default function DownloadPage() {
  const lang = useLegalLang();
  const c = CONTENT[lang];

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DownloadOutlinedIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />
            {c.title}
          </h1>
          <p className="page-subtitle">{c.subtitle}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 34 }}>
        {/* Android phone */}
        <div className="dl-card">
          <div className="dl-card-top">
            <div className="dl-card-icon"><PhoneAndroidIcon style={{ fontSize: 20 }} /></div>
            <span className="dl-card-badge">{c.phone.badge}</span>
          </div>
          <div className="dl-card-title">{c.phone.title}</div>
          <p className="dl-card-desc">{c.phone.desc}</p>
          <div className="dl-card-meta">
            <div>{c.phone.req}<b>{c.phone.reqValue}</b></div>
            <div>{c.phone.size}<b>{c.phone.sizeValue}</b></div>
          </div>
          {APK_PHONE_URL ? (
            <a className="btn-download" href={APK_PHONE_URL} download>
              <DownloadOutlinedIcon style={{ fontSize: 17 }} />{c.phone.cta}
            </a>
          ) : (
            <button className="btn-download" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              <DownloadOutlinedIcon style={{ fontSize: 17 }} />{c.phone.cta}
            </button>
          )}
          {!APK_PHONE_URL && <div className="dl-card-note">{c.phone.soon}</div>}
        </div>

        {/* Android TV */}
        <div className="dl-card">
          <div className="dl-card-top">
            <div className="dl-card-icon"><TvIcon style={{ fontSize: 20 }} /></div>
            <span className="dl-card-badge">{c.tv.badge}</span>
          </div>
          <div className="dl-card-title">{c.tv.title}</div>
          <p className="dl-card-desc">{c.tv.desc}</p>
          <div className="dl-card-meta">
            <div>{c.tv.req}<b>{c.tv.reqValue}</b></div>
            <div>{c.tv.size}<b>{c.tv.sizeValue}</b></div>
          </div>
          {APK_TV_URL ? (
            <a className="btn-download" href={APK_TV_URL} download>
              <DownloadOutlinedIcon style={{ fontSize: 17 }} />{c.tv.cta}
            </a>
          ) : (
            <button className="btn-download" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              <DownloadOutlinedIcon style={{ fontSize: 17 }} />{c.tv.cta}
            </button>
          )}
          <div className="dl-card-note">{c.tv.note}</div>
        </div>

        {/* PWA / Web */}
        <div className="dl-card">
          <div className="dl-card-top">
            <div className="dl-card-icon"><LanguageIcon style={{ fontSize: 20 }} /></div>
            <span className="dl-card-badge">{c.web.badge}</span>
          </div>
          <div className="dl-card-title">{c.web.title}</div>
          <p className="dl-card-desc">{c.web.desc}</p>
          <div className="dl-card-meta">
            <div>{c.web.compat}<b>{c.web.compatValue}</b></div>
          </div>
          <a className="btn-download secondary" href={WEB_URL}>{c.web.cta}</a>
          <InstallPWAButton className="btn-download" style={{ marginTop: 10 }} />
          <div className="dl-card-note"><AppleIcon style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 4 }} />{c.web.note}</div>
        </div>
      </div>

      {/* Showcase — placeholders para capturas de ecrã mobile e Android,
          a substituir por imagens reais quando estiverem disponíveis. */}
      <div className="tool-section-label">{c.showcaseLabel}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 34 }}>
        <div className="dl-shot-frame">
          <div className="dl-shot-placeholder">
            <PhoneAndroidIcon style={{ fontSize: 28, opacity: 0.35, marginBottom: 8 }} />
            <span>Mobile</span>
          </div>
        </div>
        <div className="dl-shot-frame">
          <div className="dl-shot-placeholder">
            <PhoneAndroidIcon style={{ fontSize: 28, opacity: 0.35, marginBottom: 8 }} />
            <span>Android</span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: -20, marginBottom: 34 }}>{c.showcasePhoneCaption}</p>

      <div className="tool-section-label">{c.installLabel}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {c.steps.map((step, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.88rem', marginBottom: 8 }}>{step.title}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
