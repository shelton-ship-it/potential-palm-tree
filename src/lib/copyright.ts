// src/lib/copyright.ts
// Tipos e utilitários do fluxo de notificação de direitos autorais
// (formulário, resposta e Portal de Proteção).

export type ReportStatus = 'pending' | 'rejected' | 'removed';

export interface ReportItem {
  url: string;
  content_id: string | null;
  full: boolean;
  start: number | null;
  end: number | null;
}

export interface PublicReport {
  found: boolean;
  id: string;
  status?: ReportStatus;
  relationship?: string;
  work_url?: string;
  detection_method?: string | null;
  items?: ReportItem[];
  team_response?: string | null;
  responded_at?: string | null;
  decided_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const MAX_ITEMS = 20;
export const PROTOCOL_RE = /^DMCA-\d{4}-[A-Z0-9]{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const RELATIONSHIPS = ['owner', 'agent', 'licensee'] as const;
export const DETECTION_METHODS = ['manual', 'audio', 'automated', 'other'] as const;

export const RELATIONSHIP_KEYS: Record<string, string> = {
  owner: 'copyright.form.relOwner',
  agent: 'copyright.form.relAgent',
  licensee: 'copyright.form.relLicensee',
};

export const DETECTION_KEYS: Record<string, string> = {
  manual: 'copyright.form.detManual',
  audio: 'copyright.form.detAudio',
  automated: 'copyright.form.detAuto',
  other: 'copyright.form.detOther',
};

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Segundos para HH:MM:SS. */
export function formatClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Protocolos guardados neste navegador ─────────────────────────────────
// O par (protocolo, e-mail) é a credencial de consulta. Fica apenas em
// localStorage; o portal consulta sempre o servidor para o estado atual.
const STORE_KEY = 'pixgo_copyright_reports';
const STORE_MAX = 50;

export interface StoredReport {
  id: string;
  email: string;
  created_at: string;
}

export function readStoredReports(): StoredReport[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter(r => r && PROTOCOL_RE.test(r.id) && typeof r.email === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveStoredReport(entry: StoredReport): void {
  try {
    const list = readStoredReports().filter(r => r.id !== entry.id);
    list.unshift(entry);
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, STORE_MAX)));
  } catch {
    /* armazenamento indisponível: o protocolo continua visível na página */
  }
}
