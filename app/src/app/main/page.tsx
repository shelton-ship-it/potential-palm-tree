'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/_shared';
import { plansApi } from '@/_shared/lib/api';
import { formatPlanPrice } from '@/_shared/lib/planPrice';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import FolderSharedOutlinedIcon from '@mui/icons-material/FolderSharedOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import { useTranslation } from 'react-i18next';
import { legalLinksFor, SUPPORT_EMAIL } from '@/_shared/lib/legalLinks';

// Vazio (padrão) = login/registo locais, usados pelo hub central. Nas
// plataformas satélite, ACCOUNT_URL aponta para o hub, mesma convenção do AppShell.
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL || '';
const LOGIN_HREF    = ACCOUNT_URL ? `${ACCOUNT_URL}/auth/login`    : '/auth/login';
const REGISTER_HREF = ACCOUNT_URL ? `${ACCOUNT_URL}/auth/register` : '/auth/register';

const PLATFORM_URLS: Record<string, string> = {
  // FIX: só compresshub e convertall — o resto continua a ir para a raiz.
  convertall:  `${process.env.NEXT_PUBLIC_CONVERTALL_URL  || 'https://convertall.pixgo.qzz.io'}/main`,
  backcut:     process.env.NEXT_PUBLIC_BACKCUT_URL     || 'https://backcut.pixgo.qzz.io',
  compresshub: `${process.env.NEXT_PUBLIC_COMPRESSHUB_URL || 'https://compresshub.pixgo.qzz.io'}/main`,
  docforge:    process.env.NEXT_PUBLIC_DOCFORGE_URL    || 'https://docforge.pixgo.qzz.io',
  editpdf:     process.env.NEXT_PUBLIC_EDITPDF_URL     || 'https://editpdf.pixgo.qzz.io',
  qrforge:     process.env.NEXT_PUBLIC_QRFORGE_URL     || 'https://qrforge.pixgo.qzz.io',
  reccast:     process.env.NEXT_PUBLIC_RECCAST_URL     || 'https://reccast.pixgo.qzz.io',
  resumeforge: process.env.NEXT_PUBLIC_RESUMEFORGE_URL || 'https://resumeforge.pixgo.qzz.io',
};

// Lista completa das plataformas Pixgo. Todas as ferramentas terminam em
// "Studio", convenção única de marca em toda a suite. Nomes e ícones não são
// traduzidos (marca própria); verb/tagline vêm do i18n (main.platforms.<id>).
// Ordem definida pela equipa: ResumeForge, RecCast, EditPDF e ConvertAll em
// destaque primeiro.
const PLATFORM_META = [
  { id: 'resumeforge', name: 'ResumeForge Studio', icon: '✦' },
  { id: 'reccast',     name: 'RecCast Studio',     icon: '◉' },
  { id: 'editpdf',     name: 'EditPDF Studio',     icon: '▧' },
  { id: 'convertall',  name: 'ConvertAll Studio',  icon: '↗' },
  { id: 'backcut',     name: 'BackCut Studio',     icon: '◒' },
  { id: 'compresshub', name: 'CompressHub Studio', icon: '⌁' },
  { id: 'docforge',    name: 'DocForge Studio',    icon: '▤' },
  { id: 'qrforge',     name: 'QRForge Studio',     icon: '⌗' },
].map(item => ({ ...item, route: PLATFORM_URLS[item.id] }));

const PLATFORM_COUNT = PLATFORM_META.length;
const PLATFORM_COUNT_LABEL = String(PLATFORM_COUNT).padStart(2, '0');

// ── Imagens de demonstração (secção "Como funciona" / hero) ────────────────
const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'avif'];
function imageCandidates(id: string, frame: number) {
  return IMAGE_EXTENSIONS.map(ext => `/${id}_${(frame % 4) + 1}.${ext}`);
}

function ProductVisual({ platform, frame }: { platform: typeof PLATFORM_META[number]; frame: number }) {
  const [source, setSource] = useState(imageCandidates(platform.id, frame)[0]);
  const [candidate, setCandidate] = useState(0);
  useEffect(() => { setCandidate(0); setSource(imageCandidates(platform.id, frame)[0]); }, [platform.id, frame]);
  // Pré-carrega a imagem do próximo frame (mesma plataforma) para que, quando
  // o temporizador trocar de frame, a imagem já esteja em cache do browser —
  // evita que a troca pareça "instantânea/vazia" enquanto a rede ainda carrega.
  useEffect(() => {
    const nextFrame = (frame + 1) % 4;
    const img = new Image();
    img.src = imageCandidates(platform.id, nextFrame)[0];
  }, [platform.id, frame]);
  return (
    <div className="enterprise-product-visual" key={`${platform.id}-${frame}`}>
      <img
        src={source}
        alt={`${platform.name}: captura de ecrã desktop`}
        onError={() => {
          const next = candidate + 1;
          setCandidate(next);
          if (next < IMAGE_EXTENSIONS.length) setSource(imageCandidates(platform.id, frame)[next]);
        }}
      />
      {candidate >= IMAGE_EXTENSIONS.length && (
        <div className="enterprise-fallback">
          <span>{platform.icon}</span>
          <b>{platform.name}</b>
          <small>Captura desktop em /public/{platform.id}_1…4</small>
        </div>
      )}
      <div className="enterprise-visual-glow" />
    </div>
  );
}

// ── Cards de branding ───────────────────────────────────────────────────────
// Cada produto guarda 3 imagens de marca em /public/branding/{id}/{id}_1.{ext},
// {id}_2.{ext} e {id}_3.{ext} (mesma convenção de nomes do ProductVisual acima,
// mosaico: uma imagem principal + duas de apoio). Testa as extensões em
// IMAGE_EXTENSIONS (mesmo mecanismo do ProductVisual) antes de desistir de um
// slot; enquanto as imagens reais não sobem, o card cai graciosamente para a
// identidade da própria plataforma (cor + ícone), nunca mostra um espaço vazio.
function brandingCandidates(id: string, slot: number) {
  return IMAGE_EXTENSIONS.map(ext => `/branding/${id}/${id}_${slot}.${ext}`);
}

function BrandingImage({ id, slot, alt, onGiveUp }: { id: string; slot: number; alt: string; onGiveUp: () => void }) {
  const candidates = useMemo(() => brandingCandidates(id, slot), [id, slot]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [id, slot]);
  if (attempt >= candidates.length) return null;
  return (
    <img
      src={candidates[attempt]}
      alt={alt}
      onError={() => {
        const next = attempt + 1;
        if (next < candidates.length) setAttempt(next);
        else onGiveUp();
      }}
    />
  );
}

function BrandingCard({ platform, index }: { platform: typeof PLATFORM_META[number]; index: number }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState<boolean[]>([false, false, false]);
  const markBroken = (i: number) => setBroken(b => b.map((v, idx) => (idx === i ? true : v)));
  const allBroken = broken.every(Boolean);
  const tagline = t(`main.platforms.${platform.id}.tagline`, 'Identidade visual dedicada, com logótipo, cor e tom de voz próprios.');

  return (
    <article className="enterprise-brand-card">
      <div className="enterprise-brand-mosaic">
        {allBroken ? (
          <div className="enterprise-brand-fallback">
            <span>{platform.icon}</span>
            <b>{platform.name}</b>
          </div>
        ) : (
          <>
            <div className="enterprise-brand-main">
              {!broken[0] && (
                <BrandingImage id={platform.id} slot={1} alt={`${platform.name}: imagem de marca principal`} onGiveUp={() => markBroken(0)} />
              )}
            </div>
            <div className="enterprise-brand-side">
              {!broken[1] && (
                <BrandingImage id={platform.id} slot={2} alt={`${platform.name}: imagem de marca 2`} onGiveUp={() => markBroken(1)} />
              )}
              {!broken[2] && (
                <BrandingImage id={platform.id} slot={3} alt={`${platform.name}: imagem de marca 3`} onGiveUp={() => markBroken(2)} />
              )}
            </div>
          </>
        )}
      </div>
      <div className="enterprise-brand-caption">
        <span className="enterprise-number">0{index + 1}</span>
        <b>{platform.name}</b>
        <small>{tagline}</small>
      </div>
    </article>
  );
}

// ── Público-alvo / marketing ────────────────────────────────────────────────
const AUDIENCE_ICONS: Record<string, React.ElementType> = {
  productivity: TrendingUpRoundedIcon,
  school:       SchoolOutlinedIcon,
  projects:     AccountTreeOutlinedIcon,
  career:       WorkspacePremiumOutlinedIcon,
  organization: ChecklistRtlOutlinedIcon,
};
const AUDIENCE_KEYS = ['productivity', 'school', 'projects', 'career', 'organization'];
const AUDIENCE_FALLBACK: Record<string, { title: string; copy: string }> = {
  productivity: { title: 'Produtividade', copy: 'Menos tempo a trocar de app, mais tempo a entregar. Cada Studio resolve uma tarefa por completo, sem desvios.' },
  school:       { title: 'Escola e Estudos', copy: 'De trabalhos a currículos e apresentações: ferramentas simples o suficiente para o primeiro dia de aulas.' },
  projects:     { title: 'Projectos', copy: 'Documentos, ficheiros e recursos de um projecto, tratados do início ao fim dentro da mesma suite.' },
  career:       { title: 'Crescimento Profissional', copy: 'CVs, propostas e apresentações com o polimento de quem já chegou lá, sem contratar um designer.' },
  organization: { title: 'Organização', copy: 'Um login, um histórico, um lugar só. A sua rotina digital deixa de estar espalhada por dez separadores.' },
};

const ONBOARDING_FALLBACK = [
  { title: 'Criar conta', copy: 'Um registo simples, com e-mail ou Google. A conta serve para toda a suite, não apenas para um Studio.' },
  { title: 'Escolher o ritmo', copy: 'Plano grátis para começar já, ou uma frequência paga (mensal, trimestral, anual) quando precisar de mais.' },
  { title: 'Entrar em qualquer Studio', copy: 'A mesma sessão abre qualquer ferramenta da suite, no momento em que precisar dela.' },
];

const TRUST_FALLBACK = [
  { title: 'Sessão protegida', copy: 'Autenticação própria por conta, com controlo total sobre onde e como a sessão fica activa.' },
  { title: 'Dados com dono', copy: 'Cada ficheiro e cada transferência pertencem à conta que os criou, sem partilha entre utilizadores.' },
  { title: 'Transparência institucional', copy: 'Termos, política de cookies, direitos de autor e segurança documentados e sempre à distância de um clique.' },
];


const ONBOARDING_ICONS = [HowToRegOutlinedIcon, TuneOutlinedIcon, RocketLaunchOutlinedIcon];
const TRUST_ICONS = [VerifiedUserOutlinedIcon, FolderSharedOutlinedIcon, GavelOutlinedIcon];

interface Plan { id: string; name: string; price?: number; currency?: string; is_free?: boolean; }
const PLAN_FREQUENCY_LABEL: Record<string, string> = { monthly: '/mês', quarterly: '/trimestre', annual: '/ano' };
const PLAN_FREQUENCY_NAME: Record<string, string> = { free: 'Sem custo', monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual' };

export default function EnterpriseHome() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(s => s.user);
  const [active, setActive] = useState(0);
  const [frame, setFrame] = useState(0);
  const platform = PLATFORM_META[active];
  const platformVerb = (id: string) => t(`main.platforms.${id}.verb`, '');
  const legalLinks = legalLinksFor(i18n.language);
  const phrases = useMemo(() => [
    platformVerb(platform.id),
    t('main.hero.dynamicStarts', 'Tudo começa com {{name}}.', { name: platform.name }),
    t('main.hero.dynamicSuite', 'Uma suite. Menos fricção. Mais resultado.'),
  ], [platform, i18n.language]);
  const [phrase, setPhrase] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    // FIX: antes, "active" (plataforma) e "frame" (imagem 1-4) avançavam
    // juntos no mesmo tick — cada plataforma só chegava a mostrar 1 das 4
    // imagens antes de já trocar. Agora percorre as 4 imagens da plataforma
    // actual primeiro (frame 0→1→2→3), só troca de plataforma quando o
    // frame dá a volta (0 de novo) — garante que as 4 imagens definidas em
    // /public/{id}_1..4 são todas mostradas.
    // FIX 2: 2100ms ainda era rápido demais para conseguir ver cada imagem
    // (e mal dava tempo de carregar antes de já trocar) — subiu para
    // 4500ms por imagem × 4 = 18s por plataforma.
    const FRAME_INTERVAL_MS = 4500;
    const timer = window.setInterval(() => {
      setFrame(prevFrame => {
        const nextFrame = (prevFrame + 1) % 4;
        if (nextFrame === 0) {
          setActive(v => (v + 1) % PLATFORM_META.length);
          setPhrase(0);
        }
        return nextFrame;
      });
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setPhrase(v => (v + 1) % phrases.length), 2300);
    return () => window.clearInterval(timer);
  }, [phrases.length, active]);
  useEffect(() => {
    plansApi.list().then((res: any) => setPlans(res.plans || [])).catch(() => setPlans([]));
  }, []);

  return (
    <div className="enterprise-home">
      <section className="enterprise-hero">
        <div className="enterprise-orbit orbit-one" />
        <div className="enterprise-orbit orbit-two" />
        <nav className="enterprise-nav">
          <a href="/main" className="enterprise-wordmark"><span>Workspace</span><b>Enterprise</b><i>Suite</i></a>
          <div className="enterprise-nav-links">
            <a href="#suite">{t('main.nav.suite', 'Suite')}</a>
            <a href="#branding">{t('main.nav.identity', 'Identidade')}</a>
            <a href="#publico">{t('main.nav.audience', 'Para quem')}</a>
            <a href="#workflow">{t('main.nav.workflow', 'Como funciona')}</a>
            <a href="#planos">{t('main.nav.plans', 'Planos')}</a>
            <a href="#proof">{t('main.nav.trust', 'Confiança')}</a>
          </div>
          <div className="enterprise-nav-actions">
            {user ? (
              <>
                <span className="enterprise-user">{t('main.nav.greeting', 'Olá, {{name}}', { name: (user.name || '').split(' ')[0] })}</span>
                <a className="enterprise-nav-cta" href="/main/plans">{t('main.nav.viewPlans', 'Ver planos')} <ArrowOutwardIcon /></a>
              </>
            ) : (
              <>
                <a className="enterprise-auth-cta enterprise-auth-cta-ghost" href={LOGIN_HREF}>{t('main.nav.signIn', 'Iniciar sessão')}</a>
                <a className="enterprise-auth-cta" href={REGISTER_HREF}>{t('main.nav.signUp', 'Criar conta')}</a>
              </>
            )}
          </div>
        </nav>
        <div className="enterprise-hero-grid">
          <div className="enterprise-hero-copy">
            <div className="enterprise-kicker"><span className="pulse-dot" /> {t('main.hero.kicker', 'WORKSPACE DIGITAL UNIFICADO')}</div>
            <h1>{t('main.hero.titleLine1', 'Menos ferramentas.')}<br /><em>{t('main.hero.titleLine2', 'Mais movimento.')}</em></h1>
            <div className="enterprise-dynamic-line" key={`${active}-${phrase}`}>{phrases[phrase]}</div>
            <p>{t('main.hero.lead', 'Uma experiência contínua para transformar ficheiros, documentos, imagens, áudio e presença profissional, sem saltar entre plataformas.')}</p>
            <div className="enterprise-hero-buttons">
              <a className="enterprise-main-cta" href="#suite">{t('main.hero.explore', 'Explorar a suite')} <ArrowOutwardIcon /></a>
              <button className="enterprise-demo-cta" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>
                <span><PlayArrowRoundedIcon /></span> {t('main.hero.howItWorks', 'Ver como funciona')}
              </button>
            </div>
            <div className="enterprise-proof-row">
              <div><b>{PLATFORM_COUNT_LABEL}</b><span>{t('main.hero.statPlatforms', 'plataformas conectadas')}</span></div>
              <div><b>01</b><span>{t('main.hero.statExperience', 'experiência coerente')}</span></div>
              <div><b>∞</b><span>{t('main.hero.statPossibilities', 'possibilidades')}</span></div>
            </div>
          </div>
          <div className="enterprise-hero-art">
            <div className="enterprise-art-frame">
              <ProductVisual platform={platform} frame={frame} />
              <div className="enterprise-art-caption">
                <span>{String(active + 1).padStart(2, '0')} / {PLATFORM_COUNT_LABEL}</span>
                <b>{platform.name}</b>
                <small>{platformVerb(platform.id)}</small>
              </div>
            </div>
            <div className="enterprise-floating-note"><AutoAwesomeIcon /><span>{t('main.hero.featured', 'Em destaque')} · {platform.name}</span></div>
          </div>
        </div>
      </section>

      <section id="suite" className="enterprise-suite">
        <div className="enterprise-section-head">
          <div><span className="enterprise-kicker">{t('main.suite.kicker', 'A SUITE ENTERPRISE')}</span><h2>{t('main.suite.titleLine1', 'O ecossistema inteiro.')}<br /><em>{t('main.suite.titleLine2', 'Em movimento.')}</em></h2></div>
          <p>{t('main.suite.lead', 'Todos os produtos têm presença, imagem e mensagem próprias. O palco muda automaticamente para revelar cada parte da suite.')}</p>
        </div>
        <div className="enterprise-platform-list">
          {PLATFORM_META.map((item, index) => (
            <article
              key={item.id}
              className={`enterprise-platform-card ${active === index ? 'selected' : ''}`}
              onClick={() => window.location.assign(item.route)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.location.assign(item.route); } }}
              tabIndex={0} role="link" aria-label={`Abrir ${item.name}`}
            >
              <div className="enterprise-card-top"><span className="enterprise-number">0{index + 1}</span><span className="enterprise-icon">{item.icon}</span></div>
              <h3>{item.name}</h3>
              <p>{platformVerb(item.id)}</p>
              <a className="enterprise-card-link" href={item.route} onClick={event => event.stopPropagation()}>{t('main.suite.openProduct', 'Abrir produto')} <ArrowOutwardIcon /></a>
            </article>
          ))}
        </div>
      </section>

      <section id="branding" className="enterprise-branding">
        <div className="enterprise-section-head">
          <div><span className="enterprise-kicker"><PaletteOutlinedIcon style={{ fontSize: 13, marginRight: 6, verticalAlign: -2 }} />{t('main.branding.kicker', 'IDENTIDADE PRÓPRIA')}</span><h2>{t('main.branding.titleLine1', 'Cada Studio,')}<br /><em>{t('main.branding.titleLine2', 'a sua marca.')}</em></h2></div>
          <p>{t('main.branding.lead', 'Nenhum produto da suite parece um clone do outro. Cor, tom e imagem são pensados um a um: é isso que aparece aqui.')}</p>
        </div>
        <div className="enterprise-brand-list">
          {PLATFORM_META.map((item, index) => <BrandingCard key={item.id} platform={item} index={index} />)}
        </div>
      </section>

      <section id="publico" className="enterprise-audiences">
        <div className="enterprise-section-head">
          <div><span className="enterprise-kicker">{t('main.audience.kicker', 'FEITO PARA O SEU DIA A DIA')}</span><h2>{t('main.audience.titleLine1', 'Produtividade real,')}<br /><em>{t('main.audience.titleLine2', 'para quem precisa dela.')}</em></h2></div>
          <p>{t('main.audience.lead', 'Estudantes, profissionais e técnicos usam a suite pelos mesmos motivos: menos fricção, mais foco no que importa.')}</p>
        </div>
        <div className="enterprise-audience-list">
          {AUDIENCE_KEYS.map(key => {
            const Icon = AUDIENCE_ICONS[key];
            return (
              <div className="enterprise-audience-card" key={key}>
                <Icon />
                <h3>{t(`main.audience.items.${key}.title`, AUDIENCE_FALLBACK[key].title)}</h3>
                <p>{t(`main.audience.items.${key}.copy`, AUDIENCE_FALLBACK[key].copy)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="enterprise-workflow">
        <div className="enterprise-workflow-visual">
          <ProductVisual platform={platform} frame={(frame + 1) % 4} />
          <div className="enterprise-scanline" />
        </div>
        <div className="enterprise-workflow-copy">
          <span className="enterprise-kicker">{t('main.workflow.kicker', 'UM FLUXO, NÃO VÁRIOS LOGINS')}</span>
          <h2>{t('main.workflow.titleLine1', 'O seu trabalho tem ritmo.')}<br /><em>{t('main.workflow.titleLine2', 'A suite acompanha.')}</em></h2>
          <p>{t('main.workflow.lead', 'Cada ferramenta ganha o seu momento em destaque, com identidade, mensagem e imagem próprias: capturas reais do desktop, nunca maquetas genéricas.')}</p>
          <div className="enterprise-feature-line"><BoltRoundedIcon /><span><b>{t('main.workflow.feature1Title', 'Presença própria.')}</b> {t('main.workflow.feature1Copy', 'Cada produto surge com a sua marca, sem esforço da sua parte.')}</span></div>
          <div className="enterprise-feature-line"><AutoAwesomeIcon /><span><b>{t('main.workflow.feature2Title', 'Coerente por natureza.')}</b> {t('main.workflow.feature2Copy', 'Uma identidade visual única para toda a suite.')}</span></div>
          <a className="enterprise-main-cta" href="#suite">{t('main.workflow.viewAll', 'Ver todos os produtos')} <ArrowOutwardIcon /></a>
        </div>
      </section>

      <section id="onboarding" className="enterprise-audiences">
        <div className="enterprise-section-head">
          <div><span className="enterprise-kicker">{t('main.onboarding.kicker', 'COMO COMEÇAR')}</span><h2>{t('main.onboarding.titleLine1', 'Três passos.')}<br /><em>{t('main.onboarding.titleLine2', 'Zero fricção.')}</em></h2></div>
          <p>{t('main.onboarding.lead', 'Da conta ao primeiro ficheiro pronto, sem instalações e sem esperar por ninguém.')}</p>
        </div>
        <div className="enterprise-audience-list" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[1, 2, 3].map(n => {
            const Icon = ONBOARDING_ICONS[n - 1];
            return (
              <div className="enterprise-audience-card" key={n}>
                <Icon />
                <h3>{t(`main.onboarding.step${n}Title`, ONBOARDING_FALLBACK[n - 1].title)}</h3>
                <p>{t(`main.onboarding.step${n}Copy`, ONBOARDING_FALLBACK[n - 1].copy)}</p>
              </div>
            );
          })}
        </div>
        {!user && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <a className="enterprise-main-cta" href={REGISTER_HREF} style={{ display: 'inline-flex' }}>{t('main.onboarding.cta', 'Criar conta')} <ArrowOutwardIcon /></a>
          </div>
        )}
      </section>

      <section id="proof-trust" className="enterprise-audiences">
        <div className="enterprise-section-head">
          <div><span className="enterprise-kicker">{t('main.trust.kicker', 'CONFIANÇA E SEGURANÇA')}</span><h2>{t('main.trust.titleLine1', 'Construído para durar,')}<br /><em>{t('main.trust.titleLine2', 'pensado para proteger.')}</em></h2></div>
          <p>{t('main.trust.lead', 'Cada sessão é validada, cada ficheiro processado tem um dono, e a informação sobre como tudo funciona está sempre acessível.')}</p>
        </div>
        <div className="enterprise-audience-list" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[1, 2, 3].map(n => {
            const Icon = TRUST_ICONS[n - 1];
            return (
              <div className="enterprise-audience-card" key={n}>
                <Icon />
                <h3>{t(`main.trust.item${n}Title`, TRUST_FALLBACK[n - 1].title)}</h3>
                <p>{t(`main.trust.item${n}Copy`, TRUST_FALLBACK[n - 1].copy)}</p>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a className="enterprise-card-link" style={{ justifyContent: 'center' }} href={legalLinks.find(l => l.href.includes('/security'))?.href || '/main/security'}>
            {t('main.trust.learnMore', 'Ver política de segurança')} <ArrowOutwardIcon />
          </a>
        </div>
      </section>

      <section id="planos" className="enterprise-pricing">
        <div className="enterprise-pricing-head">
          <span className="enterprise-kicker"><SpeedRoundedIcon style={{ fontSize: 13, marginRight: 6, verticalAlign: -2 }} />{t('main.pricing.kicker', 'RITMO PRÓPRIO, PREÇO JUSTO')}</span>
          <h2>{t('main.pricing.titleLine1', 'Uma frequência de pagamento')}<br /><em>{t('main.pricing.titleLine2', 'para cada tipo de rotina.')}</em></h2>
          <p>{t('main.pricing.lead', 'Estudante, profissional autónomo ou técnico de TI: escolha a frequência (mensal, trimestral ou anual) e comece a trabalhar em minutos, na mesma sessão que já usa em toda a suite.')}</p>
        </div>
        <div className="enterprise-pricing-list">
          {(plans.length ? plans : [{ id: 'free', name: 'Free', is_free: true }, { id: 'monthly', name: 'Mensal' }, { id: 'quarterly', name: 'Trimestral' }, { id: 'annual', name: 'Anual' }]).map(p => (
            <div key={p.id} className={`enterprise-pricing-card ${p.id === 'annual' ? 'featured' : ''}`}>
              {p.id === 'annual' && <span className="enterprise-pricing-badge">{t('main.pricing.bestFrequency', 'Melhor frequência')}</span>}
              <span className="enterprise-pricing-freq">{PLAN_FREQUENCY_NAME[p.id] || p.name}</span>
              <div className="enterprise-pricing-value">
                {p.is_free ? t('main.pricing.free', 'Grátis') : formatPlanPrice(p, plans.find(x => x.currency)?.currency)}
                {!p.is_free && <span>{PLAN_FREQUENCY_LABEL[p.id] || ''}</span>}
              </div>
              <ul className="enterprise-pricing-features">
                <li><CheckCircleRoundedIcon />{t('main.pricing.featureAccess', 'Acesso ao ecossistema Pixgo')}</li>
                <li><CheckCircleRoundedIcon />{t('main.pricing.featureLogin', 'Um único login para toda a suite')}</li>
                <li><CheckCircleRoundedIcon />{t('main.pricing.featureActivation', 'Ativação imediata, sem espera')}</li>
              </ul>
              <a className={`btn ${p.id === 'annual' ? 'btn-primary' : 'btn-ghost'}`} style={{ width: '100%', justifyContent: 'center' }} href={user ? '/main/plans' : REGISTER_HREF}>
                {p.is_free ? t('main.pricing.startFree', 'Começar grátis') : t('main.pricing.chooseFrequency', 'Escolher esta frequência')}
              </a>
            </div>
          ))}
        </div>
        <div className="enterprise-pricing-note"><SavingsOutlinedIcon /><span>{t('main.pricing.note', 'Um único plano acompanha o crescimento da equipa: quanto mais a suite é usada, mais eficiente se torna o investimento por pessoa.')}</span></div>
      </section>

      <section id="proof" className="enterprise-proof">
        <div className="enterprise-proof-quote">
          "<em>{t('main.proof.quote', 'Uma suite única, com vários pontos de entrada e uma experiência que nunca fica parada.')}</em>"
          <span>{t('main.proof.attribution', 'Workspace Enterprise')}</span>
        </div>
        <div className="enterprise-marquee">{PLATFORM_META.map(item => <span key={item.id}>{item.name.toUpperCase()}</span>)}</div>
      </section>

      <footer className="enterprise-footer">
        <a className="enterprise-wordmark" href="/main"><span>Workspace</span><b>Enterprise</b><i>Suite</i></a>
        <span>{t('footer.copyright', 'Ferramentas digitais para trabalho que avança.')}</span>
        <nav className="enterprise-footer-legal">
          {legalLinks.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </nav>
        <a href="/main/plans">{t('main.nav.plans', 'Planos')} <ArrowOutwardIcon /></a>
      </footer>
    </div>
  );
}
