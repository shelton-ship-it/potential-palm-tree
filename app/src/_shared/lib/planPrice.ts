// _shared/lib/planPrice.ts
// ─────────────────────────────────────────────────────────────────────────────
// Formatação única do preço de um plano vindo de GET /api/plans (api-core).
//
// O backend é a autoridade (mesma função do checkout, resolveGatewayAndPrice):
// para IPs de Moçambique devolve os planos pagos já com `currency: 'MZN'` e o
// preço em meticais; para o resto não traz `currency` e o valor é o base, no
// símbolo por omissão da plataforma (NEXT_PUBLIC_CURRENCY_SYMBOL, default R$).
// Nada de país/moeda é decidido no frontend.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'R$';

export function formatPlanPrice(
  p: { price?: number | null; currency?: string | null; is_free?: boolean } | null | undefined,
  fallbackCurrency?: string | null,
): string {
  if (!p) return '';
  const value = Number(p.price ?? 0);
  if (p.is_free || value === 0) {
    // Grátis segue a moeda dos planos pagos (ex.: MZ -> "0 MZN"). Aceita a
    // moeda da lista como fallback, para funcionar mesmo antes de o backend
    // passar a mandar `currency` também no plano grátis.
    const cur = p.currency || fallbackCurrency;
    return cur && cur !== 'BRL' ? `0 ${cur}` : `${DEFAULT_SYMBOL}0`;
  }
  if (p.currency && p.currency !== 'BRL') {
    // Moeda vinda do backend (ex.: MZN) — código depois do valor, sem casas
    // decimais quando o valor é inteiro (140 MZN, não 140.00 MZN).
    const txt = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return `${txt} ${p.currency}`;
  }
  return `${DEFAULT_SYMBOL}${value.toFixed(2)}`;
}
