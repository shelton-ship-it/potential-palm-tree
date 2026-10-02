'use client';
import React, { useRef, useEffect } from 'react';

// Modal de "sessão encerrada" — aparece quando o heartbeat devolve 409
// (Session Replaced): outro dispositivo ultrapassou o limite de ecrãs
// simultâneos do plano e este ficou marcado como inactivo (ver
// isScreenStillActive em middleware/rate-limit.js do api.rar). A mensagem
// vem sempre de body.message, devolvida pelo próprio backend — nada aqui
// é texto fixo além do título/botão.
export default function SessionReplacedModal({
  message, onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { btnRef.current?.focus(); }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal scale-in" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ padding: '32px 26px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 900, marginBottom: 8 }}>
            Sessão encerrada
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 22, lineHeight: 1.6 }}>
            {message}
          </p>
          <button ref={btnRef} className="btn btn-primary" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
