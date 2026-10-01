'use client';
/**
 * Botão de instalação da PWA usando @khmyznikov/pwa-install.
 * Em browsers sem suporte a beforeinstallprompt (Safari/iOS), o próprio
 * componente mostra instruções manuais ("Adicionar à Tela de Início").
 *
 * FIX: o custom element <pwa-install> deixou de ser importado/criado
 * tardiamente aqui dentro (import() num useEffect + portal próprio por
 * botão). Isso fazia com que, na maior parte das vezes, o browser já
 * tivesse disparado (e perdido, por só disparar uma vez) o
 * beforeinstallprompt antes do elemento sequer existir no DOM — o diálogo
 * ainda abria (a biblioteca mostra sempre alguma UI), mas o botão
 * "Instalar" não tinha nenhum evento capturado para accionar.
 * Agora o elemento é único, partilhado por todos os botões, e já vem
 * registado desde o <head> (ver src/app/layout.tsx, script beforeInteractive).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';

const LABEL: Record<string, string> = {
  pt: 'Instalar aplicação',
  en: 'Install app',
  es: 'Instalar aplicación',
};

function getSharedInstallEl(): any {
  if (typeof document === 'undefined') return null;
  return document.querySelector('pwa-install');
}

export default function InstallPWAButton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const [eligible, setEligible] = useState(false);
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'pt').slice(0, 2);
  const label = LABEL[lang] || LABEL.pt;

  useEffect(() => {
    const standalone = typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    setEligible(!standalone);
  }, []);

  if (!eligible) return null;

  return (
    <button className={className} style={style} onClick={() => getSharedInstallEl()?.showDialog?.(true)}>
      <DownloadIcon style={{ fontSize: 15 }} />
      {label}
    </button>
  );
}
