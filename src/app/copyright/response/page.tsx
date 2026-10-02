// src/app/copyright/response/page.tsx
// Página de resposta: confirmação do envio, protocolo e próximos passos.
'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import CheckIcon from '@mui/icons-material/Check';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CopyrightShell from '@/components/copyright/CopyrightShell';
import StatusBadge from '@/components/copyright/StatusBadge';
import { copyrightApi } from '@/lib/api';
import { PROTOCOL_RE, PublicReport, readStoredReports } from '@/lib/copyright';

export default function CopyrightResponsePage() {
  const { t, i18n } = useTranslation();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [report, setReport] = useState<PublicReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = (new URLSearchParams(window.location.search).get('id') || '').trim().toUpperCase();
    setId(PROTOCOL_RE.test(raw) ? raw : null);
  }, []);

  // Estado atual lido do servidor, quando as credenciais estão neste navegador.
  useEffect(() => {
    if (!id) return;
    const stored = readStoredReports().find(r => r.id === id);
    if (!stored) return;
    copyrightApi.lookup([{ id, email: stored.email }])
      .then(res => {
        const r = res?.reports?.[0];
        if (r && r.found !== false) setReport(r);
      })
      .catch(() => { /* o protocolo continua visível sem o resumo */ });
  }, [id]);

  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* área de transferência indisponível */ }
  };

  if (id === undefined) return <CopyrightShell narrow><div /></CopyrightShell>;

  if (id === null) {
    return (
      <CopyrightShell narrow>
        <div className="card cr-success">
          <div className="cr-success-icon warn"><ReportProblemOutlinedIcon style={{ fontSize: 34 }} /></div>
          <h1>{t('copyright.response.invalidTitle')}</h1>
          <p className="cr-message">{t('copyright.response.invalidBody')}</p>
          <div className="cr-actions">
            <Link href="/copyright/portal" className="btn btn-primary">{t('copyright.response.toPortal')}</Link>
            <Link href="/copyright" className="btn btn-secondary">{t('copyright.response.newReport')}</Link>
          </div>
        </div>
      </CopyrightShell>
    );
  }

  const locale = i18n.language === 'pt' ? 'pt-BR' : i18n.language;
  const next = [1, 2, 3, 4];

  return (
    <CopyrightShell narrow>
      <div className="card cr-success">
        <div className="cr-success-icon"><CheckIcon style={{ fontSize: 38 }} /></div>
        <h1>{t('copyright.response.title')}</h1>
        <p className="cr-success-sub">{t('copyright.response.subtitle')}</p>

        <div className="cr-protocol">
          <div style={{ textAlign: 'left' }}>
            <div className="cr-protocol-label">{t('copyright.response.protocolLabel')}</div>
            <div className="cr-protocol-value">{id}</div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
            <ContentCopyIcon style={{ fontSize: 15 }} />
            {copied ? t('copyright.response.copied') : t('copyright.response.copy')}
          </button>
        </div>

        <p className="cr-message">{t('copyright.response.message')}</p>

        {report && (
          <dl className="cr-summary">
            <div>
              <dt>{t('copyright.response.summaryDate')}</dt>
              <dd>{report.created_at ? new Date(report.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</dd>
            </div>
            <div>
              <dt>{t('copyright.response.summaryItems')}</dt>
              <dd>{report.items?.length ?? 0}</dd>
            </div>
            <div>
              <dt>{t('copyright.response.summaryStatus')}</dt>
              <dd><StatusBadge status={report.status} /></dd>
            </div>
          </dl>
        )}

        <div className="cr-actions">
          <Link href="/copyright/portal" className="btn btn-primary">{t('copyright.response.toPortal')}</Link>
          <Link href="/copyright" className="btn btn-secondary">{t('copyright.response.newReport')}</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header"><div className="card-title">{t('copyright.response.nextTitle')}</div></div>
        <ol className="cr-steps">
          {next.map(n => (
            <li className="cr-step" key={n}>
              <span className="cr-num">{n}</span>
              <div>
                <div className="cr-step-title">{t(`copyright.response.next${n}Title`)}</div>
                <div className="cr-step-text">{t(`copyright.response.next${n}`)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </CopyrightShell>
  );
}
