'use client';
import React from 'react';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  note?: string;
  contactEmail?: string;
}

export interface LegalContent {
  title: string;
  subtitle: string;
  updated: string;
  kicker?: string;
  sections: LegalSection[];
}

// Layout partilhado por todas as páginas institucionais e legais
// (Quem somos, Segurança, Termos, Direitos de autor, Cookies, FAQ).
// Mantém tipografia, espaçamento e largura de leitura consistentes
// em todas elas, para não repetir estilo em cada página.
export default function LegalLayout({ content, icon }: { content: LegalContent; icon?: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          {content.kicker && <div className="page-kicker">{content.kicker}</div>}
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon}
            {content.title}
          </h1>
          <p className="page-subtitle">{content.subtitle}</p>
        </div>
      </div>

      <div className="badge badge-gray" style={{ marginBottom: 26, display: 'inline-flex' }}>
        {content.updated}
      </div>

      {content.sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 26 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.02rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10, color: 'var(--color-text-title)' }}>
            {section.heading}
          </h2>
          {section.paragraphs?.map((p, j) => (
            <p key={j} style={{ fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {p}
            </p>
          ))}
          {section.list && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.list.map((item, k) => (
                <li key={k} style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{item}</li>
              ))}
            </ul>
          )}
          {section.note && (
            <div className="alert alert-info" style={{ marginTop: 4 }}>{section.note}</div>
          )}
          {section.contactEmail && (
            <a
              href={`mailto:${section.contactEmail}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 4, padding: '8px 12px', borderRadius: 8, background: 'rgba(229,9,20,0.06)', border: '1px solid rgba(229,9,20,0.15)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)' }}
            >
              {section.contactEmail}
            </a>
          )}
        </div>
      ))}

    </div>
  );
}
