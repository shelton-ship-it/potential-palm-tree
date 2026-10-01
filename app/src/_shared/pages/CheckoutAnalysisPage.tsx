'use client';
import CheckoutStatusPage from './CheckoutStatusPage';

// Thank You Page "Aguardando Análise de Crédito" — configurar esta URL na
// Hotmart em: Produto → Página de Obrigado → Aguardando Análise de Crédito
// (ex: cartão em análise antifraude).
export default function CheckoutAnalysisPage() {
  return <CheckoutStatusPage status="analysis" />;
}
