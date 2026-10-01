'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adsApi, RENDER_PING_BASE } from '@/lib/api';
import BlockIcon from '@mui/icons-material/Block';
import { shouldAutoFocus } from '@/lib/tv-navigation';

// components/AdblockGuard.tsx
//
// Detecção de bloqueador de anúncios + modal bloqueante persistente — só
// activo para quem tem anúncios (`show_ads:true`, plano free). Utilizadores
// pagos nunca correm isto — não têm anúncios pra proteger.
//
// Montado no layout de /main (junto do PixelChatbot), corre em qualquer
// página da plataforma, não só durante a reprodução, como pedido. É o
// ponto único de aplicação — não interessa COMO o anúncio foi bloqueado
// (extensão, DNS, hosts file), qualquer um dos sinais abaixo dispara o
// mesmo modal.
//
// Três técnicas combinadas:
//   1. Elemento "isca" com classes típicas de anúncio (ad-banner, adsbox,
//      adsbygoogle) — filtros cosméticos de listas como EasyList escondem
//      isto mesmo quando nenhum domínio está a ser bloqueado.
//   2. GET /api/ads/ping (nosso domínio) — o path "/ads/" costuma bater em
//      regras de rede genéricas de extensões mais agressivas.
//   3. Sonda o(s) domínio(s) REAL(is) do provedor de anúncios — lidos de
//      `network.probe_script_urls` (testadas via <script src>) e
//      `network.probe_fetch_urls` (testadas via fetch no-cors — usado pra
//      URLs de VAST/XML, que não podem ser injectadas como script, ver FIX
//      em probeUrlViaFetch). Esta é a que apanha bloqueio por DNS (Pi-hole,
//      AdGuard DNS, NextDNS, hosts file) — um bloqueador desses nunca afecta
//      o nosso próprio domínio, só o do provedor de terceiros, então só
//      testar o (2) não seria suficiente. Sem zona configurada ainda, estas
//      sondas ficam inactivas sozinhas (arrays vazios) — nada quebra.
//
// Se qualquer um dos sinais indicar bloqueio, mostra o modal. O estado é
// reportado ao backend nos dois sentidos (bloqueado/desbloqueado) pra
// persistir entre navegações — mas a decisão de mostrar o modal é sempre
// local e imediata, nunca espera confirmação do servidor.

const CHECK_INTERVAL_MS  = 90000; // FIX: era 20s — 2x/min + 1 POST a cada
// vez estourava requests à toa (EdgeOne free tier). 90s ainda reage rápido
// o suficiente pro modal aparecer/sumir, sem spam.
const SCRIPT_PROBE_TIMEOUT_MS = 2500;

// FIX (offline): detectByNetwork() tratava QUALQUER fetch falhado como
// "bloqueado por adblock" — incluindo o utilizador estar genuinamente sem
// rede (avião, área sem cobertura, wifi caiu). Um assinante offline nunca
// pode ver o modal de adblock (não há nada a bloquear, não há rede a
// verificar). runCheck agora sai cedo se navigator.onLine === false, e um
// listener de 'offline' fecha o modal imediatamente se estiver aberto.
async function detectByBait(): Promise<boolean> {
  return new Promise(resolve => {
    const bait = document.createElement('div');
    bait.className = 'ad-banner ads adsbox ad-container adsbygoogle text-ad';
    bait.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:1px; height:1px;';
    document.body.appendChild(bait);

    setTimeout(() => {
      const hidden = bait.offsetParent === null
        || bait.offsetHeight === 0
        || getComputedStyle(bait).display === 'none'
        || getComputedStyle(bait).visibility === 'hidden';
      bait.remove();
      resolve(hidden);
    }, 200);
  });
}

async function detectByNetwork(): Promise<boolean> {
  try {
    // FIX (ago/2026): apontava pra `${API_BASE}/api/ads/ping` no EdgeOne —
    // EdgeOne tem limite de requests, Render só limita banda. Movido pra
    // GET /ads-ping no Render (dispatcher.js) — estático, sem auth, sem
    // custo de request no EdgeOne, mesmo efeito de detecção.
    await fetch(`${RENDER_PING_BASE}/ads-ping`, { method: 'GET', mode: 'cors', cache: 'no-store' });
    return false; // chegou alguma resposta = não foi bloqueado na rede
  } catch {
    return true; // fetch nem chegou a completar = provável bloqueio de rede
  }
}

// Testa uma URL real do provedor via <script> — funciona mesmo sem CORS
// (onerror dispara tanto pra bloqueio de extensão quanto pra falha de DNS)
// e é a técnica padrão pra detectar bloqueio de domínio de terceiros.
// Usa a URL REAL configurada (não a raiz do domínio) pra evitar falso
// positivo de um 404 legítimo numa rota que não existe.
// Só serve pra URLs de SCRIPT de verdade (native.script, banner invoke.js) —
// ver probeUrlViaFetch abaixo pra URLs de VAST/XML.
function probeUrl(url: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (blocked: boolean) => {
      if (settled) return;
      settled = true;
      script.remove();
      resolve(blocked);
    };

    const sep = url.includes('?') ? '&' : '?';
    const script = document.createElement('script');
    script.async = true;
    script.src = `${url}${sep}_probe=${Date.now()}`;
    script.onerror = () => finish(true);
    script.onload  = () => finish(false);
    document.head.appendChild(script);

    setTimeout(() => finish(true), SCRIPT_PROBE_TIMEOUT_MS);
  });
}

// FIX: URLs de VAST (HILLTOPADS_VAST_TAG_URL etc.) devolvem XML, não JS.
// Testá-las via <script src> (probeUrl acima) faz o browser recusar por
// MIME type ("Refused to execute script... not executable") e disparar
// onerror mesmo sem NENHUM bloqueio real — foi isso que gerou falso
// positivo pra todo mundo assim que a zona Hilltop foi configurada, adblock
// ou não. fetch(no-cors) só falha por bloqueio de rede de verdade
// (extensão/DNS/hosts) — é o mesmo princípio de detectByNetwork(), só que
// por domínio do provedor em vez do nosso próprio.
function probeUrlViaFetch(url: string): Promise<boolean> {
  return Promise.race([
    fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
      .then(() => false)
      .catch(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(true), SCRIPT_PROBE_TIMEOUT_MS)),
  ]);
}

async function detectByAdDomains(scriptUrls: string[], fetchUrls: string[]): Promise<boolean> {
  if (!scriptUrls.length && !fetchUrls.length) return false;
  const results = await Promise.all([
    ...scriptUrls.map(probeUrl),
    ...fetchUrls.map(probeUrlViaFetch),
  ]);
  // qualquer URL do provedor inacessível já conta como bloqueio
  return results.some(Boolean);
}

export default function AdblockGuard() {
  const { t } = useTranslation();
  const [active, setActive]     = useState(false); // só corre se show_ads
  const [blocked, setBlocked]   = useState(false);
  const [checking, setChecking] = useState(false);
  const probeScriptUrlsRef = useRef<string[]>([]);
  const probeFetchUrlsRef  = useRef<string[]>([]);
  const mountedRef = useRef(true);
  const lastReportedRef = useRef<boolean | null>(null);

  const runCheck = useCallback(async () => {
    if (!mountedRef.current) return;
    // Offline de verdade — nada a detectar, e não pode nunca prender o
    // user atrás do modal de adblock sem rede.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setBlocked(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    const [byBait, byNetwork, byAdDomains] = await Promise.all([
      detectByBait(),
      detectByNetwork(),
      detectByAdDomains(probeScriptUrlsRef.current, probeFetchUrlsRef.current),
    ]);
    const isBlocked = byBait || byNetwork || byAdDomains;
    if (!mountedRef.current) return;
    setBlocked(isBlocked);
    setChecking(false);
    // FIX: só reporta ao servidor quando o estado muda — evita 1 POST a
    // cada verificação (a cada 90s) mesmo sem nada ter mudado.
    if (lastReportedRef.current !== isBlocked) {
      lastReportedRef.current = isBlocked;
      adsApi.reportAdblock(isBlocked).catch(() => {});
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    adsApi.status()
      .then(ctx => {
        if (!mountedRef.current) return;
        probeScriptUrlsRef.current = ctx?.network?.probe_script_urls || [];
        probeFetchUrlsRef.current  = ctx?.network?.probe_fetch_urls  || [];
        setActive(ctx.show_ads);
      })
      .catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!active) return;
    runCheck();
    const iv = setInterval(runCheck, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') runCheck(); };
    // Ao perder a rede, fecha o modal na hora (não espera o próximo ciclo
    // de 90s) — e ao recuperar, reavalia normalmente.
    const onOffline = () => { if (mountedRef.current) setBlocked(false); };
    const onOnline  = () => runCheck();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [active, runCheck]);

  if (!active || !blocked) return null;

  return (
    <div role="dialog" aria-modal="true" data-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(4,4,6,0.94)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        maxWidth: 420, width: '100%', background: 'var(--color-card-bg)',
        border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, textAlign: 'center',
      }}>
        <BlockIcon style={{ fontSize: 42, color: 'var(--color-primary)', marginBottom: 12 }} />
        <h2 style={{ marginBottom: 10, fontSize: '1.1rem' }}>{t('adblock.title')}</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 20 }}>
          {t('adblock.body')}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          autoFocus={shouldAutoFocus()}
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={runCheck}
          disabled={checking}
        >
          {checking ? t('adblock.checking') : t('adblock.retry')}
        </button>
      </div>
    </div>
  );
}
