'use client';
import CheckoutStatusPage from './CheckoutStatusPage';

// Thank You Page "Aprovada" — configurar esta URL na Hotmart em:
// Produto → Página de Obrigado → Assinatura Aprovada.
export default function CheckoutSuccessPage() {
  return <CheckoutStatusPage status="approved" />;
}
