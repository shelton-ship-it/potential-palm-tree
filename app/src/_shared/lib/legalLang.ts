import { useTranslation } from 'react-i18next';

export type LegalLang = 'pt' | 'en' | 'es';

// As páginas institucionais/legais guardam o texto completo em três
// idiomas dentro do próprio componente (em vez de chaves i18n soltas,
// pouco práticas para blocos longos de texto corrido). Este hook só
// resolve qual dos três dicionários usar, com "pt" como padrão seguro.
export function useLegalLang(): LegalLang {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'pt').slice(0, 2);
  return code === 'en' || code === 'es' ? code : 'pt';
}
