'use client';
import React, { useRef, useEffect } from 'react';

// Modal de "limite diário atingido" — usado pelo player de VOD (watch/[id])
// e pelo player de canais (main/channels). Preço, nome e features vêm
// SEMPRE de body.plans, devolvido pelo backend no 429 do heartbeat/stream
// (ver buildUpsellPlans em middleware/rate-limit.js do api.rar).
//
// FIX (API como única fonte de verdade): a frase de limite ("Você atingiu
// o limite gratuito de 1 hora por dia") estava hardcoded aqui e ficou
// desatualizada quando o backend passou de 1h/dispositivo para 2h/conta
// (ver FREE_STREAM_LIMIT_MS em middleware/rate-limit.js). Agora usa sempre
// `message`, o texto que o próprio 429 devolve (body.message) — se o
// limite mudar outra vez no backend, este modal muda sozinho, sem deploy
// de frontend. O fallback genérico só existe para nunca ficar em branco
// caso um chamador antigo não passe `message`.
export type UpsellPlan = {
  id: string; name: string; price: number; label: string;
  billing_cycle: string | null; features: string[];
};

export default function RateLimitModal({
  plans, message, onClose, onUpgrade,
}: {
  plans: UpsellPlan[];
  message?: string;
  onClose: () => void;
  onUpgrade: (planId: string) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { btnRef.current?.focus(); }, []);

  // O plano mensal é o "gancho" da branding ("por apenas R$X/mês") — os
  // outros ficam disponíveis como alternativa mais barata a longo prazo.
  const featured = plans.find(p => p.billing_cycle === 'monthly') || plans[0];
  const others   = plans.filter(p => p.id !== featured?.id);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal scale-in" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ padding: '32px 26px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏱</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 8 }}>
            Limite diário atingido
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 18, lineHeight: 1.6 }}>
            {message || 'Limite diário do plano gratuito atingido. Assine para streaming ilimitado.'}
          </p>

          {featured && (
            <div style={{
              background: 'var(--color-bg-darker)', borderRadius: 10, padding: '16px 18px',
              marginBottom: 18, border: '1px solid var(--color-primary)',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {featured.name}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}>
                por apenas {featured.label}
              </div>
              {featured.features?.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, textAlign: 'left', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {featured.features.map((f, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>✓ {f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {others.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 18 }}>
              Também disponível: {others.map(p => p.label).join(' · ')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              ref={btnRef}
              className="btn btn-primary"
              onClick={() => onUpgrade(featured?.id ?? 'monthly')}
            >
              Assinar
            </button>
            <button className="btn btn-ghost btn-sm" data-modal-close onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
