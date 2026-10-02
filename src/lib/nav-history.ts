// lib/nav-history.ts
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// ── Histórico de navegação interno da app ──────────────────────────────────
// FIX (pedido explícito — "voltar" ia sempre para a home, em qualquer
// página, mesmo saindo do player): router.back() depende inteiramente do
// histórico REAL do browser/WebView em que a app corre, e nem sempre isso
// reflecte a sequência de páginas que o utilizador visitou dentro da app —
// o resultado observado era router.back() cair sempre na home em vez da
// página anterior real.
//
// Em vez de confiar nesse histórico, mantemos aqui a NOSSA própria pilha de
// navegação (sessionStorage, por sessão de app), e os botões "Voltar" usam
// router.push() para o topo dessa pilha em vez de router.back() — deixa de
// depender de como o WebView/Next.js gerem o histórico nativo.
//
// pushHistory/replaceHistoryTop são chamados uma única vez, de forma
// genérica, em MainLayout (ver src/app/main/layout.tsx) a cada mudança de
// pathname/searchParams — usando window.history.length para distinguir uma
// navegação real (push, cresce o histórico) de uma troca de filtros na
// mesma página (replace, ex.: categoria do catálogo, não deve empilhar).

const KEY = 'px_nav_stack';
const MAX = 50;

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX))); } catch { /* storage indisponível — degrada para o fallback de handleBack */ }
}

// Navegação real (push) — regista a página actual no topo da pilha.
// Ignora repetições consecutivas (ex.: um re-render com a mesma URL).
export function pushHistory(url: string) {
  const stack = readStack();
  if (stack[stack.length - 1] === url) return;
  stack.push(url);
  writeStack(stack);
}

// Troca de filtros/params na MESMA página (replace) — actualiza o topo em
// vez de empilhar uma entrada nova (ex.: mudar de categoria no catálogo não
// deve exigir vários cliques em "Voltar" para sair da página).
export function replaceHistoryTop(url: string) {
  const stack = readStack();
  if (stack.length === 0) stack.push(url);
  else stack[stack.length - 1] = url;
  writeStack(stack);
}

// Usado pelo botão "Voltar": remove a página actual do topo e devolve a
// anterior (ou null se não houver nenhuma — primeira página desta sessão,
// ex.: deep link directo, sem navegação prévia dentro da app).
export function popHistory(currentUrl: string): string | null {
  const stack = readStack();
  if (stack[stack.length - 1] === currentUrl) stack.pop();
  const prev = stack.length > 0 ? stack[stack.length - 1] : null;
  writeStack(stack);
  return prev;
}

// Hook usado pelos botões "Voltar" — router.push() para o topo da nossa
// pilha em vez de router.back(). `fallback` é usado só quando não há
// nenhuma página anterior nesta sessão (ex.: chegou aqui por deep link,
// sem navegação prévia dentro da app).
export function useAppBack(fallback = '/main') {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  return () => {
    const qs      = searchParams.toString();
    const current = pathname + (qs ? `?${qs}` : '');
    const prev    = popHistory(current);
    router.push(prev || fallback);
  };
}
