'use client';
import React from 'react';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { useLegalLang, LegalLang } from '../../lib/legalLang';

type NotifType = 'tool' | 'update' | 'notice';

interface NotifItem { type: NotifType; date: string; title: string; body: string; }
interface NotifContent { title: string; subtitle: string; empty: string; items: NotifItem[]; }

// Lista de anúncios da plataforma — mantida diretamente aqui pela equipa.
// Cada novo lançamento de ferramenta ou funcionalidade relevante deve ser
// acrescentado ao topo da lista, num item por idioma.
const CONTENT: Record<LegalLang, NotifContent> = {
  pt: {
    title: 'Notificações',
    subtitle: 'Novidades sobre novas ferramentas, funcionalidades e atualizações da plataforma.',
    empty: 'Sem novas notificações de momento. Volte mais tarde.',
    items: [],
  },
  en: {
    title: 'Notifications',
    subtitle: 'News about new tools, features, and platform updates.',
    empty: 'No new notifications right now. Check back later.',
    items: [],
  },
  es: {
    title: 'Notificaciones',
    subtitle: 'Novedades sobre nuevas herramientas, funciones y actualizaciones de la plataforma.',
    empty: 'No hay notificaciones nuevas por el momento. Vuelva más tarde.',
    items: [],
  },
};

const ICON_BY_TYPE: Record<NotifType, React.ElementType> = {
  tool: NewReleasesOutlinedIcon,
  update: BuildOutlinedIcon,
  notice: CampaignOutlinedIcon,
};

const COLOR_BY_TYPE: Record<NotifType, string> = {
  tool: '#059669',
  update: '#2563eb',
  notice: '#e50914',
};

export default function NotificationsPage() {
  const lang = useLegalLang();
  const content = CONTENT[lang];

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <div className="page-kicker">{{ pt: 'Central de avisos', en: 'Update center', es: 'Centro de avisos' }[lang]}</div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationsNoneIcon style={{ fontSize: 26, color: 'var(--color-primary)' }} />
            {content.title}
          </h1>
          <p className="page-subtitle">{content.subtitle}</p>
        </div>
      </div>

      {content.items.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{content.empty}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {content.items.map((item, i) => {
            const Icon = ICON_BY_TYPE[item.type];
            const color = COLOR_BY_TYPE[item.type];
            return (
              <div key={i} className="card card-interactive" style={{ padding: 16, paddingLeft: 13, display: 'flex', gap: 13, borderLeft: `3px solid ${color}` }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1f`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ fontSize: 19 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '-0.01em' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.date}</div>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0 }}>{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
