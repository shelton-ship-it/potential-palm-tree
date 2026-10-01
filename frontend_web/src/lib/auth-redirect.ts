// lib/auth-redirect.ts
// ── Redirecionamento para login preservando a página actual ─────────────────
//
// FIX: todos os pontos que mandavam o utilizador para /auth/login faziam
// router.push('/auth/login') sem return_to. O stub em app/auth/login/page.tsx
// já sabe reencaminhar de volta para return_to depois do login no hub
// (app.pixgo.qzz.io) — mas sem este parâmetro ele caía sempre no fallback
// (${origin}/main), perdendo a página onde o utilizador estava (ex.: a
// meio de um vídeo, num canal específico, etc.).
//
// FIX (pedido explícito — "numa TV têm de aparecer os dois tipos de login,
// o normal e o de código"): nenhum dos 5 pontos que chamam esta função
// (main/layout.tsx e as páginas de watch/channels/content, ao verificar
// se há sessão) sabia distinguir TV. Todos mandavam sempre para
// /auth/login, que por sua vez já nem tem UI própria — só redireciona de
// imediato para o hub externo (app.pixgo.qzz.io), sem passar por
// /auth/tv em momento nenhum. Ou seja: numa TV sem sessão, o código de 6
// dígitos (a única forma prática de entrar com um comando remoto, sem
// teclado) nunca chegava a aparecer — só a página do hub, pensada para
// rato/teclado. /auth/tv já mostra os dois métodos (o teclado numérico
// do código, e um link "Entrar com utilizador e senha" que vai para o
// hub) — só faltava ser mesmo o destino em dispositivos TV. Como os 5
// pontos chamam loginRedirectUrl() sem argumento (usando o valor por
// omissão '/auth/login'), a substituição fica só aqui: nenhum precisa de
// saber sobre TV directamente.
//
// Uso: loginRedirectUrl() devolve o caminho local com return_to já
// preenchido com a URL actual completa — usar com router.push(...).

import { isLikelyTV } from './tv-navigation';

export function loginRedirectUrl(path: '/auth/login' | '/auth/register' | '/auth/tv' = '/auth/login'): string {
  if (typeof window === 'undefined') return path;
  if (path === '/auth/login' && isLikelyTV()) path = '/auth/tv';
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${path}?return_to=${encodeURIComponent(returnTo)}`;
}
