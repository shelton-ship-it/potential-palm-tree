// Componentes de layout
export { default as AppShell } from './components/layout/AppShell';
export type { NavItem } from './components/layout/AppShell';
export { default as MobileNav } from './components/layout/MobileNav';
export { default as Providers } from './components/Providers';
export { default as LanguageModal } from './components/modals/LanguageModal';
export { default as InstallPWAButton } from './components/ui/InstallPWAButton';

// Estado + API
export { useAuthStore, authedFetch } from './store/auth';
export { authApi, plansApi, get, post, put, del, API_BASE, PLATFORM_ID } from './lib/api';

// i18n
export { default as i18n, LANGUAGES } from './i18n';

// Páginas prontas — cada app só as re-exporta na sua rota
export { default as LoginPage } from './pages/LoginPage';
export { default as RegisterPage } from './pages/RegisterPage';
export { default as PlansPage } from './pages/PlansPage';
export type { PlanFeatures } from './pages/PlansPage';
export { default as CheckoutPage } from './pages/CheckoutPage';
export { default as CheckoutSuccessPage } from './pages/CheckoutSuccessPage';
export { default as CheckoutPendingPage } from './pages/CheckoutPendingPage';
export { default as CheckoutAnalysisPage } from './pages/CheckoutAnalysisPage';
export { default as AccountPage } from './pages/AccountPage';
export { default as ConnectTvPage } from './pages/ConnectTvPage';
export { default as MainLayoutShell } from './pages/MainLayoutShell';

// Páginas institucionais e legais
export { default as AboutPage } from './pages/legal/AboutPage';
export { default as SecurityPage } from './pages/legal/SecurityPage';
export { default as TermsPage } from './pages/legal/TermsPage';
export { default as PrivacyPage } from './pages/legal/PrivacyPage';
export { default as CopyrightPage } from './pages/legal/CopyrightPage';
export { default as CookiesPage } from './pages/legal/CookiesPage';
export { default as FaqPage } from './pages/legal/FaqPage';
export { default as NotificationsPage } from './pages/legal/NotificationsPage';
export { default as SettingsPage } from './pages/legal/SettingsPage';
export { default as DownloadPage } from './pages/legal/DownloadPage';
