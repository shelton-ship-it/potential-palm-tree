// src/components/copyright/TimeField.tsx
// Editor de tempo direto (HH:MM:SS). O valor é sempre em segundos.
// Teclado: dígitos entram pela direita (como num relógio), setas para cima e
// para baixo ajustam o campo, seta lateral e ":" mudam de campo.
'use client';
import React, { useRef } from 'react';

interface Props {
  value: number;
  onChange: (seconds: number) => void;
  groupLabel: string;
  labels: { h: string; m: string; s: string };
}

const MAX = [23, 59, 59];

function split(total: number): number[] {
  const t = Math.max(0, Math.min(86399, Math.floor(total) || 0));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60];
}

function join(parts: number[]): number {
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export default function TimeField({ value, onChange, groupLabel, labels }: Props) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const parts = split(value);
  const names = [labels.h, labels.m, labels.s];

  const setPart = (idx: number, next: number) => {
    const copy = [...parts];
    copy[idx] = Math.max(0, Math.min(MAX[idx], next));
    onChange(join(copy));
  };

  const focusAt = (idx: number) => {
    const el = refs[idx]?.current;
    if (el) { el.focus(); el.select(); }
  };

  const onInput = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-2);
    setPart(idx, digits ? parseInt(digits, 10) : 0);
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? 10 : 1;
    // A navegação direcional global (lib/tv-navigation.ts, listener no document)
    // moveria o foco para fora do campo. No app router o React está enraizado no
    // próprio document, por isso é preciso stopImmediatePropagation (o listener
    // do React foi registrado antes). As setas que o editor consome ficam aqui;
    // nas extremidades seguem para a navegação global.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      const dir = e.key === 'ArrowUp' ? 1 : -1;
      const size = MAX[idx] + 1;
      setPart(idx, (parts[idx] + dir * step + size * 10) % size);
    } else if (e.key === ':' || e.key === 'ArrowRight') {
      if (idx < 2) { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); focusAt(idx + 1); }
    } else if (e.key === 'ArrowLeft') {
      if (idx > 0) { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); focusAt(idx - 1); }
    }
  };

  return (
    <div className="cr-time" role="group" aria-label={groupLabel}>
      {parts.map((p, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="cr-time-sep" aria-hidden="true">:</span>}
          <input
            ref={refs[idx]}
            className="cr-time-seg"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={String(p).padStart(2, '0')}
            aria-label={`${groupLabel}, ${names[idx]}`}
            onFocus={e => e.currentTarget.select()}
            onChange={e => onInput(idx, e.target.value)}
            onKeyDown={e => onKeyDown(idx, e)}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
