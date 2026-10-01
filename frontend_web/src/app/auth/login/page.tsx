'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Login deixou de ser local — pixgo.qzz.io não tem mais UI própria de
// autenticação. Redireciona para o hub central (app.pixgo.qzz.io), que
// concentra login/registo (incluindo "Continuar com Google") para todas
// as plataformas *.pixgo.qzz.io. Evita duplicar o botão Google (e o resto
// do formulário) em cada uma das ferramentas separadamente.
const HUB_LOGIN_URL = 'https://app.pixgo.qzz.io/auth/login';

export default function LoginPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserva para onde mandar o utilizador de volta depois do login —
    // se quem chamou já passou um return_to explícito, respeita; senão,
    // volta para /main (mesmo destino que o login local sempre teve).
    const explicitReturnTo = searchParams.get('return_to');
    const returnTo = explicitReturnTo
      ? decodeURIComponent(explicitReturnTo)
      : `${window.location.origin}/main`;

    window.location.replace(`${HUB_LOGIN_URL}?return_to=${encodeURIComponent(returnTo)}`);
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="loading-ring" />
    </div>
  );
}
