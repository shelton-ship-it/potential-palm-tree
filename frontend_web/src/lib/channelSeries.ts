// src/lib/channelSeries.ts
// ─────────────────────────────────────────────────────────────────────────────
// "Mini séries" = vídeos de um canal do YouTube registados como type `series`
// SEM temporada/episódio (conteúdo singular, como nas Animações) e marcados com
// o género CHANNEL_SERIES_GENRE — o marcador viaja no campo `genres` que o
// backend JÁ grava e JÁ devolve em qualquer listagem (GET /api/catalog*), por
// isso não precisa de nenhuma alteração no backend nem de env nova.
//
// A constante tem de ser IGUAL à usada em process-super-leve-dlp.yml
// (CHANNEL_SERIES_GENRE) — é o único ponto de contacto entre os dois lados.
//
// Séries "clássicas" (com temporadas/episódios, registadas via playlist ou
// torrent) nunca levam este género, logo nunca são apanhadas aqui e continuam
// com cards verticais.
// ─────────────────────────────────────────────────────────────────────────────
export const CHANNEL_SERIES_GENRE = 'miniserie';

export function isChannelSeries(item: any): boolean {
  if (!item || item.type !== 'series') return false;
  const genres = item.genres ?? item.meta?.genres;
  return Array.isArray(genres) && genres.includes(CHANNEL_SERIES_GENRE);
}
