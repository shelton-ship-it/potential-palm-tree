'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import i18n from '@/i18n';

// app/main/legal/page.tsx — Aviso Legal, Termos de Envio de Conteúdo,
// Termos de Serviço, Privacidade, Cookies, Segurança, Contacto,
// Direitos de Autor, Notificação e Remoção, e Contra-Notificação,
// agrupados numa única página com abas (mesmo padrão já usado em
// account/page.tsx). Conteúdo integral sincronizado com o documento
// legal de referência da PixGo.
//
// FIX (texto legal preso ao bundle da app): até aqui, todo o texto de
// legal.* vinha só do ficheiro de idioma embutido no build — quem tivesse
// a app instalada fora da loja (sideload, build antiga) nunca recebia uma
// atualização deste texto, mesmo que fosse algo tão importante como
// identificar a entidade responsável ou trocar o contacto do Agente DMCA.
// Agora, ao entrar nesta página, vamos buscar a versão mais recente a
// GET /api/legal/:lang (routes/legal.js do pixel_service_v1) e fundimo-la
// no i18next por cima do bundle local (addResourceBundle, mesmo mecanismo
// já usado em i18n/index.ts para troca de idioma). O bundle local
// continua a existir só como fallback: se o pedido falhar (sem rede, API
// em baixo), a página mostra o texto embutido em vez de ficar vazia — mas
// a partir de agora a fonte de verdade é o backend, actualizável sem
// passar por nenhuma loja de apps.
function useLegalContent(lang: string) {
  const [, setTick] = useState(0);
  const [meta, setMeta] = useState<{ version?: number; updatedAt?: string; fromApi: boolean }>({ fromApi: false });
  // Contagem real de secções por prefixo, lida do conteúdo devolvido pela
  // API (conta quantas chaves "${prefix}${n}t" existem). Assim, adicionar
  // uma cláusula nova a uma categoria já existente (ex: tos33) só precisa
  // de editar o ficheiro no backend — não abre um "buraco" na numeração
  // nem precisa de tocar no array TABS aqui no frontend.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (requestedFor.current === lang) return;
    requestedFor.current = lang;
    let cancelled = false;

    fetch(`${API_BASE}/api/legal/${lang}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((data: { legal: Record<string, string>; version?: number; updatedAt?: string }) => {
        if (cancelled || !data?.legal) return;
        i18n.addResourceBundle(lang, 'translation', { legal: data.legal }, true, true);
        const derivedCounts: Record<string, number> = {};
        for (const key of Object.keys(data.legal)) {
          const m = key.match(/^([a-z]+?)(\d+)t$/);
          if (m) {
            const [, prefix, n] = m;
            derivedCounts[prefix] = Math.max(derivedCounts[prefix] || 0, parseInt(n, 10));
          }
        }
        setCounts(derivedCounts);
        setMeta({ version: data.version, updatedAt: data.updatedAt, fromApi: true });
        setTick(t => t + 1); // força re-render dos textos já montados
      })
      .catch(err => {
        // Falha silenciosa de propósito: mantém-se o texto do bundle local
        // (fallback), que já está a ser mostrado por t() normalmente.
        console.warn('[legal] não foi possível obter texto atualizado da API, a usar fallback embutido:', err.message);
      });

    return () => { cancelled = true; };
  }, [lang]);

  return { ...meta, counts };
}


const TABS = [
  { key: 'notice',  prefix: 'notice',  count: 7,  labelKey: 'legal.tabNotice',  titleKey: 'legal.noticeT' },
  { key: 'upload',  prefix: 'upload',  count: 12, labelKey: 'legal.tabUpload',  titleKey: 'legal.uploadT' },
  { key: 'tos',     prefix: 'tos',     count: 32, labelKey: 'legal.tabTos',     titleKey: 'legal.tosT' },
  { key: 'privacy', prefix: 'priv',    count: 19, labelKey: 'legal.tabPrivacy', titleKey: 'legal.privacyT' },
  { key: 'cookies', prefix: 'cookies', count: 17, labelKey: 'legal.tabCookies', titleKey: 'legal.cookiesT' },
  { key: 'security',prefix: 'sec',     count: 16, labelKey: 'legal.tabSecurity',titleKey: 'legal.securityT' },
  { key: 'contact', prefix: 'contact', count: 6,  labelKey: 'legal.tabContact', titleKey: 'legal.contactT' },
  { key: 'ipr',     prefix: 'ipr',     count: 22, labelKey: 'legal.tabIpr',     titleKey: 'legal.iprT' },
  { key: 'dmca',    prefix: 'dmca',    count: 28, labelKey: 'legal.tabDmca',    titleKey: 'legal.dmcaT' },
  { key: 'counter', prefix: 'counter', count: 26, labelKey: 'legal.tabCounter', titleKey: 'legal.counterT' },
] as const;

type TabKey = typeof TABS[number]['key'];

// Deteta endereços de e-mail dentro do texto e destaca-os, sem
// depender de qualquer parser de markdown — o corpo dos textos legais
// é texto simples com quebras de linha (whiteSpace: 'pre-line').
const EMAIL_SPLIT_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
// Regex separada (sem flag "g") para o teste — reutilizar uma regex global
// em .test() dentro de um map() manteria o lastIndex entre chamadas e
// produziria falsos negativos intermitentes.
const EMAIL_TEST_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function BodyText({ text }: { text: string }) {
  const parts = text.split(EMAIL_SPLIT_RE);
  return (
    <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
      {parts.map((part, i) =>
        EMAIL_TEST_RE.test(part) ? (
          <a
            key={i}
            href={`mailto:${part}`}
            style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </p>
  );
}

function Section({ titleKey, bodyKey, t }: { titleKey: string; bodyKey: string; t: (k: string) => string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-title)', marginBottom: 7 }}>
        {t(titleKey)}
      </h3>
      <BodyText text={t(bodyKey)} />
    </div>
  );
}

export default function LegalPage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const [tab, setTab] = useState<TabKey>('tos');
  const active = TABS.find(tb => tb.key === tab)!;
  const legalMeta = useLegalContent(i18nInstance.language);

  // Abre diretamente a aba indicada em ?tab= (links do rodapé das páginas de
  // direitos autorais e do aviso do Creative ID). Reage também à navegação
  // entre abas feita por esses links.
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get('tab');
  useEffect(() => {
    if (requestedTab && TABS.some(tb => tb.key === requestedTab)) setTab(requestedTab as TabKey);
  }, [requestedTab]);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <h1 className="page-title">{t('legal.title')}</h1>
      </div>

      <div className="tabs">
        {TABS.map(tb => (
          <button key={tb.key} className={`tab ${tab === tb.key ? 'active' : ''}`} onClick={() => setTab(tb.key)}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {(tab === 'notice' || tab === 'ipr' || tab === 'dmca') && (
        <div className="cr-banner" style={{ marginTop: 16, marginBottom: 0 }}>
          <div>
            <div className="cr-banner-title">{t('copyright.legalBannerTitle')}</div>
            <div className="cr-banner-text">{t('copyright.legalBannerBody')}</div>
          </div>
          <Link href="/copyright" className="btn btn-primary btn-sm">{t('copyright.legalBannerButton')}</Link>
        </div>
      )}

      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, marginBottom: 18 }}>
          {t(active.titleKey)}
        </h2>
        {Array.from({ length: legalMeta.counts[active.prefix] || active.count }, (_, i) => i + 1).map(n => (
          <Section
            key={`${active.prefix}${n}`}
            titleKey={`legal.${active.prefix}${n}t`}
            bodyKey={`legal.${active.prefix}${n}`}
            t={t}
          />
        ))}
        {/* Prova de qual versão do texto estava ativa nesta sessão — útil
            em caso de disputa sobre o que o utilizador viu/aceitou.
            Só aparece quando o texto vem confirmado do backend, nunca
            quando se está a usar o fallback embutido (não sabemos a
            versão desse, seria enganoso datar). */}
        {legalMeta.fromApi && legalMeta.updatedAt && (
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 18, opacity: 0.7 }}>
            {t('legal.lastUpdated', 'Última atualização')}: {legalMeta.updatedAt}
          </p>
        )}
      </div>
    </div>
  );
}
