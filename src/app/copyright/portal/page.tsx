// src/app/copyright/portal/page.tsx
// Portal de Proteção: notificações do denunciante, estado de cada uma e
// resposta da equipe. Os dados vêm sempre do servidor (sem cache).
'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import CopyrightShell from '@/components/copyright/CopyrightShell';
import StatusBadge from '@/components/copyright/StatusBadge';
import { copyrightApi } from '@/lib/api';
import {
  DETECTION_KEYS, EMAIL_RE, PROTOCOL_RE, PublicReport, RELATIONSHIP_KEYS,
  formatClock, readStoredReports, saveStoredReport,
} from '@/lib/copyright';

export default function ProtectionPortalPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt' ? 'pt-BR' : i18n.language;

  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const [lkId, setLkId] = useState('');
  const [lkEmail, setLkEmail] = useState('');
  const [lkMsg, setLkMsg] = useState('');
  const [lkBusy, setLkBusy] = useState(false);

  const load = useCallback(async () => {
    const stored = readStoredReports().slice(0, 25);
    if (!stored.length) {
      setReports([]);
      setLoading(false);
      setUpdatedAt(new Date());
      return;
    }
    try {
      const res = await copyrightApi.lookup(stored.map(r => ({ id: r.id, email: r.email })));
      const found: PublicReport[] = (res?.reports || []).filter((r: PublicReport) => r.found !== false);
      found.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setReports(found);
      setError('');
      setUpdatedAt(new Date());
    } catch {
      setError(t('copyright.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    // Ao voltar para a aba, atualiza para refletir o estado atual.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const refresh = () => { setLoading(true); load(); };

  const onLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lkBusy) return;
    const id = lkId.trim().toUpperCase();
    const email = lkEmail.trim().toLowerCase();
    if (!PROTOCOL_RE.test(id) || !EMAIL_RE.test(email)) { setLkMsg(t('copyright.portal.lookupInvalid')); return; }

    setLkBusy(true);
    setLkMsg('');
    try {
      const res = await copyrightApi.lookup([{ id, email }]);
      const r: PublicReport | undefined = res?.reports?.[0];
      if (!r || r.found === false) {
        setLkMsg(t('copyright.portal.lookupNotFound'));
      } else {
        saveStoredReport({ id, email, created_at: r.created_at || new Date().toISOString() });
        setLkId('');
        setLkEmail('');
        setLoading(true);
        await load();
      }
    } catch {
      setLkMsg(t('copyright.errors.load'));
    } finally {
      setLkBusy(false);
    }
  };

  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <CopyrightShell>
      <div className="page-header">
        <div className="cr-hero" style={{ marginBottom: 0 }}>
          <h1 className="page-title">{t('copyright.portal.title')}</h1>
          <p>{t('copyright.portal.subtitle')}</p>
        </div>
        <div className="cr-toolbar">
          {updatedAt && (
            <span className="cr-updated">
              {t('copyright.portal.updatedAt', { time: updatedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            <RefreshIcon style={{ fontSize: 17 }} />
            {t('copyright.portal.refresh')}
          </button>
          <Link href="/copyright" className="btn btn-primary btn-sm">
            <AddIcon style={{ fontSize: 17 }} />
            {t('copyright.portal.newReport')}
          </Link>
        </div>
      </div>

      {error && <div className="cr-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {loading && !reports.length ? (
          <div className="empty-state" role="status"><span className="empty-desc">{t('copyright.portal.loading')}</span></div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ShieldOutlinedIcon style={{ fontSize: 30 }} /></div>
            <div className="empty-title">{t('copyright.portal.emptyTitle')}</div>
            <div className="empty-desc">{t('copyright.portal.emptyBody')}</div>
          </div>
        ) : (
          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead>
                <tr>
                  <th>{t('copyright.portal.colProtocol')}</th>
                  <th>{t('copyright.portal.colDate')}</th>
                  <th>{t('copyright.portal.colContents')}</th>
                  <th>{t('copyright.portal.colStatus')}</th>
                  <th>{t('copyright.portal.colResponse')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const expanded = !!open[r.id];
                  const items = r.items || [];
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td data-label={t('copyright.portal.colProtocol')}>
                          <div>
                            <span className="cr-mono">{r.id}</span>
                            <div>
                              <button type="button" className="cr-toggle" aria-expanded={expanded}
                                onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}>
                                {expanded ? t('copyright.portal.hideDetails') : t('copyright.portal.showDetails')}
                                {expanded ? <ExpandLessIcon style={{ fontSize: 16 }} /> : <ExpandMoreIcon style={{ fontSize: 16 }} />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td data-label={t('copyright.portal.colDate')} className="cr-muted">{fmt(r.created_at)}</td>
                        <td data-label={t('copyright.portal.colContents')}>{t('copyright.portal.contentsCount', { count: items.length })}</td>
                        <td data-label={t('copyright.portal.colStatus')}><StatusBadge status={r.status} /></td>
                        <td data-label={t('copyright.portal.colResponse')} className="cr-cell-block">
                          {r.team_response
                            ? <div className="cr-response">{r.team_response}</div>
                            : <span className="cr-muted">{t('copyright.portal.noResponse')}</span>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="cr-row-detail">
                          <td colSpan={5} className="cr-cell-block">
                            <dl className="cr-detail-grid">
                              <div className="full">
                                <dt>{t('copyright.portal.detailLinks')}</dt>
                                <dd>
                                  <ul className="cr-links">
                                    {items.map((it, i) => (
                                      <li key={i}>
                                        <a href={it.url} target="_blank" rel="noopener noreferrer">{it.url}</a>
                                        <span className="cr-muted">
                                          {it.full || it.start == null || it.end == null
                                            ? t('copyright.portal.wholeContent')
                                            : t('copyright.portal.range', { start: formatClock(it.start), end: formatClock(it.end) })}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </dd>
                              </div>
                              {r.work_url && (
                                <div className="full">
                                  <dt>{t('copyright.portal.detailWork')}</dt>
                                  <dd><a className="cr-anchor" href={r.work_url} target="_blank" rel="noopener noreferrer">{r.work_url}</a></dd>
                                </div>
                              )}
                              {r.relationship && RELATIONSHIP_KEYS[r.relationship] && (
                                <div><dt>{t('copyright.portal.detailRelationship')}</dt><dd>{t(RELATIONSHIP_KEYS[r.relationship])}</dd></div>
                              )}
                              {r.detection_method && DETECTION_KEYS[r.detection_method] && (
                                <div><dt>{t('copyright.portal.detailMethod')}</dt><dd>{t(DETECTION_KEYS[r.detection_method])}</dd></div>
                              )}
                              {r.decided_at && (
                                <div><dt>{t('copyright.portal.detailDecided')}</dt><dd>{fmt(r.decided_at)}</dd></div>
                              )}
                              {r.responded_at && (
                                <div><dt>{t('copyright.portal.detailResponded')}</dt><dd>{fmt(r.responded_at)}</dd></div>
                              )}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className="card cr-lookup" onSubmit={onLookup} noValidate>
        <div className="card-header">
          <div>
            <div className="card-title">{t('copyright.portal.lookupTitle')}</div>
            <div className="form-helper" style={{ marginTop: 2 }}>{t('copyright.portal.lookupBody')}</div>
          </div>
        </div>
        <div className="card-body">
          <div className="cr-lookup-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="lk-id">{t('copyright.portal.lookupProtocol')}</label>
              <input id="lk-id" className="form-input" type="text" autoComplete="off" maxLength={20}
                value={lkId} onChange={e => setLkId(e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lk-email">{t('copyright.portal.lookupEmail')}</label>
              <input id="lk-email" className="form-input" type="email" autoComplete="email" maxLength={254}
                value={lkEmail} onChange={e => setLkEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={lkBusy} style={{ justifyContent: 'center' }}>
              {t('copyright.portal.lookupSubmit')}
            </button>
          </div>
          {lkMsg && <div className="form-error" role="alert" style={{ marginTop: 10 }}>{lkMsg}</div>}
        </div>
      </form>
    </CopyrightShell>
  );
}
