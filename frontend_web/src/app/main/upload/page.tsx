'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { uploadApi } from '@/lib/api';
import UploadTermsModal from '@/components/modals/UploadTermsModal';
import UploadRulesModal from '@/components/modals/UploadRulesModal';
import UploadGuideModal from '@/components/modals/UploadGuideModal';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// app/main/upload/page.tsx
//
// Formulário de envio de conteúdo. Espelha os campos do ingest.html
// (ferramenta interna de ingestão) na mesma medida em que fazem sentido
// para o utilizador público — mas usando o design system do Pixgo em vez
// do tema próprio do ingest.html, e sem nenhum dos blocos operacionais
// (contas activas, estado dos lotes, lista de jobs), que ficam só do
// lado da moderação (copyright-worker.js /admin).
//
// Só link — sem upload directo de ficheiro (não há onde os bytes
// ficariam guardados) e sem distinguir magnet/torrent na UI: é só um
// campo de link, simples.
//
// A identidade de quem envia (username + email, se preenchido no registo)
// é sempre capturada e associada ao envio, para auditoria no painel /admin.

const TERMS_KEY = 'pixgo_upload_terms_accepted';
const SERIES_TYPES = ['series', 'anime', 'dorama'];
const WORKSPACE_URL = 'https://workspace.pixgo.qzz.io';

// FIX (pedido explícito): tipos novos pedidos para a página de upload
// (entretenimento, finanças, viagens, estudos, cursos) — aparecem primeiro
// no <select>, os tipos de vídeo/série já existentes vêm a seguir. Também
// adicionados a schemas.content (pixel_service_v1/lib/validation.js) e às
// listas CONTENT_TYPES do catálogo, para não serem rejeitados na aprovação
// em /admin nem ficarem de fora do catálogo agregado.
const NEW_TYPES = ['entertainment', 'finance', 'travel', 'education', 'courses'] as const;
const EXISTING_TYPES = ['movie', 'series', 'anime', 'dorama', 'documentary'] as const;

// Ordem do menu = ordem desta lista; o valor inicial é sempre o 1.º item.
const TYPE_OPTIONS = [...NEW_TYPES, ...EXISTING_TYPES] as const;

export default function UploadPage() {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const [termsAccepted, setTermsAccepted] = useState(true); // evita flash do modal antes do useEffect
  const [showTerms, setShowTerms] = useState(false);
  // FIX (pedido explícito): distinto do consentimento acima (esse é
  // "uma vez só", persistido em localStorage). Este par de modais é um
  // lembrete informativo, sem Aceito/Recusa — reaparece sempre que se
  // entra nesta página, mesmo depois dos termos já terem sido aceites em
  // sessões anteriores. 'rules' aparece primeiro; ao clicar em qualquer um
  // dos botões (Entendi ou Ocultar, ambos apenas fecham) avança para
  // 'guide'; ao fechar esse, some de vez até à próxima visita à página.
  const [helperModal, setHelperModal] = useState<'rules' | 'guide' | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>(TYPE_OPTIONS[0]);
  const [year, setYear] = useState('');
  const [lang, setLang] = useState('pt');
  const [url, setUrl] = useState('');
  const [fileIndices, setFileIndices] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [thumbOk, setThumbOk] = useState(false);
  const [contentId, setContentId] = useState('');
  const [season, setSeason] = useState('1');

  const [advOpen, setAdvOpen] = useState(false);
  // Segmento HLS / altura máxima / warm concurrency deixaram de ser
  // configuráveis pelo criador — a pipeline usa sempre estes valores por
  // omissão (mantidos aqui só para o objeto `advanced` enviado ao /precheck).
  const segDuration = '4';
  const maxHeight = '720';
  const warmConcurrency = '8';

  // PixGo Creative — escolha do próprio criador, não é deteção automática.
  // Viaja no /precheck e é relacionada ao content_id final via
  // GET /creator-lookup/:job_id (ver copyright-worker.js).
  const [goCreative, setGoCreative] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const accepted = localStorage.getItem(TERMS_KEY) === 'true';
    setTermsAccepted(accepted);
    setShowTerms(!accepted);
    // Só entra na fila rules -> guide depois do consentimento único (acima)
    // já estar tratado — nunca se sobrepõe ao UploadTermsModal.
    if (accepted) setHelperModal('rules');
  }, []);

  // Consulta periódica do estado enquanto estiver "pending".
  useEffect(() => {
    if (!result || result.status !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const s = await uploadApi.status(result.id);
        if (s.status !== 'pending') setResult(s);
      } catch { /* silencioso — tenta de novo no próximo tick */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [result]);

  const isSeries = SERIES_TYPES.includes(type);
  const isMagnetLike = url.startsWith('magnet:') || url.endsWith('.torrent');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim() || !url.trim()) {
      setError(t('errors.requiredFields'));
      return;
    }
    if (isSeries && !contentId.trim()) {
      setError(t('errors.requiredFields'));
      return;
    }
    if (isSeries && !isMagnetLike) {
      setError(t('upload.seriesNeedsMagnet'));
      return;
    }

    setSubmitting(true);
    try {
      const metadata = {
        title: title.trim(),
        description: description.trim(),
        type,
        year: parseInt(year) || new Date().getFullYear(),
        lang: lang.trim() || 'pt',
        contentId: contentId.trim() || undefined,
      };

      const uploader = {
        id: user?.id || null,
        username: user?.username || null,
        email: user?.email || null,
      };

      const advanced = {
        seg_duration: segDuration || '4',
        max_encode_height: maxHeight || '720',
        warm_concurrency: warmConcurrency || '8',
      };

      const res = await uploadApi.precheck({
        metadata,
        uploader,
        goCreative,
        videoUrl: url.trim(),
        thumbnailUrl: thumbnail.trim(),
        dispatch: isSeries
          ? { type: 'manual', season_number: season, file_indices: fileIndices.trim(), ...advanced }
          : { type: 'lote', lote: 'A', file_indices: fileIndices.trim(), ...advanced },
      });

      setResult(res);
    } catch (err: any) {
      setError(err.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setResult(null);
    setTitle(''); setDescription(''); setYear(''); setUrl(''); setFileIndices('');
    setThumbnail(''); setThumbOk(false); setContentId(''); setSeason('1');
    setAdvOpen(false);
  }

  if (showTerms) {
    return (
      <UploadTermsModal
        onAccept={() => {
          localStorage.setItem(TERMS_KEY, 'true');
          setTermsAccepted(true);
          setShowTerms(false);
          setHelperModal('rules'); // primeira vez: mostra a fila rules -> guide já a seguir, não só nas próximas visitas
        }}
        onClose={() => window.history.back()}
      />
    );
  }

  if (!termsAccepted) return null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {helperModal === 'rules' && <UploadRulesModal onDismiss={() => setHelperModal('guide')} />}
      {helperModal === 'guide' && <UploadGuideModal onDismiss={() => setHelperModal(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('upload.formTitle')}</h1>
          <p className="page-subtitle">{t('upload.formSubtitle')}</p>
        </div>
      </div>

      {/* FIX (pedido explícito): botão bem visível para o Workspace, com o
          texto pedido por cima. Abre numa aba nova — o Workspace é um
          produto à parte (workspace.pixgo.qzz.io), sair da página de
          upload a meio do preenchimento seria perder o formulário. */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 600 }}>
            {t('upload.workspaceLabel')}
          </div>
          <a
            href={WORKSPACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-flex' }}
          >
            <OpenInNewIcon style={{ fontSize: 16 }} />
            {t('upload.workspaceButton')}
          </a>
        </div>
      </div>

      {result ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          {result.status === 'blocked' && (
            <>
              <BlockIcon style={{ fontSize: 40, color: 'var(--color-primary)', marginBottom: 10 }} />
              <h3 style={{ marginBottom: 8 }}>{t('upload.statusBlocked')}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                {t('upload.statusBlockedDesc')} <a href={`mailto:${t('contact.supportEmail')}`} style={{ color: 'var(--color-primary)' }}>{t('contact.supportEmail')}</a>.
              </p>
            </>
          )}
          {result.status === 'pending' && (
            <>
              <HourglassEmptyIcon style={{ fontSize: 40, color: 'var(--color-secondary)', marginBottom: 10 }} />
              <h3 style={{ marginBottom: 8 }}>{t('upload.statusPending')}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>{t('upload.statusPendingDesc')}</p>
            </>
          )}
          {result.status === 'approved' && (
            <>
              <CheckCircleIcon style={{ fontSize: 40, color: 'var(--color-secondary)', marginBottom: 10 }} />
              <h3 style={{ marginBottom: 8 }}>{t('upload.statusApproved')}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>{t('upload.statusApprovedDesc')}</p>
            </>
          )}
          {result.status === 'rejected' && (
            <>
              <BlockIcon style={{ fontSize: 40, color: 'var(--color-primary)', marginBottom: 10 }} />
              <h3 style={{ marginBottom: 8 }}>{t('upload.statusRejected')}</h3>
            </>
          )}
          {result.status !== 'pending' && (
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={resetForm}>
              {t('upload.formTitle')}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label className="form-label">{t('upload.fieldUrl')}</label>
              <input className="form-input" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://..." />
            </div>

            <div className="divider" style={{ margin: '2px 0' }} />

            <div>
              <label className="form-label">{t('upload.fieldTitle')}</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div className="form-grid form-grid-3">
              <div>
                <label className="form-label">{t('upload.fieldType')}</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                  {TYPE_OPTIONS.map(tp => (
                    <option key={tp} value={tp}>{t(`catalog.${tp}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">{t('upload.fieldYear')}</label>
                <input className="form-input" type="number" value={year} onChange={e => setYear(e.target.value)} placeholder={String(new Date().getFullYear())} />
              </div>
              <div>
                <label className="form-label">{t('upload.fieldLang')}</label>
                <input className="form-input" value={lang} onChange={e => setLang(e.target.value)} maxLength={5} placeholder="pt" />
              </div>
            </div>

            {isSeries && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label className="form-label">{t('upload.fieldContentId')}</label>
                  <input className="form-input" value={contentId} onChange={e => setContentId(e.target.value)} required={isSeries} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('upload.fieldSeason')}</label>
                  <input className="form-input" type="number" min={1} value={season} onChange={e => setSeason(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t('upload.fieldThumbnail')}</label>
                <input
                  className="form-input"
                  value={thumbnail}
                  onChange={e => { setThumbnail(e.target.value); setThumbOk(false); }}
                  placeholder="https://..."
                />
              </div>
              {thumbnail.startsWith('http') && (
                <div style={{ flexShrink: 0, width: 96, height: 54, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', marginTop: 22, display: thumbOk ? 'block' : 'none' }}>
                  <img
                    src={thumbnail}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onLoad={() => setThumbOk(true)}
                    onError={() => setThumbOk(false)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="form-label">{t('upload.fieldDescription')}</label>
              <textarea className="form-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            {/* ── PixGo Creative — escolha do criador, não é deteção automática ── */}
            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--color-border, rgba(255,255,255,.08))',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={goCreative}
                onChange={e => setGoCreative(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>
                  {t('upload.goCreativeLabel', 'Marcar como Go Creative')}
                </span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {t('upload.goCreativeHint', 'Este conteúdo continua a passar pela verificação de direitos autorais normalmente.')}
                </span>
              </span>
            </label>

            {/* ── Opções avançadas — igual ao ingest.html, escondidas por defeito ── */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', padding: '4px 0' }}
              onClick={() => setAdvOpen(o => !o)}
            >
              <ExpandMoreIcon style={{ fontSize: 18, transform: advOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              {t('upload.advancedOptions')}
            </button>

            {advOpen && (
              <div className="form-grid">
                {!isSeries && (
                  <div>
                    <label className="form-label">{t('upload.fieldContentId')}</label>
                    <input className="form-input" value={contentId} onChange={e => setContentId(e.target.value)} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('upload.fieldContentIdHint')}</p>
                  </div>
                )}
                <div>
                  <label className="form-label">{t('upload.fieldFileIndices')}</label>
                  <input className="form-input" value={fileIndices} onChange={e => setFileIndices(e.target.value)} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('upload.fieldFileIndicesHint')}</p>
                </div>
              </div>
            )}

            {error && <p style={{ color: 'var(--color-primary)', fontSize: '0.82rem' }}>{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
              {submitting ? t('upload.submitting') : t('upload.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
