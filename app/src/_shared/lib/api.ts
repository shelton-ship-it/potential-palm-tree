// lib/api.ts — client HTTP central, genérico para todas as plataformas.
// Cada plataforma acrescenta o seu próprio módulo de serviço (ex: compressApi
// para o CompressHub) neste ficheiro ou num lib/service-api.ts próprio,
// seguindo exactamente o mesmo padrão de authApi/plansApi abaixo.

import { authedFetch } from '../store/auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

// Identificador desta plataforma — usado só para telemetria/logs no
// frontend; a API distingue as rotas pelo próprio path (/api/<servico>/*).
export const PLATFORM_ID = process.env.NEXT_PUBLIC_PLATFORM_ID || 'platform';

async function req<T = any>(method: string, path: string, data?: any): Promise<T> {
  const res = await authedFetch(API_BASE + '/api' + path, {
    method,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e: any = new Error(err.message || 'Request failed');
    e.status = res.status;
    e.data   = err;
    throw e;
  }
  return res.json();
}

export const get  = <T>(p: string)          => req<T>('GET',    p);
export const post = <T>(p: string, d?: any) => req<T>('POST',   p, d);
export const put  = <T>(p: string, d?: any) => req<T>('PUT',    p, d);
export const del  = <T>(p: string)          => req<T>('DELETE', p);

// ── Auth — matches api-core/routes/auth.js ────────────────────────────────
export const authApi = {
  register:       (d: any)       => post('/auth/register', d),
  me:             ()             => get('/auth/me'),
  update:         (d: any)       => put('/auth/me', d),
  changePassword: (d: any)       => post('/auth/change-password', d),
  setLanguage:    (lang: string) => post('/auth/language', { lang }),
  // Login de TV por código (fluxo invertido, sem QR/polling) — routes/device.js
  // no api-core. O hub (autenticado) pede o código aqui; quem o introduz na
  // TV é o próprio ecrã da TV (/auth/tv no frontend_web), numa única
  // requisição a /auth/device/activate feita a partir de lá, sem sessão.
  requestDeviceCode: () => post<{ code: string; expires_in: number }>('/auth/device/code'),
};

// ── Plans — matches api-core/routes/plans.js ──────────────────────────────
export const plansApi = {
  list:   () => get('/plans'),
  status: () => get('/plans/status'),
  cancel: () => post('/plans/cancel'),
};
