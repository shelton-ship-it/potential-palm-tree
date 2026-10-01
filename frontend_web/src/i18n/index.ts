'use client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// OTIMIZAÇÃO (produção): antes, os 3 ficheiros de tradução completos
// (pt+en+es, ~460KB de JSON) eram importados estaticamente e ficavam
// TODOS no bundle client, parseados no arranque de TODA página — mesmo
// quando 2 dos 3 idiomas nunca chegam a ser usados nessa sessão. Isto
// só engorda o bundle inicial e o tempo até a app ficar interactiva; não
// tem relação com a lentidão por-clique de rede, mas soma ao tempo geral.
// Agora: só o idioma escolhido (localStorage → navigator → 'pt') é
// carregado de forma síncrona antes do init; os outros dois são
// carregados por import() dinâmico só quando o utilizador muda de
// idioma (ver changeLanguageLazy abaixo / LanguageModal / AppShell).
const LOCALE_LOADERS: Record<string, () => Promise<any>> = {
  pt: () => import('./locales/pt.json'),
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
};

function detectInitialLang(): string {
  if (typeof window === 'undefined') return 'pt';
  const stored = localStorage.getItem('pixgo_lang');
  if (stored && LOCALE_LOADERS[stored]) return stored;
  const nav = (navigator.language || 'pt').slice(0, 2);
  return LOCALE_LOADERS[nav] ? nav : 'pt';
}

const _loadedLangs = new Set<string>();

/** Garante que um idioma está carregado no i18next antes de o activar. */
export async function ensureLanguageLoaded(lang: string): Promise<void> {
  if (_loadedLangs.has(lang) || !LOCALE_LOADERS[lang]) return;
  const mod = await LOCALE_LOADERS[lang]();
  i18n.addResourceBundle(lang, 'translation', mod.default ?? mod, true, true);
  _loadedLangs.add(lang);
}

/** changeLanguage seguro — carrega o bundle antes de trocar, se preciso. */
export async function changeLanguageLazy(lang: string): Promise<void> {
  await ensureLanguageLoaded(lang);
  await i18n.changeLanguage(lang);
}

const _initialLang = detectInitialLang();

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      lng: _initialLang,
      resources: {},
      fallbackLng: 'pt',
      supportedLngs: ['pt', 'en', 'es'],
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'pixgo_lang',
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      partialBundledLanguages: true,
    });

  // Carrega já o idioma inicial (síncrono em termos de UX — antes do
  // primeiro render útil), os outros dois só entram sob demanda.
  ensureLanguageLoaded(_initialLang);
}

export default i18n;

export const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷', native: 'Português' },
  { code: 'en', label: 'English',   flag: '🇺🇸', native: 'English' },
  { code: 'es', label: 'Español',   flag: '🇪🇸', native: 'Español' },
];
