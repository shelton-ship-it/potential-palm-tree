'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Registo deixou de ser local — mesma lógica do /auth/login (ver esse
// ficheiro para o contexto completo). Concentrado em app.pixgo.qzz.io,
// que já tem "Continuar com Google" nas duas telas (login e registo).
const HUB_REGISTER_URL = 'https://app.pixgo.qzz.io/auth/register';

export default function RegisterPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const explicitReturnTo = searchParams.get('return_to');
    const returnTo = explicitReturnTo
      ? decodeURIComponent(explicitReturnTo)
      : `${window.location.origin}/main`;

    window.location.replace(`${HUB_REGISTER_URL}?return_to=${encodeURIComponent(returnTo)}`);
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="loading-ring" />
    </div>
  );
}
