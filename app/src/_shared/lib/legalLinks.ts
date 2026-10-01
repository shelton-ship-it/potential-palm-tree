// FIX: este ficheiro chegou vazio (0 bytes) no upload — legalLinksFor() e
// SUPPORT_EMAIL são importados por AppShell.tsx (menu "Informações legais"
// da sidebar + rodapé) e por app/main/page.tsx (rodapé institucional), pelo
// que a app inteira ficava sem esses links e sem o e-mail de suporte.
// Reconstruído a partir das rotas /main/{about,security,terms,copyright,
// cookies,faq}/page.tsx já existentes e do título de cada página em
// src/_shared/pages/legal/*Page.tsx (cada uma guarda o próprio título em
// pt/en/es — os rótulos abaixo espelham exatamente esses títulos).
import type { LegalLang } from './legalLang';

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@pixgo.qzz.io';

interface LegalLink { href: string; label: string; }

const LINKS_BY_LANG: Record<LegalLang, LegalLink[]> = {
  pt: [
    { href: '/main/about',     label: 'Quem somos' },
    { href: '/main/security',  label: 'Segurança' },
    { href: '/main/terms',     label: 'Termos e condições' },
    { href: '/main/copyright', label: 'Direitos de autor' },
    { href: '/main/cookies',   label: 'Política de cookies' },
    { href: '/main/faq',       label: 'Perguntas frequentes' },
  ],
  en: [
    { href: '/main/about',     label: 'About us' },
    { href: '/main/security',  label: 'Security' },
    { href: '/main/terms',     label: 'Terms and Conditions' },
    { href: '/main/copyright', label: 'Copyright' },
    { href: '/main/cookies',   label: 'Cookie policy' },
    { href: '/main/faq',       label: 'FAQ' },
  ],
  es: [
    { href: '/main/about',     label: 'Quiénes somos' },
    { href: '/main/security',  label: 'Seguridad' },
    { href: '/main/terms',     label: 'Términos y condiciones' },
    { href: '/main/copyright', label: 'Derechos de autor' },
    { href: '/main/cookies',   label: 'Política de cookies' },
    { href: '/main/faq',       label: 'Preguntas frecuentes' },
  ],
};

// Export de compatibilidade — lista base (pt) para quem importar sem passar
// idioma.
export const LEGAL_LINKS: LegalLink[] = LINKS_BY_LANG.pt;

export function legalLinksFor(language?: string): LegalLink[] {
  const code = (language || 'pt').slice(0, 2);
  const lang: LegalLang = code === 'en' || code === 'es' ? (code as LegalLang) : 'pt';
  return LINKS_BY_LANG[lang];
}
