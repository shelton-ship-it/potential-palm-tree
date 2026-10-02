'use client';
import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────
// v4.0 — PÁGINA SUBSTITUÍDA POR COMPLETO.
//
// O QUE HAVIA AQUI: um checkout completo de cripto (USDT/Polygon) — QR code,
// endereço de carteira, conversão USDT→BRL, polling de confirmação on-chain
// — que chamava paymentsApi.convert() / .create() / .status(id). Essas 3
// funções JÁ NÃO EXISTEM em lib/api.ts (paymentsApi só tem plans/subscription/
// history/cancel) e as rotas correspondentes (/convert, /create, /status/:id,
// /scan) JÁ FORAM REMOVIDAS do backend (routes/payments.js, v3.0 "limpeza de
// cripto órfã" — comentário lá confirma: "Nada disto era chamado por nenhum
// frontend actual — o frontend_web já redirecciona 'Assinar' para
// app.pixgo.qzz.io desde a migração para Hotmart").
//
// Ou seja: esta página nunca devia ter sido alcançável, mas continuava no
// bundle. Quem chegasse aqui (link antigo, favorito, /main/plans/checkout
// digitado directamente) via `paymentsApi.convert is not a function` a
// rebentar em runtime, ou — consoante o que sobreviveu do estado antigo em
// cache — os valores "1.00 USDT / mês" / "2.00 USDT / trimestre" / "6.00
// USDT / ano" que já não correspondem a nada real (preços reais agora são
// R$ 6/10/30, servidos por GET /api/payments/plans, e o pagamento é 100%
// Hotmart — cartão/Pix/boleto, sem cripto).
//
// FIX: a página de planos (/main/plans) já resolve isto correctamente —
// busca os planos reais da API e, ao clicar "Assinar", redirecciona para o
// checkout Hotmart no hub (app.pixgo.qzz.io/main/plans/checkout), com
// return_to preservado. Esta rota interna passa a ser só um redirect fino
// para lá, preservando `plan` e `return_to` da querystring, para não
// partir nenhum link antigo que ainda aponte para /main/plans/checkout.
// ─────────────────────────────────────────────────────────────────────────

const HUB_CHECKOUT_URL = 'https://app.pixgo.qzz.io/main/plans/checkout';

export default function CheckoutPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const plan = searchParams.get('plan');
    const returnTo = searchParams.get('return_to')
      || `${window.location.origin}/main/plans`;

    const params = new URLSearchParams();
    if (plan) params.set('plan', plan);
    params.set('return_to', returnTo);

    window.location.replace(`${HUB_CHECKOUT_URL}?${params.toString()}`);
  }, [searchParams]);

  return (
    <div className="page-loading" style={{ minHeight: '50vh' }}>
      <div className="loading-ring" />
      <span style={{ color: 'var(--color-text-muted)' }}>A redireccionar para o pagamento...</span>
    </div>
  );
}
