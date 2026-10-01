'use client';
import { useEffect, useRef } from 'react';

// components/AntiDevtoolsInit.tsx
//
// Não é protecção real de segurança (é tudo client-side, sempre contornável
// por quem sabe o que faz) — é fricção para dificultar que um utilizador
// comum abra o DevTools sem querer e mexa em tokens/cookies de sessão (que
// podiam ser usados para roubar a própria conta ou a de outra pessoa).
//
// Comportamento (afinado a pedido — versão mais simples do que a do
// frontend_web, que já tinha isto desde antes):
//  - Fricção passiva contínua (disable-devtool, bloqueia menu de contexto +
//    o próprio custo do loop de detecção) — nunca expulsa ninguém a meio do
//    uso normal.
//  - REDIRECT só num caso específico: DevTools já estava aberto ANTES da
//    página carregar (não durante a navegação normal) → manda para /blank.
//    Detectado por timing: se a biblioteca já sinalizar devtools aberto no
//    primeiro segundo depois de montar, foi porque já estava aberto ao
//    entrar no site.
//  - Bypass para devs: visitar uma vez com ?devaccess=<chave> grava uma
//    flag em localStorage e nunca mais bloqueia nesse browser. Não é
//    segurança a sério (dá pra ver a chave no bundle), só evita que a
//    equipa tropece nisto a trabalhar.
//  - NÃO corre em /main/plans/checkout (widget embutido da Hotmart) — pedido
//    explícito para não arriscar quebrar o checkout.
//  - Desligado em desenvolvimento (NODE_ENV).

const BYPASS_KEY   = 'pixgo_devtools_bypass';
const BYPASS_PARAM = 'devaccess';
const BYPASS_VALUE = 'pixgo-dev-2026'; // trocar se algum dia vazar/for partilhada de mais

function hasBypass(): boolean {
  try {
    if (localStorage.getItem(BYPASS_KEY) === BYPASS_VALUE) return true;
    const fromUrl = new URLSearchParams(window.location.search).get(BYPASS_PARAM);
    if (fromUrl === BYPASS_VALUE) {
      localStorage.setItem(BYPASS_KEY, BYPASS_VALUE);
      return true;
    }
  } catch {
    // localStorage indisponível (modo privado, etc.) — trata como sem bypass
  }
  return false;
}

export default function AntiDevtoolsInit() {
  const startedRef   = useRef(false);
  const mountedAtRef = useRef(0);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode/remount guard — uma instância só
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'development') return;
    if (hasBypass()) return;
    if (window.location.pathname.startsWith('/main/plans/checkout')) return;

    startedRef.current = true;
    mountedAtRef.current = Date.now();

    import('disable-devtool').then(({ default: DisableDevtool }) => {
      DisableDevtool({
        interval: 200,
        disableMenu: true,
        disableSelect: false,
        disableCopy: false,
        disableCut: false,
        disablePaste: false,
        clearLog: false,
        ignore: () => process.env.NODE_ENV === 'development',
        ondevtoolopen: (_type, next) => {
          // Sinalizado logo no 1º segundo de vida da página = já estava
          // aberto antes de entrar no site. Depois disso, é só alguém a
          // abrir a meio do uso normal — não expulsa, só a fricção de sempre.
          if (Date.now() - mountedAtRef.current < 1000) {
            window.location.replace('/blank');
            return;
          }
          next();
        },
      });
    });
  }, []);

  return null;
}

