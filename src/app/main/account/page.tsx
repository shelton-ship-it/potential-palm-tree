'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { authApi, profilesApi, contactApi } from '@/lib/api';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import toast from 'react-hot-toast';
import PlansNoticeModal from '@/components/modals/PlansNoticeModal';

const TABS = ['profile', 'security', 'subscription', 'profiles', 'help'] as const;

export default function AccountPage() {
  const router  = useRouter();
  const { t }   = useTranslation();
  const user    = useAuthStore(s => s.user);
  const plan    = useAuthStore(s => s.plan);
  const profiles = useAuthStore(s => s.profiles);
  const fetchMe = useAuthStore(s => s.fetchMe);

  const [tab,    setTab]    = useState<typeof TABS[number]>('profile');
  // Aviso jurídico das assinaturas: abre sempre que se clica na aba "Assinatura".
  const [showPlansNotice, setShowPlansNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pf, setPf]         = useState({ name: '', email: '' });
  const [pw, setPw]         = useState({ current_password: '', new_password: '' });
  const [profileForm, setProfileForm]     = useState<{ name: string; is_kid: boolean } | null>(null);
  const [reportTitle, setReportTitle]     = useState('');
  const [reportReason, setReportReason]   = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [supportEmail, setSupportEmail]   = useState('');
  const [supportMsg, setSupportMsg]       = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user) setPf({ name: user.name || '', email: user.email || '' });
  }, [user?.id]);

  const initials = (user?.name || user?.username || '?')
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const isPremium = plan && plan.id !== 'free';

  // PUT /api/auth/me - usando authApi.update
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const body: any = {};
      if (pf.name.trim())  body.name  = pf.name.trim();
      // Valida email antes de enviar
      if (pf.email.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pf.email.trim())) {
          toast.error('E-mail inválido.'); setSaving(false); return;
        }
        body.email = pf.email.trim();
      }
      await authApi.update(body);
      await fetchMe();
      toast.success(t('account.saved'));
    } catch (err: any) {
      toast.error(err.data?.details?.[0]?.message || err.data?.message || t('common.error'));
    } finally { setSaving(false); }
  };

  // POST /api/auth/change-password - usando authApi.changePassword
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.new_password.length < 8) { toast.error(t('auth.minPassword')); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      toast.success(t('account.passwordChanged'));
      setPw({ current_password: '', new_password: '' });
      // Backend invalida sessões — forçar re-login após 1.5s
      setTimeout(async () => {
        await useAuthStore.getState().logout();
        router.push('/auth/login');
      }, 1500);
    } catch (err: any) {
      const msg = err.data?.message || '';
      toast.error(msg.includes('incorrect') || msg.includes('incorreta') ? 'Senha atual incorreta.' : msg || t('common.error'));
    } finally { setSaving(false); }
  };

  // POST /api/auth/profiles ou PUT /api/auth/profiles/:id — usando profilesApi
  const saveProfileEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm || !profileForm.name.trim()) return;
    setProfileSaving(true);
    try {
      if (editingProfileId) {
        await profilesApi.update(editingProfileId, { name: profileForm.name.trim(), is_kid: profileForm.is_kid });
      } else {
        await profilesApi.create({ name: profileForm.name.trim(), is_kid: profileForm.is_kid });
      }
      await fetchMe();
      setProfileForm(null);
      setEditingProfileId(null);
      toast.success(t('account.saved'));
    } catch (err: any) {
      // Backend devolve 403 com mensagem "Limite máximo de N perfil(is) atingido..."
      toast.error(err.data?.message || t('common.error'));
    } finally { setProfileSaving(false); }
  };

  // DELETE /api/auth/profiles/:id - usando profilesApi
  const deleteProfileEntry = async (id: string) => {
    if (!window.confirm(t('account.confirmDeleteProfile'))) return;
    try {
      await profilesApi.delete(id);
      await fetchMe();
      toast.success(t('account.saved'));
    } catch (err: any) {
      toast.error(err.data?.message || t('common.error'));
    }
  };


  return (
    <div style={{ maxWidth: 680 }}>
      {showPlansNotice && <PlansNoticeModal onDismiss={() => setShowPlansNotice(false)} />}
      <div className="page-header">
        <h1 className="page-title">{t('account.title')}</h1>
        <p className="page-subtitle">{t('account.subtitle')}</p>
      </div>

      <div className="tabs">
        {TABS.map(tb => (
          <button key={tb} className={`tab ${tab === tb ? 'active' : ''}`} onClick={() => { setTab(tb); if (tb === 'subscription') setShowPlansNotice(true); }}>
            {{ profile: t('account.profile'), security: t('account.security'), subscription: t('account.subscription'), profiles: t('account.profiles'), help: t('contact.support') }[tb]}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card fade-in">
          <div className="card-header"><span className="card-title">{t('account.profile')}</span></div>
          <form className="card-body" onSubmit={saveProfile}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 13, background: 'var(--color-bg-darker)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-primary),#8c3bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.05rem', color: '#fff', flexShrink: 0 }}>{initials}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{user?.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>@{user?.username}</div>
                {user?.email && <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{user.email}</div>}
                <span className={`badge ${isPremium ? 'badge-red' : 'badge-gray'}`} style={{ marginTop: 5, display: 'inline-flex', textTransform: 'capitalize' }}>{plan?.id || 'free'}</span>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('auth.fullName')}</label>
                <input className="form-input" type="text" autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} value={pf.name} onChange={e => setPf(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.username')}</label>
                <input className="form-input" value={user?.username || ''} disabled style={{ opacity: 0.5 }} />
              </div>
              <div className="form-group full">
                <label className="form-label">{t('auth.email')} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({t('auth.emailOptional')})</span></label>
                <input className="form-input" type="text" autoComplete="email" autoCapitalize="none" inputMode="email" spellCheck={false} value={pf.email} onChange={e => setPf(f => ({ ...f, email: e.target.value }))} placeholder="nome@exemplo.com" />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
              {saving ? <span className="spinner spinner-sm" /> : t('account.saveName')}
            </button>
          </form>
        </div>
      )}

      {tab === 'security' && (
        <div className="card fade-in">
          <div className="card-header"><span className="card-title">{t('account.changePassword')}</span></div>
          <form className="card-body" onSubmit={savePw} noValidate>
            <div className="form-group" style={{ marginBottom: 13 }}>
              <label className="form-label">{t('account.currentPassword')}</label>
              <input className="form-input" type="password" autoComplete="current-password" value={pw.current_password} onChange={e => setPw(f => ({ ...f, current_password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('account.newPassword')}</label>
              <input className="form-input" type="password" autoComplete="new-password" value={pw.new_password} onChange={e => setPw(f => ({ ...f, new_password: e.target.value }))} />
              <span className="form-helper">{t('auth.minPassword')}</span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving || !pw.current_password || pw.new_password.length < 8} style={{ marginTop: 16 }}>
              {saving ? <span className="spinner spinner-sm" /> : t('account.changePassword')}
            </button>
          </form>
        </div>
      )}

      {tab === 'subscription' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">{t('account.currentPlan')}</span></div>
            <div className="card-body">
              {/* FIX (pedido explícito — otimização mobile das páginas de
                  conta): esta linha juntava texto (nome do plano, validade,
                  perfis usados) e um botão/badge lado a lado sem
                  flexWrap nem minWidth no bloco de texto — em ecrãs
                  estreitos, texto mais longo (ex.: com "Válido até" e
                  contagem de perfis) podia empurrar a largura total para
                  além do ecrã em vez de quebrar linha. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: 13, background: isPremium ? 'rgba(229,9,20,0.06)' : 'var(--color-bg-darker)', border: `1px solid ${isPremium ? 'rgba(229,9,20,0.25)' : 'var(--color-border)'}`, borderRadius: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', textTransform: 'capitalize', marginBottom: 3 }}>{plan?.id || 'free'} Plan</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{isPremium ? t('account.premiumDesc') : t('account.freeDesc')}</div>
                  {isPremium && plan?.expires_at && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                      Válido até {new Date(plan.expires_at).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {typeof plan?.max_profiles === 'number' && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                      {(profiles?.length ?? 0)} de {plan.max_profiles} perfis usados
                    </div>
                  )}
                </div>
                {isPremium
                  ? <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircleOutlineIcon style={{ fontSize: 14 }} />{t('account.active')}</span>
                  : <button className="btn btn-primary btn-sm" onClick={() => router.push('/main/plans')}>{t('account.upgrade')}</button>}
              </div>
            </div>
          </div>
          {!isPremium && (
            <div className="alert alert-info">
              <ErrorOutlineIcon style={{ fontSize: 17 }} />
              <div>{t('account.upgradePromo')}<br />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => router.push('/main/plans')}>{t('account.viewPlans')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'profiles' && (
        <div className="card fade-in">
          <div className="card-header"><span className="card-title">{t('account.profiles')}</span></div>
          <div className="card-body">
            {typeof plan?.max_profiles === 'number' && (
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                {(profiles?.length ?? 0)} de {plan.max_profiles} perfis usados
                {(profiles?.length ?? 0) >= plan.max_profiles && ` — ${t('account.profileLimitReached')}`}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {(profiles || []).map((p: any) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, background: 'var(--color-bg-darker)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-primary),#8c3bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {(p.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.name}
                      {p.is_kid && <ChildCareIcon style={{ fontSize: 15, color: 'var(--color-text-muted)' }} />}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={t('account.editProfile')}
                    onClick={() => { setEditingProfileId(p.id); setProfileForm({ name: p.name, is_kid: !!p.is_kid }); }}
                  >
                    <EditIcon style={{ fontSize: 16 }} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={t('account.deleteProfile')}
                    disabled={(profiles?.length ?? 0) <= 1}
                    title={(profiles?.length ?? 0) <= 1 ? t('account.lastProfileHint') : ''}
                    onClick={() => deleteProfileEntry(p.id)}
                  >
                    <DeleteOutlineIcon style={{ fontSize: 16 }} />
                  </button>
                </div>
              ))}
            </div>

            {profileForm ? (
              <form className="form-grid" onSubmit={saveProfileEntry} style={{ padding: 13, background: 'var(--color-bg-darker)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div className="form-group full">
                  <label className="form-label">{t('auth.fullName')}</label>
                  <input
                    className="form-input" type="text" autoFocus
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => f && ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox" id="is_kid"
                    checked={profileForm.is_kid}
                    onChange={e => setProfileForm(f => f && ({ ...f, is_kid: e.target.checked }))}
                  />
                  <label htmlFor="is_kid" className="form-label" style={{ marginBottom: 0 }}>{t('account.kidProfile')}</label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-primary" type="submit" disabled={profileSaving || !profileForm.name.trim()}>
                    {profileSaving ? <span className="spinner spinner-sm" /> : t('account.saveName')}
                  </button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setProfileForm(null); setEditingProfileId(null); }}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                disabled={typeof plan?.max_profiles === 'number' && (profiles?.length ?? 0) >= plan.max_profiles}
                onClick={() => { setEditingProfileId(null); setProfileForm({ name: '', is_kid: false }); }}
              >
                <AddIcon style={{ fontSize: 16 }} /> {t('account.addProfile')}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'help' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 20 }}>
          {/* Denúncia de conteúdo abusivo/ilícito */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{t('contact.report')}</h3>
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
              onSubmit={async e => {
                e.preventDefault();
                setReportSending(true);
                try {
                  await contactApi.reportAbuse(reportTitle.trim(), reportReason.trim());
                  toast.success(t('contact.reportSuccess'));
                  setReportTitle(''); setReportReason('');
                } catch {
                  toast.error(t('common.error'));
                } finally {
                  setReportSending(false);
                }
              }}
            >
              <div>
                <label className="form-label">{t('contact.reportTitleLabel')}</label>
                <input className="form-input" value={reportTitle} onChange={e => setReportTitle(e.target.value)} required maxLength={300} />
              </div>
              <div>
                <label className="form-label">{t('contact.reportReasonLabel')}</label>
                <textarea className="form-input" rows={3} value={reportReason} onChange={e => setReportReason(e.target.value)} required maxLength={2000} />
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={reportSending} style={{ alignSelf: 'flex-start' }}>
                {t('contact.reportSubmit')}
              </button>
            </form>
          </div>

          {/* Direitos autorais: botão Denunciar como primeira opção, e-mail como alternativa */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{t('contact.copyright')}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>{t('contact.copyrightDesc')}</p>
            <Link href="/copyright" className="btn btn-primary btn-sm">{t('contact.reportCopyrightButton')}</Link>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 12 }}>
              {t('contact.orEmail')}{' '}
              <a href={`mailto:${t('contact.copyrightEmail')}`} style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 700 }}>
                {t('contact.copyrightEmail')}
              </a>
            </p>
          </div>

          {/* Suporte — formulário + e-mail */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{t('contact.support')}</h3>
            <a href={`mailto:${t('contact.supportEmail')}`} style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 12 }}>
              {t('contact.supportEmail')}
            </a>
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              onSubmit={async e => {
                e.preventDefault();
                setSupportSending(true);
                try {
                  await contactApi.support(supportEmail.trim(), supportMsg.trim());
                  toast.success(t('contact.supportSuccess'));
                  setSupportEmail(''); setSupportMsg('');
                } catch {
                  toast.error(t('common.error'));
                } finally {
                  setSupportSending(false);
                }
              }}
            >
              <div>
                <label className="form-label">{t('contact.supportEmailLabel')}</label>
                <input className="form-input" type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} required maxLength={300} />
              </div>
              <div>
                <label className="form-label">{t('contact.supportMessageLabel')}</label>
                <textarea className="form-input" rows={3} value={supportMsg} onChange={e => setSupportMsg(e.target.value)} required maxLength={4000} />
              </div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={supportSending} style={{ alignSelf: 'flex-start' }}>
                {t('contact.supportSubmit')}
              </button>
            </form>
          </div>

          {/* Sobre */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>{t('about.title')}</h3>
            {(['p1', 'p2', 'p3', 'p4'] as const).map(p => (
              <div key={p} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: 4 }}>{t(`about.${p}t`)}</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{t(`about.${p}`)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}