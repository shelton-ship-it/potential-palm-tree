'use client';
import { create } from 'zustand';

export interface ActiveDownload {
  contentId: string;
  title:     string;
  poster:    string;
  progress:  number;   // 0-100
  status:    'downloading' | 'error';
  error?:    string;
}

interface DownloadsState {
  active: Record<string, ActiveDownload>;
  start:       (contentId: string, title: string, poster: string) => void;
  setProgress: (contentId: string, progress: number) => void;
  fail:        (contentId: string, error: string) => void;
  finish:      (contentId: string) => void;
}

// Store em memória (não persiste) — só acompanha downloads EM CURSO.
// Quando um download termina com sucesso, sai daqui e passa a viver no
// IndexedDB (lib/downloads.ts / saveDownloadMeta), que é o que a página de
// Downloads lista como "concluído".
export const useDownloadsStore = create<DownloadsState>((set) => ({
  active: {},

  start: (contentId, title, poster) => set(s => ({
    active: { ...s.active, [contentId]: { contentId, title, poster, progress: 0, status: 'downloading' } },
  })),

  setProgress: (contentId, progress) => set(s => {
    const cur = s.active[contentId];
    if (!cur) return s;
    return { active: { ...s.active, [contentId]: { ...cur, progress } } };
  }),

  fail: (contentId, error) => set(s => {
    const cur = s.active[contentId];
    if (!cur) return s;
    return { active: { ...s.active, [contentId]: { ...cur, status: 'error', error } } };
  }),

  finish: (contentId) => set(s => {
    const { [contentId]: _removed, ...rest } = s.active;
    return { active: rest };
  }),
}));
