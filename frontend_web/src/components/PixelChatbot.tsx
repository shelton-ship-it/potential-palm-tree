'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/lib/api';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import Focusable from '@/components/ui/Focusable';
import { shouldAutoFocus } from '@/lib/tv-navigation';

// components/PixelChatbot.tsx
//
// "Pixel" — assistente da plataforma, botão flutuante no canto inferior
// direito (visível em todas as páginas de /main via AppShell). Responde
// com base num prompt fechado no Worker (FAQ, regras, planos, básico de
// upload/copyright) — nunca expõe arquitectura interna. Histórico mantido
// só em memória (não persiste entre sessões).
//
// FIX (ago/2026): balão de notificação proactivo — aparece sozinho perto
// do botão pouco depois de carregar a página, avisando que é uma IA de
// suporte (não só quando a pessoa já abre o chat). Mostrado uma única vez
// por dispositivo (localStorage) — não volta a insistir depois de
// dispensado ou depois do chat ser aberto pela primeira vez.

type Message = { role: 'user' | 'assistant'; content: string };

const GREETING_KEY         = 'pixgo_pixel_greeted';
const GREETING_DELAY_MS    = 5000;  // estendido (pedido do user) — era 3000
const GREETING_AUTOHIDE_MS = 16000; // ajustado proporcionalmente ao novo delay

export default function PixelChatbot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (localStorage.getItem(GREETING_KEY) === '1') return;
    const showTimer = setTimeout(() => setShowGreeting(true), GREETING_DELAY_MS);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!showGreeting) return;
    const hideTimer = setTimeout(() => dismissGreeting(), GREETING_AUTOHIDE_MS);
    return () => clearTimeout(hideTimer);
  }, [showGreeting]);

  function dismissGreeting() {
    setShowGreeting(false);
    localStorage.setItem(GREETING_KEY, '1');
  }

  function handleToggle() {
    if (showGreeting) dismissGreeting();
    setOpen(v => !v);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const res = await chatApi.send(text, messages.slice(-6));
      setMessages([...nextMessages, { role: 'assistant', content: res.reply || t('chatbot.error') }]);
    } catch {
      setMessages([...nextMessages, { role: 'assistant', content: t('chatbot.error') }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {showGreeting && !open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 22, zIndex: 9998,
          maxWidth: 260, background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '12px 14px', boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          display: 'flex', gap: 8, alignItems: 'flex-start', animation: 'fade-in 0.25s ease',
        }}>
          <SmartToyOutlinedIcon style={{ color: 'var(--color-primary)', fontSize: 20, flexShrink: 0, marginTop: 1 }} />
          <Focusable style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.5, cursor: 'pointer' }} onClick={handleToggle}>
            {t('chatbot.greeting')}
          </Focusable>
          <button
            onClick={(e) => { e.stopPropagation(); dismissGreeting(); }}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, opacity: 0.6 }}
          >
            <CloseIcon style={{ fontSize: 15, color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      )}

      <button
        onClick={handleToggle}
        aria-label="Pixel"
        style={{
          position: 'fixed', bottom: 22, right: 22, zIndex: 9998,
          width: 54, height: 54, borderRadius: '50%',
          background: 'var(--color-primary)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(229,9,20,0.42)',
        }}
      >
        {open ? <CloseIcon style={{ color: '#fff', fontSize: 24 }} /> : <ChatBubbleOutlineIcon style={{ color: '#fff', fontSize: 24 }} />}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" data-modal="true" style={{
          position: 'fixed', bottom: 88, right: 22, zIndex: 9998,
          width: 340, maxWidth: 'calc(100vw - 32px)', height: 460, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 14,
          display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SmartToyOutlinedIcon style={{ color: 'var(--color-primary)', fontSize: 20 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9rem' }}>{t('chatbot.name')}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{t('chatbot.subtitle')}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              data-modal-close
              aria-label="Fechar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, opacity: 0.6 }}
            >
              <CloseIcon style={{ fontSize: 17 }} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: 30, padding: '0 10px', lineHeight: 1.6 }}>
                {t('chatbot.welcome')}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                color: m.role === 'user' ? '#fff' : 'var(--color-text-light)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: '0.83rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <span className="spinner spinner-sm" />
              </div>
            )}
          </div>

          <form onSubmit={handleSend} style={{ padding: 10, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder={t('chatbot.placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sending}
              autoFocus={shouldAutoFocus()}
              style={{ flex: 1, fontSize: '0.83rem' }}
            />
            <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary" style={{ padding: '0 12px', minWidth: 40 }}>
              <SendIcon style={{ fontSize: 17 }} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
