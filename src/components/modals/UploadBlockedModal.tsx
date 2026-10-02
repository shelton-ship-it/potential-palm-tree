'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';

import { shouldAutoFocus } from '@/lib/tv-navigation';

interface Props { onClose: () => void; }

export default function UploadBlockedModal({ onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div role="dialog" aria-modal="true" data-modal="true" style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'var(--color-card-bg)', border:'1px solid var(--color-border)', borderRadius:14, width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.8)', animation:'scaleIn 0.18s ease' }}>
        <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid var(--color-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'0.95rem', fontWeight:800, margin:0 }}>
            {t('disclaimer.uploadTitle')}
          </h2>
          <button onClick={onClose} data-modal-close className="icon-btn" style={{ width:32, height:32 }}>
            <CloseIcon style={{ fontSize:18 }} />
          </button>
        </div>

        <div style={{ padding:'16px 20px' }}>
          {/* Regional restriction — first sentence as requested */}
          <p style={{ fontSize:'0.84rem', color:'var(--color-text-muted)', lineHeight:1.7, marginBottom:10 }}>
            Os uploads estão restritos na sua região devido a requisitos de conformidade legal e verificação de direitos autorais.
          </p>
          <p style={{ fontSize:'0.84rem', color:'var(--color-text-muted)', lineHeight:1.7, marginBottom:10 }}>
            {t('disclaimer.uploadBody2')}
          </p>
          <p style={{ fontSize:'0.84rem', color:'var(--color-text-muted)', lineHeight:1.7 }}>
            {t('disclaimer.uploadBody3')}
          </p>
        </div>

        <div style={{ padding:'0 20px 18px' }}>
          <button onClick={onClose} className="btn btn-primary" autoFocus={shouldAutoFocus()} style={{ width:'100%', justifyContent:'center' }}>
            {t('disclaimer.uploadClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
