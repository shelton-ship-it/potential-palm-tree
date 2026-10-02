'use client';
import { useEffect, useRef } from 'react';
import { isLikelyTV } from '@/lib/tv-navigation';

// components/AntiDevtoolsInit.tsx
//
// Camada de fricção anti-DevTools, global, montada uma única vez em
// Providers.tsx (junto de TVNavigationInit) — não é proteção real de
// conteúdo (masterUrl/drmKeyHex continuam a chegar resolvidos ao client
// de qualquer forma), só dificulta inspeção casual em toda a app.
//
// Decisões desta rodada:
//  - Desligado em TV (isLikelyTV()) — esses dispositivos não têm "abrir
//    DevTools" no sentido que a lib detecta; o risco é falso positivo
//    interrompendo o player em produção nesses devices.
//  - Desligado em desenvolvimento (NODE_ENV) — não travar o próprio fluxo
//    de debug do player (BinLoader, Worker, WebCodecs).
//  - clearLog:false — preserva o console real para debug próprio em
//    produção (via user remoto), não o limpa a cada verificação.
//  - Vitalício por sessão (sem dt.remove() no unmount) — cobre toda a
//    navegação da app, não só uma rota.
//
// FIX: `ondevtoolopen: (_type, next) => next()` chamava a ação DEFAULT da
// lib — que tenta window.close()/history.back() e, falhando isso, redirect
// pra um endpoint hardcoded da própria lib (theajack.github.io/disable-
// devtool/404.html), gerando GET (e favicon.ico) 404 desnecessários pra um
// domínio de terceiros que a lib não garante manter. Sem `url` configurado,
// era sempre esse o destino. Agora `url:'about:blank'` faz o `next()`
// redirecionar localmente (branch `if(d.url)` do código da lib — síncrono,
// sem tentativa de close/back nem qualquer request de rede, já era o mais
// rápido possível) — sem quebrar checkout (Switchere/Hotmart) nem upload em
// andamento, já que só dispara mediante detecção real de DevTools aberto.
//
// AJUSTE (velocidade): `interval` é o único lado que controla a velocidade
// aqui — é de quanto em quanto tempo o loop de detectores roda (Size,
// FuncToString, DateToString, Performance, etc). Descido de 200ms pra 60ms:
// ~1 frame a 60fps, deteta DevTools quase no instante em que abre, sem gerar
// carga perceptível (os detectors são comparações leves, não I/O). Não vale
// a pena ir abaixo disto — os detectors baseados em timing (Performance,
// FuncToString) precisam de alguma folga entre leituras pra comparar
// consistentemente, ficar mais agressivo que ~1 frame aumenta falsos
// positivos/negativos sem ganho real de velocidade percebida.

export default function AntiDevtoolsInit() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode/remount guard — uma instância só
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'development') return;
    if (isLikelyTV()) return;

    startedRef.current = true;

    import('disable-devtool').then(({ default: DisableDevtool }) => {
      DisableDevtool({
        // OTIMIZAÇÃO (produção): 60ms mantinha este loop de deteção a
        // correr ~16x/seg, para sempre, em todo dispositivo não-TV —
        // overhead constante que nunca parava, mesmo fora de qualquer
        // interação. 1000ms continua a apanhar DevTools quase de
        // imediato (em termos humanos) com uma fração do custo.
        interval: 1000,
        disableMenu: true,
        disableSelect: false,
        disableCopy: false,
        disableCut: false,
        disablePaste: false,
        clearLog: false,
        url: 'about:blank',
        ignore: () => process.env.NODE_ENV === 'development' || isLikelyTV(),
        ondevtoolopen: (_type, next) => {
          next();
        },
      });
    });
  }, []);

  return null;
}
