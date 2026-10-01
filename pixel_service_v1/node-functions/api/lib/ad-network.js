// lib/ad-network.js
// ── Configuração dos provedores de anúncios (Adsterra + HilltopAds) ────────
//
// Plug-and-play: nada aqui está fixo no código. Assim que as zonas forem
// criadas nos painéis, basta configurar as env vars abaixo — nada no
// frontend precisa de redeploy, porque ele lê tudo isto através de
// GET /api/ads/status (ver middleware/ads.js). Enquanto uma var não estiver
// definida, o formato/zona correspondente simplesmente não aparece pro
// cliente — nunca quebra nada, só fica inactivo até ser configurado.
//
// Rodada 6 (integração VAST 3.0 HilltopAds, pre-roll + múltiplos mid-rolls):
// a HilltopAds tem UMA ÚNICA zona VAST 3.0 aprovada pro Pixgo — Zone ID
// 7373461 — e essa mesma zona passa a ser a fonte PRIMÁRIA tanto do
// pre-roll quanto dos mid-rolls (é o que HILLTOPADS_VAST_TAG_URL representa;
// o valor em si — a VAST Tag URL gerada pela Hilltop pra essa zona — não é
// inventado aqui, tem de ser colado nessa env var a partir do painel deles).
// Adsterra (ADSTERRA_VAST_TAG_URL) fica como FALLBACK automático só pro
// pre-roll, caso a Hilltop ainda não esteja configurada — preserva o que já
// estava em produção sem exigir a var nova de imediato. Assim que
// HILLTOPADS_VAST_TAG_URL for definida, ela passa a servir os dois formatos
// de vídeo (pre-roll e mid-roll), como pedido — uma única tag, um único
// lugar de configuração (aqui), nada espalhado pelo código do player.
//   • Pre-roll  (vídeo, VAST) -> HilltopAds (zona 7373461); sem ela, cai pra Adsterra
//   • Mid-roll  (vídeo, VAST) -> HilltopAds (zona 7373461) sempre — com pod
//                                 de até MAX_ADS_PER_MIDROLL anúncios (ver
//                                 MidRollOverlay.tsx no frontend)
//   • Banner display (web)    -> Adsterra apenas (inalterado)
//   • Native banner (catálogo)-> Adsterra (ver Rodada 7 abaixo)
// AdPrerollGate.tsx e MidRollOverlay.tsx usam lib/vast.ts, que é um parser
// VAST cru — agnóstico de provedor. Por isso basta apontar cada campo pra
// uma zona diferente; nenhum componente de player precisa de alteração.
//
// Rodada 7 (Adsterra Native Banner no catálogo): substitui o antigo
// ADSTERRA_NATIVE_URL (nunca consumido por nenhum componente, Rodada 5) pelas
// 3 vars abaixo, agora sim consumidas por components/AdsterraNative.tsx.
//
// Vars Adsterra (todas opcionais):
//   ADSTERRA_VAST_TAG_URL       -> zona "Video Pre-Roll (VAST)" — agora só
//                                  usada como fallback do pre-roll (ver acima)
//   ADSTERRA_SOCIAL_BAR_URL     -> zona "Social Bar" (script) — config existe,
//                                  NENHUM componente consome ainda (não usado
//                                  de propósito — formato mais invasivo)
//   ADSTERRA_NATIVE_ENABLED     -> 'true'/'1'/'yes' — liga o bloco Native no
//                                  catálogo (default: desligado)
//   ADSTERRA_NATIVE_SCRIPT      -> URL exacta do script `invoke.js` da zona
//                                  Native Banner ("NativeBanner_1"), copiada
//                                  do código oficial gerado no painel Adsterra
//   ADSTERRA_NATIVE_CONTAINER_ID -> id do <div> exigido por esse script,
//                                  também copiado do código oficial (o script
//                                  procura esse id no DOM pra renderizar)
//   ADSTERRA_BANNER_KEY         -> chave da zona "Banner" (`atOptions.key`)
//   ADSTERRA_BANNER_SCRIPT_HOST -> host do invoke.js da zona, sem protocolo
//                                  nem caminho (ex: www.highperformanceformat.com)
//   ADSTERRA_BANNER_WIDTH       -> largura do banner em px (default 300)
//   ADSTERRA_BANNER_HEIGHT      -> altura do banner em px (default 250)
//
// Vars HilltopAds (todas opcionais, mas HILLTOPADS_VAST_TAG_URL é a que
// falta pra pre-roll/mid-roll funcionarem de verdade):
//   HILLTOPADS_VAST_TAG_URL     -> zona "Instream Video/VAST" aprovada
//                                  (Zone ID 7373461) — usada em pre-roll E
//                                  mid-roll agora
//
// `vast_url` continua a existir por compatibilidade (aponta pro pre-roll
// resolvido) — quem quiser diferenciar deve ler `vast_preroll_url` /
// `vast_midroll_url` (ambos apontam pra mesma zona Hilltop quando ela está
// configurada).
//
// `probe_domains`/`probe_urls` são derivados automaticamente das URLs
// configuradas — é o que o AdblockGuard usa no cliente pra testar bloqueio
// de DNS/rede contra os domínios REAIS dos provedores (não só o nosso).
//
// ── OTIMIZAÇÃO ──────────────────────────────────────────────────────────────
// `getAdNetworkConfig()` só depende de env vars, que não mudam entre
// requests dentro do mesmo processo (só mudam com um novo deploy/cold
// start). Antes, o objeto inteiro era reconstruído em TODA chamada — barato
// isoladamente, mas é uma das várias pequenas latências que se somam em
// `getAdsContext()`, que roda em toda resposta de API relacionada a ads.
// Agora o resultado é memoizado por processo; `resetAdNetworkConfigCache()`
// existe só para testes.

import { getEnv, getEnvInt, getEnvBool } from './env.js';

function hostnameOf(url) {
    try { return new URL(url).hostname; } catch { return null; }
}

let cachedConfig = null;

export function getAdNetworkConfig() {
    if (cachedConfig) return cachedConfig;

    const hilltopUrl  = getEnv('HILLTOPADS_VAST_TAG_URL') || null;
    const adsterraUrl = getEnv('ADSTERRA_VAST_TAG_URL')   || null;
    // Hilltop (zona única aprovada, 7373461) é a fonte primária dos dois
    // formatos de vídeo agora; Adsterra só entra como fallback do pre-roll
    // enquanto a Hilltop não estiver configurada.
    const vastPrerollUrl = hilltopUrl || adsterraUrl;
    const vastMidrollUrl = hilltopUrl || adsterraUrl;
    const socialBar      = getEnv('ADSTERRA_SOCIAL_BAR_URL') || null;

    const nativeEnabled     = getEnvBool('ADSTERRA_NATIVE_ENABLED', false);
    const nativeScript      = getEnv('ADSTERRA_NATIVE_SCRIPT')       || null;
    const nativeContainerId = getEnv('ADSTERRA_NATIVE_CONTAINER_ID') || null;
    const native = (nativeEnabled && nativeScript && nativeContainerId) ? {
        enabled:     true,
        script:      nativeScript,
        containerId: nativeContainerId,
    } : null;

    const bannerKey  = getEnv('ADSTERRA_BANNER_KEY')         || null;
    const bannerHost = getEnv('ADSTERRA_BANNER_SCRIPT_HOST') || null;
    const banner = (bannerKey && bannerHost) ? {
        key:    bannerKey,
        host:   bannerHost,
        width:  getEnvInt('ADSTERRA_BANNER_WIDTH', 300),
        height: getEnvInt('ADSTERRA_BANNER_HEIGHT', 250),
    } : null;

    const configuredUrls = [vastPrerollUrl, vastMidrollUrl, socialBar, native?.script].filter(Boolean);
    if (banner) configuredUrls.push(`https://${banner.host}/${banner.key}/invoke.js`);
    const probeDomains = [...new Set(configuredUrls.map(hostnameOf).filter(Boolean))];

    // FIX: probe_urls era um array único testado sempre via <script src> no
    // AdblockGuard — funciona pra scripts de verdade (native.script, banner
    // invoke.js), mas HILLTOPADS_VAST_TAG_URL devolve VAST XML, não JS.
    // Carregar XML como <script> dispara erro de MIME type no browser (não
    // executa conteúdo não-JS) — a Guard lia isso como "bloqueado" pra
    // QUALQUER pessoa, com ou sem adblock, assim que a zona Hilltop foi
    // configurada. Agora separado por técnica de sonda correta:
    //   probe_script_urls -> testados via <script src> (só scripts reais)
    //   probe_fetch_urls  -> testados via fetch no-cors (VAST/XML — o mesmo
    //                        jeito que lib/vast.ts de facto os consome)
    const scriptProbeUrls = [socialBar, native?.script].filter(Boolean);
    if (banner) scriptProbeUrls.push(`https://${banner.host}/${banner.key}/invoke.js`);
    const fetchProbeUrls  = [vastPrerollUrl, vastMidrollUrl].filter(Boolean);

    cachedConfig = {
        provider:          hilltopUrl ? 'hilltopads' : 'adsterra',
        vast_url:          vastPrerollUrl, // compat — mantido igual ao pre-roll
        vast_preroll_url:  vastPrerollUrl, // Hilltop (zona 7373461), fallback Adsterra
        vast_midroll_url:  vastMidrollUrl, // Hilltop (zona 7373461)
        social_bar_url:    socialBar,
        native,                            // { enabled, script, containerId } | null — Native Banner do catálogo
        banner,
        probe_domains:     probeDomains,
        probe_urls:        configuredUrls,   // compat — mantido, não usado mais pelo AdblockGuard (ver acima)
        probe_script_urls: scriptProbeUrls,  // AdblockGuard: sondar via <script src>
        probe_fetch_urls:  fetchProbeUrls,   // AdblockGuard: sondar via fetch no-cors (VAST/XML)
        configured:        configuredUrls.length > 0,
    };
    return cachedConfig;
}

// Só para testes/hot-reload — invalida a memoização acima.
export function resetAdNetworkConfigCache() {
    cachedConfig = null;
}
