'use client';
import { create } from 'zustand';

interface User {
  id: string; username: string; name: string;
  email?: string; role: string; plan_id: string;
}

interface Plan {
  id: string; name: string; price?: number;
  is_active?: boolean; expires_at?: string; duration_days?: number;
}

interface AuthState {
  user:     User | null;
  plan:     Plan | null;
  hydrated: boolean;
  loading:  boolean;
  login:          (u: string, p: string) => Promise<void>;
  register:       (d: { username: string; password: string; name: string; email?: string }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout:         () => Promise<void>;
  fetchMe:        () => Promise<boolean>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

/**
 * Fetch autenticado — SSO entre subdomínios via cookie de sessão
 * (Domain=.pixgo.qzz.io), enviado automaticamente pelo browser em qualquer
 * pedido a esta API vindo de qualquer subdomínio *.pixgo.qzz.io. Não há
 * localStorage nem gestão manual de token: `credentials: 'include'` é
 * suficiente. Isto é o que faz "logar uma vez, usar nas 8 plataformas"
 * funcionar sem duplicar login em cada uma.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  // cache:'no-store' — plano/perfil/pagamentos nunca podem vir do HTTP cache do browser.
  return fetch(url, { cache: 'no-store', ...init, headers, credentials: 'include' });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:     null,
  plan:     null,
  hydrated: false,
  loading:  false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await authedFetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.message || 'Login failed');
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      set({ user: data.user, plan: data.plan, loading: false, hydrated: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ loading: true });
    try {
      const res = await authedFetch(`${API_BASE}/api/auth/register`, {
        method: 'POST', body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.message || 'Register failed');
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      set({ user: data.user, plan: data.plan, loading: false, hydrated: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  loginWithGoogle: async (credential) => {
    set({ loading: true });
    try {
      const res = await authedFetch(`${API_BASE}/api/auth/google`, {
        method: 'POST', body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e: any = new Error(err.message || 'Google login failed');
        e.status = res.status;
        e.error = err.error;
        throw e;
      }
      const data = await res.json();
      set({ user: data.user, plan: data.plan, loading: false, hydrated: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authedFetch(`${API_BASE}/api/auth/logout`, { method: 'POST', body: JSON.stringify({}) });
    } catch { /* melhor esforço */ }
    set({ user: null, plan: null, loading: false });
  },

  /** Pergunta à API se há uma sessão válida (via cookie partilhado).
   *  Devolve true/false — quem chama decide o que fazer (mostrar a
   *  ferramenta ou mandar pro login central). */
  fetchMe: async () => {
    try {
      const res = await authedFetch(`${API_BASE}/api/auth/me`);
      if (!res.ok) {
        set({ user: null, plan: null, hydrated: true });
        return false;
      }
      const data = await res.json();
      set({ user: data.user || null, plan: data.plan || null, hydrated: true });
      return true;
    } catch {
      set({ hydrated: true });
      return false;
    }
  },
}));
