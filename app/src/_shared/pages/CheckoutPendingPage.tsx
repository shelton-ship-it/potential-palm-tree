'use client';
import CheckoutStatusPage from './CheckoutStatusPage';

// Thank You Page "Aguardando Pagamento" — configurar esta URL na Hotmart em:
// Produto → Página de Obrigado → Aguardando Pagamento (ex: boleto/Pix
// gerado mas ainda não compensado).
export default function CheckoutPendingPage() {
  return <CheckoutStatusPage status="pending" />;
}
