// src/components/copyright/StatusBadge.tsx
// Estado de uma notificação. Só existem três: pendente, recusado e removido.
'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportStatus } from '@/lib/copyright';

const CLASS: Record<ReportStatus, string> = {
  pending: 'badge badge-amber',
  rejected: 'badge badge-red',
  removed: 'badge badge-green',
};

export default function StatusBadge({ status }: { status?: ReportStatus }) {
  const { t } = useTranslation();
  const s: ReportStatus = status && CLASS[status] ? status : 'pending';
  return <span className={CLASS[s]}>{t(`copyright.status.${s}`)}</span>;
}
