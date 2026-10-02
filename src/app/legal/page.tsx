// src/app/legal/page.tsx
// Versão pública da página legal (sem login), usada pelos links do rodapé das
// páginas de direitos autorais. Reutiliza integralmente o componente da
// página /main/legal, apenas com o cabeçalho e o rodapé institucionais.
'use client';
import React, { Suspense } from 'react';
import CopyrightShell from '@/components/copyright/CopyrightShell';
import LegalPage from '@/app/main/legal/page';

export default function PublicLegalPage() {
  return (
    <CopyrightShell narrow>
      <Suspense fallback={null}>
        <LegalPage />
      </Suspense>
    </CopyrightShell>
  );
}
