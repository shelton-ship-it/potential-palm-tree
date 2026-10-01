'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ShareIcon from '@mui/icons-material/Share';
import MovieIcon from '@mui/icons-material/Movie';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Focusable from '@/components/ui/Focusable';

const TYPE_COLORS: Record<string, string> = {
  movie:       '#e50914',
  series:      '#ff6b00',
  anime:       '#ff0080',
  documentary: '#00a8ff',
  dorama:      '#9c27b0',
  channel:     '#1ce783',
};

interface ContentCardProps {
  id: string;
  title: string;
  poster?: string;
  year?: number | string;
  type?: string;
  rating?: number;
  progress?: number;
  inList?: boolean;
  href?: string; // OTIMIZAÇÃO (produção): rota de destino do clique, só para prefetch — ver useEffect abaixo
  // Card horizontal (16:9, ocupa 2 colunas no .content-grid) — usado só pelas
  // "mini séries" de canal do YouTube (ver lib/channelSeries.ts), cujas thumbs
  // são 16:9 e ficariam cortadas no poster vertical 2:3 dos restantes types.
  // Sem esta prop o card é exactamente o de sempre (vertical).
  wide?: boolean;
  onClick?: () => void;
  onAddToList?: () => void;
  onShare?: () => void;
  style?: React.CSSProperties;
}

function fmtRating(r?: number) {
  if (!r || r <= 0) return null;
  return r.toFixed(1);
}

export default function ContentCard({
  id, title, poster, year, type, rating, progress,
  inList, href, wide, onClick, onAddToList, onShare, style,
}: ContentCardProps) {
  const [imgErr,   setImgErr]   = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const typeColor = type ? (TYPE_COLORS[type] ?? '#e50914') : '#e50914';
  const ratingStr = fmtRating(rating);

  // OTIMIZAÇÃO (produção): sem isto, cada clique num card (que só faz
  // router.push, nunca teve nenhum await) obrigava o Next a ir buscar a
  // rota de destino ao servidor SÓ no momento do clique — sem cache
  // nenhuma. router.prefetch faz o Next ir buscar e guardar essa rota em
  // segundo plano assim que o card aparece no ecrã, para o clique real
  // ser instantâneo (mesmo mecanismo que o <Link> usa por baixo).
  useEffect(() => {
    if (href) router.prefetch(href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  return (
    <Focusable
      as="article"
      className={wide ? 'content-card content-card--wide' : 'content-card'}
      onEnterPress={onClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        // Atalhos para as acções secundárias enquanto o card está focado —
        // ver nota acima sobre porque não são alvos de seta independentes.
        if ((e.key === 'a' || e.key === 'A') && onAddToList) { e.preventDefault(); e.stopPropagation(); onAddToList(); }
        if ((e.key === 's' || e.key === 'S') && onShare)     { e.preventDefault(); e.stopPropagation(); onShare(); }
      }}
      style={wide ? { gridColumn: 'span 2', containIntrinsicSize: '240px 170px', ...style } : style}
    >
      {/* Thumbnail */}
      <div className="content-thumb" onClick={onClick} style={wide ? { aspectRatio: '16 / 9' } : undefined}>
        {poster && !imgErr ? (
          <img src={poster} alt={title} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="content-thumb-placeholder" style={wide ? { aspectRatio: '16 / 9' } : undefined}>
            <MovieIcon style={{ fontSize: wide ? 26 : 32, color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center', padding: '0 6px' }}>
              {title}
            </span>
          </div>
        )}

        {/* Color bar top */}
        <div className="content-type-bar" style={{ background: typeColor }} />

        {/* Rating */}
        {ratingStr && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
            borderRadius: 4, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <StarIcon style={{ fontSize: 11, color: '#ffd700' }} />
            <span style={{ fontSize: '0.68rem', color: '#fff', fontWeight: 600 }}>{ratingStr}</span>
          </div>
        )}

        {/* Type badge */}
        {type && (
          <div style={{
            position: 'absolute', bottom: progress ? 12 : 8, left: 8, right: 8,
            background: 'rgba(0,0,0,0.72)', borderRadius: 4,
            padding: '2px 7px', fontSize: '0.62rem',
            fontWeight: 700, color: '#fff',
            maxWidth: 'fit-content', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t(`catalog.${type}`)}
          </div>
        )}

        {/* Overlay de play — só aparece com rato real (:hover em
            globals.css, sob @media (hover:hover) and (pointer:fine)) ou em
            foco de TV (.tv-focused). Sem estado JS: o onMouseEnter emulado
            pelo toque deixava o overlay preso no telemóvel. */}
        <div className="content-thumb-overlay">
          <div className="play-btn-circle">
            <PlayArrowIcon style={{ fontSize: 22, color: '#fff', marginLeft: 2 }} />
          </div>
        </div>

        {/* Progress bar */}
        {progress != null && progress > 0 && (
          <div className="content-progress">
            <div className="content-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="content-info">
        <h3
          className="content-title"
          title={title}
          onClick={onClick}
          style={{ cursor: 'pointer' }}
        >
          {title}
        </h3>

        <div className="content-meta">
          {year && <span>{year}</span>}
          {ratingStr && (
            <span className="content-rating">
              <StarIcon style={{ fontSize: 11 }} />
              {ratingStr}
            </span>
          )}
        </div>

        {/* Actions */}
        {(onAddToList || onShare) && (
          <div className="content-actions">
            {onAddToList && (
              <button
                className={`card-action-btn ${inList ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); onAddToList(); }}
                tabIndex={-1}
                title={(inList ? 'Remover da lista' : 'Adicionar à lista') + ' (A)'}
              >
                {inList
                  ? <CheckIcon style={{ fontSize: 16 }} />
                  : <AddIcon   style={{ fontSize: 16 }} />}
              </button>
            )}
            {onShare && (
              <button
                className="card-action-btn"
                onClick={e => { e.stopPropagation(); onShare(); }}
                tabIndex={-1}
                title="Compartilhar (S)"
              >
                <ShareIcon style={{ fontSize: 15 }} />
              </button>
            )}
          </div>
        )}
      </div>
    </Focusable>
  );
}
