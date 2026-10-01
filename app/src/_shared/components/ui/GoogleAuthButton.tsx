'use client';
import { useEffect, useRef } from 'react';

// Client ID é público — pode ficar no frontend (não é o Client Secret).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_ID = 'google-gsi-client';

function loadGsiScript(onLoad: () => void) {
  if (window.google?.accounts?.id) {
    onLoad();
    return;
  }
  const existing = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener('load', onLoad, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.id = GSI_SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = onLoad;
  document.head.appendChild(script);
}

interface GoogleAuthButtonProps {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export default function GoogleAuthButton({ onCredential, disabled }: GoogleAuthButtonProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('[GoogleAuthButton] NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado — botão oculto');
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode:   'popup',
        callback:  (response) => onCredentialRef.current(response.credential),
      });

      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type:            'standard',
        theme:           'filled_black',
        size:            'large',
        shape:           'pill',
        text:            'continue_with',
        logo_alignment:  'center',
        width:           340,
      });
    };

    loadGsiScript(render);

    return () => { cancelled = true; };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div
      ref={containerRef}
      className="google-auth-btn-wrap"
      style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
      aria-disabled={disabled}
    />
  );
}
