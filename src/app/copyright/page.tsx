// src/app/copyright/page.tsx
// Formulário de notificação de infração de direitos autorais.
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CopyrightShell from '@/components/copyright/CopyrightShell';
import TimeField from '@/components/copyright/TimeField';
import { copyrightApi } from '@/lib/api';
import {
  DETECTION_KEYS, DETECTION_METHODS, EMAIL_RE, MAX_ITEMS, RELATIONSHIPS, RELATIONSHIP_KEYS,
  isHttpUrl, saveStoredReport,
} from '@/lib/copyright';

interface ItemState { key: number; url: string; full: boolean; start: number; end: number; }

let itemKey = 0;
const newItem = (): ItemState => ({ key: ++itemKey, url: '', full: true, start: 0, end: 0 });

export default function CopyrightFormPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [workUrl, setWorkUrl] = useState('');
  const [items, setItems] = useState<ItemState[]>(() => [newItem()]);
  const [detection, setDetection] = useState('');
  const [details, setDetails] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (key: number, patch: Partial<ItemState>) =>
    setItems(list => list.map(it => (it.key === key ? { ...it, ...patch } : it)));

  const validate = (): string => {
    if (name.trim().length < 2 || !email.trim() || !workUrl.trim() || items.some(it => !it.url.trim())) {
      return t('copyright.errors.required');
    }
    if (!relationship) return t('copyright.errors.relationship');
    if (!EMAIL_RE.test(email.trim())) return t('copyright.errors.email');
    if (!isHttpUrl(workUrl) || items.some(it => !isHttpUrl(it.url))) return t('copyright.errors.url');
    if (items.some(it => !it.full && it.end <= it.start)) return t('copyright.errors.range');
    if (!goodFaith || !accuracy) return t('copyright.errors.declarations');
    return '';
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const problem = validate();
    if (problem) { setError(problem); return; }

    setError('');
    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const created = await copyrightApi.submit({
        claimant_name: name.trim(),
        claimant_email: cleanEmail,
        relationship,
        work_url: workUrl.trim(),
        detection_method: detection,
        details: details.trim(),
        items: items.map(it => ({
          url: it.url.trim(),
          full: it.full,
          start: it.full ? null : it.start,
          end: it.full ? null : it.end,
        })),
        declaration_good_faith: true,
        declaration_accuracy: true,
        lang: ['pt', 'en', 'es'].includes(i18n.language) ? i18n.language : undefined,
      });
      saveStoredReport({ id: created.id, email: cleanEmail, created_at: created.created_at });
      router.push(`/copyright/response?id=${encodeURIComponent(created.id)}`);
    } catch (err: any) {
      setError(err?.status === 429 ? t('copyright.errors.rateLimit') : t('copyright.errors.generic'));
      setSubmitting(false);
    }
  };

  const steps = [1, 2, 3, 4];

  return (
    <CopyrightShell>
      <div className="cr-hero">
        <h1 className="page-title">{t('copyright.form.title')}</h1>
        <p>{t('copyright.form.subtitle')}</p>
      </div>

      <div className="cr-layout">
        <form className="card" onSubmit={onSubmit} noValidate>
          <div className="card-header">
            <div>
              <div className="card-title">{t('copyright.form.cardTitle')}</div>
              <div className="form-helper" style={{ marginTop: 2 }}>{t('copyright.form.cardSubtitle')}</div>
            </div>
            <span className="form-helper">{t('copyright.form.requiredNote')}</span>
          </div>

          {/* 1. Reclamante */}
          <section className="cr-section">
            <div className="cr-section-head">
              <span className="cr-num">1</span>
              <div>
                <div className="cr-section-title">{t('copyright.form.s1Title')}</div>
                <div className="cr-section-desc">{t('copyright.form.s1Desc')}</div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="cr-name">{t('copyright.form.name')} <span className="cr-req">*</span></label>
                <input id="cr-name" className="form-input" type="text" autoComplete="name" maxLength={200}
                  value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-email">{t('copyright.form.email')} <span className="cr-req">*</span></label>
                <input id="cr-email" className="form-input" type="email" autoComplete="email" maxLength={254}
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group full">
                <label className="form-label" htmlFor="cr-rel">{t('copyright.form.relationship')} <span className="cr-req">*</span></label>
                <select id="cr-rel" className="form-select" value={relationship} onChange={e => setRelationship(e.target.value)}>
                  <option value="">{t('copyright.form.relationshipSelect')}</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{t(RELATIONSHIP_KEYS[r])}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* 2. Obra e conteúdos */}
          <section className="cr-section">
            <div className="cr-section-head">
              <span className="cr-num">2</span>
              <div>
                <div className="cr-section-title">{t('copyright.form.s2Title')}</div>
                <div className="cr-section-desc">{t('copyright.form.s2Desc')}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cr-work">{t('copyright.form.workUrl')} <span className="cr-req">*</span></label>
              <input id="cr-work" className="form-input" type="url" inputMode="url" maxLength={2000}
                value={workUrl} onChange={e => setWorkUrl(e.target.value)} />
              <span className="form-helper">{t('copyright.form.workUrlHint')}</span>
            </div>

            <div className="form-group">
              <span className="form-label">{t('copyright.form.itemsLabel')} <span className="cr-req">*</span></span>
              <div className="cr-items">
                {items.map((it, idx) => (
                  <div className="cr-item" key={it.key}>
                    <div className="cr-item-head">
                      <span className="cr-item-label">{t('copyright.form.itemLabel', { n: idx + 1 })}</span>
                      {items.length > 1 && (
                        <button type="button" className="cr-item-remove"
                          aria-label={t('copyright.form.removeItem')} title={t('copyright.form.removeItem')}
                          onClick={() => setItems(list => list.filter(x => x.key !== it.key))}>
                          <CloseIcon style={{ fontSize: 18 }} />
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor={`cr-url-${it.key}`}>{t('copyright.form.itemUrl')}</label>
                      <input id={`cr-url-${it.key}`} className="form-input" type="url" inputMode="url" maxLength={2000}
                        value={it.url} onChange={e => updateItem(it.key, { url: e.target.value })} />
                    </div>

                    <label className="cr-check inline">
                      <input type="checkbox" checked={it.full}
                        onChange={e => updateItem(it.key, { full: e.target.checked })} />
                      <span className="cr-check-text">{t('copyright.form.fullContent')}</span>
                    </label>

                    {!it.full && (
                      <div className="form-group">
                        <span className="form-label">{t('copyright.form.affected')}</span>
                        <div className="cr-time-row">
                          <div className="form-group">
                            <span className="form-helper">{t('copyright.form.timeStart')}</span>
                            <TimeField value={it.start} onChange={v => updateItem(it.key, { start: v })}
                              groupLabel={`${t('copyright.form.itemLabel', { n: idx + 1 })}, ${t('copyright.form.timeStart')}`}
                              labels={{ h: t('copyright.form.timeHours'), m: t('copyright.form.timeMinutes'), s: t('copyright.form.timeSeconds') }} />
                          </div>
                          <div className="form-group">
                            <span className="form-helper">{t('copyright.form.timeEnd')}</span>
                            <TimeField value={it.end} onChange={v => updateItem(it.key, { end: v })}
                              groupLabel={`${t('copyright.form.itemLabel', { n: idx + 1 })}, ${t('copyright.form.timeEnd')}`}
                              labels={{ h: t('copyright.form.timeHours'), m: t('copyright.form.timeMinutes'), s: t('copyright.form.timeSeconds') }} />
                          </div>
                        </div>
                        <span className="form-helper">{t('copyright.form.timeHint')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {items.length < MAX_ITEMS ? (
                <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={() => setItems(list => [...list, newItem()])}>
                  <AddIcon style={{ fontSize: 18 }} />
                  {t('copyright.form.addItem')}
                </button>
              ) : (
                <span className="form-helper">{t('copyright.form.itemsLimit', { max: MAX_ITEMS })}</span>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label" htmlFor="cr-det">{t('copyright.form.detection')} <span className="cr-opt">({t('copyright.form.optional')})</span></label>
                <select id="cr-det" className="form-select" value={detection} onChange={e => setDetection(e.target.value)}>
                  <option value="">{t('copyright.form.detectionNone')}</option>
                  {DETECTION_METHODS.map(m => <option key={m} value={m}>{t(DETECTION_KEYS[m])}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label" htmlFor="cr-details">{t('copyright.form.details')} <span className="cr-opt">({t('copyright.form.optional')})</span></label>
                <textarea id="cr-details" className="form-textarea" rows={4} maxLength={4000}
                  value={details} onChange={e => setDetails(e.target.value)} />
                <span className="form-helper">{t('copyright.form.detailsHint')}</span>
              </div>
            </div>
          </section>

          {/* 3. Declarações */}
          <section className="cr-section">
            <div className="cr-section-head">
              <span className="cr-num">3</span>
              <div>
                <div className="cr-section-title">{t('copyright.form.s3Title')}</div>
                <div className="cr-section-desc">{t('copyright.form.s3Desc')}</div>
              </div>
            </div>
            <label className="cr-check">
              <input type="checkbox" checked={goodFaith} onChange={e => setGoodFaith(e.target.checked)} />
              <span className="cr-check-text"><strong>{t('copyright.form.declGoodFaithTitle')}</strong> {t('copyright.form.declGoodFaith')}</span>
            </label>
            <label className="cr-check">
              <input type="checkbox" checked={accuracy} onChange={e => setAccuracy(e.target.checked)} />
              <span className="cr-check-text"><strong>{t('copyright.form.declAccuracyTitle')}</strong> {t('copyright.form.declAccuracy')}</span>
            </label>
          </section>

          <div className="cr-submit">
            {error && (
              <div className="cr-error" role="alert">
                <ErrorOutlineIcon style={{ fontSize: 18, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }} disabled={submitting}>
              {submitting ? t('copyright.form.submitting') : t('copyright.form.submit')}
            </button>
            <p className="cr-submit-note">{t('copyright.form.submitNote')}</p>
          </div>
        </form>

        <aside className="cr-aside">
          <div className="card">
            <div className="card-header"><div className="card-title">{t('copyright.form.howTitle')}</div></div>
            <ol className="cr-steps">
              {steps.map(n => (
                <li className="cr-step" key={n}>
                  <span className="cr-num">{n}</span>
                  <div>
                    <div className="cr-step-title">{t(`copyright.form.step${n}Title`)}</div>
                    <div className="cr-step-text">{t(`copyright.form.step${n}`)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="cr-note">
            <div className="cr-note-title">{t('copyright.form.noticeTitle')}</div>
            <div className="cr-note-text">{t('copyright.form.noticeBody')}</div>
          </div>
          <div className="cr-note">
            <div className="cr-note-title">{t('copyright.form.beforeTitle')}</div>
            <div className="cr-note-text">{t('copyright.form.beforeBody')}</div>
          </div>

          <Link href="/copyright/portal" className="card cr-aside-link">
            <span>{t('copyright.form.portalCtaTitle')}<br /><span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '0.77rem' }}>{t('copyright.form.portalCta')}</span></span>
            <ArrowForwardIcon style={{ fontSize: 20, color: 'var(--color-primary)' }} />
          </Link>
        </aside>
      </div>
    </CopyrightShell>
  );
}
