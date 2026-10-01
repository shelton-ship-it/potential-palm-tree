'use client';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { authApi, plansApi } from '../lib/api';

export default function AccountPage() {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const plan = useAuthStore(s => s.plan);
  const fetchMe = useAuthStore(s => s.fetchMe);

  const [name, setName]   = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await authApi.update({ name, email: email || undefined });
      await fetchMe();
      toast.success(t('account.saved'));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setSavingPw(true);
    try {
      await authApi.changePassword({ current_password: curPw, new_password: newPw });
      setCurPw(''); setNewPw('');
      toast.success(t('account.saved'));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setSavingPw(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!confirm('Cancelar a assinatura? O acesso permanece até ao fim do período já pago.')) return;
    setCancelling(true);
    try {
      await plansApi.cancel();
      await fetchMe();
      toast.success('Assinatura cancelada');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar');
    } finally {
      setCancelling(false);
    }
  };

  const isPremium = plan && plan.id !== 'free' && plan.is_active;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1 className="page-title">{t('account.title')}</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">{t('account.profile')}</div></div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">{t('auth.name')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{t('auth.email')}</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? <span className="spinner spinner-sm" /> : t('account.save')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">{t('account.changePassword')}</div></div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">{t('account.currentPassword')}</label>
            <input className="form-input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{t('account.newPassword')}</label>
            <input className="form-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleChangePassword} disabled={savingPw || !curPw || newPw.length < 8}>
            {savingPw ? <span className="spinner spinner-sm" /> : t('account.save')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{t('plans.title')}</div></div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPremium ? 16 : 0 }}>
            <div>
              <span className={`badge ${isPremium ? 'badge-red' : 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{plan?.id || 'free'}</span>
              {plan?.expires_at && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Renova/expira em {new Date(plan.expires_at).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
            {!isPremium && <a className="btn btn-primary" href="/main/plans">{t('plans.subscribe')}</a>}
          </div>
          {isPremium && (
            <button className="btn btn-secondary" onClick={handleCancelPlan} disabled={cancelling}>
              {cancelling ? <span className="spinner spinner-sm" /> : t('plans.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{t('connectTv.cardTitle', 'Conectar TV')}</div></div>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('connectTv.cardDescription', 'Gere um código para iniciar sessão na Pixgo directamente na sua TV.')}
          </p>
          <a className="btn btn-secondary" href="/main/connect-tv">{t('connectTv.cardAction', 'Conectar TV')}</a>
        </div>
      </div>
    </div>
  );
}
