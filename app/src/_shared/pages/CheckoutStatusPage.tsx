'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import FactCheckIcon from '@mui/icons-material/FactCheck';

// Página comum às 3 "Opções de Páginas de Obrigado" da Hotmart (configuradas
// no painel deles — Aprovada / Aguardando Pagamento / Aguardando Análise de
// Crédito). Mesma mecânica de retorno à origem para as 3: lê o cookie
// pixgo_checkout_return (gravado em CheckoutPage.tsx antes de abrir o
// widget) e reencaminha de volta para o serviço de onde a pessoa veio.
const CHECKOUT_RETURN_COOKIE = 'pixgo_checkout_return';

function readAndClearCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  // Limpa logo — não deve reaproveitar-se numa próxima assinatura.
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.pixgo.qzz.io`;
  return value;
}

export type CheckoutStatus = 'approved' | 'pending' | 'analysis';

const STATUS_CONFIG: Record<CheckoutStatus, {
  Icon: typeof CheckCircleIcon;
  color: string;
  titleKey: string; titleFallback: string;
  descKey: string; descFallback: string;
  redirectDelayMs: number;
}> = {
  approved: {
    Icon: CheckCircleIcon, color: 'var(--color-secondary)',
    titleKey: 'plans.paymentSuccessTitle', titleFallback: 'Pagamento aprovado!',
    descKey: 'plans.paymentSuccessDesc', descFallback: 'A tua assinatura já está activa.',
    redirectDelayMs: 1800,
  },
  pending: {
    Icon: HourglassEmptyIcon, color: 'var(--color-warning, #f5a623)',
    titleKey: 'plans.paymentPendingTitle', titleFallback: 'Aguardando pagamento',
    descKey: 'plans.paymentPendingDesc',
    descFallback: 'Assim que o pagamento (boleto ou Pix) for confirmado, o acesso é liberado automaticamente — não precisas de fazer mais nada.',
    redirectDelayMs: 3500, // mensagem mais longa, dá mais tempo pra ler
  },
  analysis: {
    Icon: FactCheckIcon, color: 'var(--color-warning, #f5a623)',
    titleKey: 'plans.paymentAnalysisTitle', titleFallback: 'Pagamento em análise',
    descKey: 'plans.paymentAnalysisDesc',
    descFallback: 'O teu pagamento está em análise de crédito. Isto normalmente demora poucos minutos — vais receber acesso assim que for aprovado.',
    redirectDelayMs: 3500,
  },
};

export default function CheckoutStatusPage({ status }: { status: CheckoutStatus }) {
  const { t }    = useTranslation();
  const router   = useRouter();
  const fetchMe  = useAuthStore(s => s.fetchMe);
  const [redirecting, setRedirecting] = useState(true);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;

  useEffect(() => {
    let cancelled = false;
    const returnTo = readAndClearCookie(CHECKOUT_RETURN_COOKIE);

    const planIsActive = () => {
      const pl = useAuthStore.getState().plan;
      return !!pl && pl.id !== 'free' && pl.is_active !== false;
    };

    // A activação do plano é assíncrona (webhook) e corre em serverless.
    // Em "approved" só redireciona quando o plano JÁ aparece activo em
    // /api/auth/me (sempre à rede, sem cache) — repete a cada 1.5s até ~15s.
    // O ZumboPay já só chega aqui depois de a transacção estar 'active';
    // este loop cobre sobretudo a Hotmart, cujo webhook pode demorar mais.
    // Em pending/analysis o pagamento pode nem estar confirmado: 1 tentativa.
    async function run() {
      const minDelay = new Promise(r => setTimeout(r, cfg.redirectDelayMs));
      const maxTries = status === 'approved' ? 10 : 1;
      for (let i = 0; i < maxTries && !cancelled; i++) {
        await fetchMe().catch(() => {});
        if (planIsActive()) break;
        if (i < maxTries - 1) await new Promise(r => setTimeout(r, 1500));
      }
      await minDelay;
      if (cancelled) return;

      if (returnTo) {
        // px_paid: sinal para a plataforma de destino descartar o cache local
        // do perfil e revalidar o plano à rede (ver pixel/store/auth.ts).
        try {
          const u = new URL(returnTo);
          u.searchParams.set('px_paid', String(Date.now()));
          window.location.href = u.toString();
        } catch {
          window.location.href = returnTo;
        }
      } else {
        setRedirecting(false);
        router.replace('/main/plans');
      }
    }
    run();

    return () => { cancelled = true; };
  }, [fetchMe, router, cfg.redirectDelayMs, status]);

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <Icon style={{ fontSize: 56, color: cfg.color, marginBottom: 16 }} />
      <h2 style={{ marginBottom: 8 }}>{t(cfg.titleKey, cfg.titleFallback)}</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
        {t(cfg.descKey, cfg.descFallback)}
      </p>
      {redirecting && <div className="loading-ring" style={{ margin: '0 auto' }} />}
    </div>
  );
}
