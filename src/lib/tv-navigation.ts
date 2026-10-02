/**
 * tv-navigation.ts — StreamPlatform v8
 *
 * Correcções vs v7:
 *
 * 🔴 FIX 1 — Catálogo / ContentCard não focusáveis
 *   Os cards são <div> sem tabIndex. getFocusables() só apanhava elementos
 *   nativamente focusáveis. Solução: adicionar '[data-tv-focusable]' ao
 *   selector. ContentCard deve receber data-tv-focusable + tabIndex={0}.
 *   Em alternativa (sem tocar nos cards), injectTabIndex() percorre
 *   '.content-card, .channel-card' e adiciona tabIndex=0 automaticamente.
 *
 * 🔴 FIX 2 — Controles nativos do <video> bloqueados
 *   O handler interceptava Arrow* SEMPRE que behaviour === 'video' e
 *   chamava return sem preventDefault, mas o evento já não chegava ao player.
 *   Solução: quando o activeElement É um <video>, deixar TODOS os eventos
 *   passarem sem interceptação (return sem preventDefault/stopPropagation).
 *   O utilizador pode assim usar as setas para seek/volume, Enter para play/pause
 *   e F para fullscreen — tudo pelo browser nativo.
 *
 * 🔴 FIX 3 — Scroll race condition
 *   scrollToElement() chamava scheduleInvalidate() que invalidava o cache
 *   a 100ms. O focus acontecia antes do reflow, causando jump errado.
 *   Solução: após scroll, usar requestAnimationFrame + um segundo frame para
 *   garantir reflow antes de chamar focus. Cache só invalida após o foco estar
 *   estável.
 *
 * 🔴 FIX 4 — isOnTop() falso negativo em cards de catálogo
 *   elementFromPoint() no centro exacto do card podia bater no overlay
 *   (hover preview, badges), devolvendo false.
 *   Solução: testar mais pontos (9 em grelha 3×3) e aceitar se QUALQUER
 *   ponto acertar no elemento ou num descendente.
 *
 * 🟡 FIX 5 — Fullscreen via remote
 *   Quando o foco está no <video> e o utilizador carrega no botão de acção
 *   do remote (usualmente Enter ou KEY_PLAY), o browser nativo trata disso.
 *   Para TVs que enviam uma tecla dedicada (KEY_ENTER sobre o ícone de
 *   fullscreen nativo), não há nada a fazer — é comportamento do browser.
 *   Para SmartTVs que enviam 'f' ou KEY_F: adicionamos atalho 'f'/'F' que
 *   chama requestFullscreen() no container do player.
 */

// ── Modo de navegação por teclado/comando (dinâmico) ────────────────────────
// isLikelyTV() é um sniff ESTÁTICO do dispositivo (user-agent, touch,
// pointer:coarse) — um portátil normal com trackpad falha sempre este
// teste, mesmo que a pessoa esteja a navegar só com setas/Enter (teclado
// puro, ou um comando USB/bluetooth ligado a um desktop, que o browser não
// distingue de teclas normais). Isso desligava foco automático (menu de
// idioma, troca de página, vídeo) para qualquer um a testar/usar por
// teclado num dispositivo com rato instalado. Aqui detectamos o MODO DE
// USO actual: assim que uma tecla de navegação é processada, entramos em
// "modo teclado"; um clique real de rato sai dele.
let _keyboardNavActive = false;

/**
 * true se: for um dispositivo TV/set-top reconhecido (isLikelyTV()) OU a
 * pessoa tiver acabado de navegar por teclado/comando nesta sessão (mais
 * recentemente do que um clique de rato). Usar em vez de isLikelyTV()
 * sozinho para decisões de foco automático.
 */
export function shouldAutoFocus(): boolean {
  return isLikelyTV() || _keyboardNavActive;
}

// ── Selectores ────────────────────────────────────────────────────────────────

const FOCUSABLE_SEL = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[role="button"]:not([disabled]):not([tabindex="-1"])',
  'video[controls]',
  '[data-tv-focusable]',
].join(',');

// Selectores de cards de conteúdo que não têm tabIndex por defeito
// injectTabIndex() adiciona tabIndex=0 a estes elementos automaticamente
const AUTO_TABINDEX_SEL = [
  '.content-card',
  '.channel-card',
  '[data-tv-card]',
].join(',');

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Dir = 'up' | 'down' | 'left' | 'right';
type InputBehaviour = 'text' | 'choice' | 'video' | 'other' | 'none';

const DIR_MAP: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down',
  ArrowLeft: 'left', ArrowRight: 'right',
};

// ── injectTabIndex ────────────────────────────────────────────────────────────
// Adiciona tabIndex=0 a cards que ainda não têm, para que sejam focusáveis.
// Chamado pelo MutationObserver sempre que o DOM muda.

function injectTabIndex(scope: Element | Document = document): void {
  scope.querySelectorAll<HTMLElement>(AUTO_TABINDEX_SEL).forEach(el => {
    if (!el.getAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
  });
}

// ── isInDOMAndFocusable ───────────────────────────────────────────────────────

function isInDOMAndFocusable(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();

  if (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0) {
    const s = window.getComputedStyle(el);
    if (s.display === 'none') return false;
  }

  const s = window.getComputedStyle(el);
  if (s.display       === 'none'  ) return false;
  if (s.visibility    === 'hidden') return false;
  if (parseFloat(s.opacity) === 0 ) return false;

  return true;
}

// ── isInViewport ──────────────────────────────────────────────────────────────

function isInViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top  > window.innerHeight) return false;
  if (r.right  < 0 || r.left > window.innerWidth)  return false;
  if (r.width === 0 && r.height === 0)              return false;
  return true;
}

// ── isOnTop ───────────────────────────────────────────────────────────────────
// FIX 4: testa 9 pontos em grelha 3×3, aceita se QUALQUER um acertar.
// Reduz falsos negativos causados por badges/overlays sobre o card.

function isOnTop(el: HTMLElement): boolean {
  if (el.tagName.toLowerCase() === 'video') return isInViewport(el);
  // Out-of-viewport elements are always valid navigation candidates —
  // moveFocus() will scroll them into view before focusing.
  if (!isInViewport(el)) return true;

  const r   = el.getBoundingClientRect();
  const pad = 2; // margem interior para evitar bordas

  const xs = [r.left + pad + (r.width  - 2 * pad) * 0, 
               r.left + pad + (r.width  - 2 * pad) * 0.5, 
               r.left + pad + (r.width  - 2 * pad) * 1];
  const ys = [r.top  + pad + (r.height - 2 * pad) * 0,
               r.top  + pad + (r.height - 2 * pad) * 0.5,
               r.top  + pad + (r.height - 2 * pad) * 1];

  for (const x of xs) {
    for (const y of ys) {
      const cx = Math.max(r.left + 1, Math.min(x, r.right  - 1));
      const cy = Math.max(r.top  + 1, Math.min(y, r.bottom - 1));
      const hit = document.elementFromPoint(cx, cy);
      if (hit && (el === hit || el.contains(hit) || hit.contains(el))) return true;
    }
  }
  return false;
}

// ── Modal / Player detection ──────────────────────────────────────────────────

function getActiveModal(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[role="dialog"]:not([hidden]):not([aria-hidden="true"]), ' +
    '[data-modal="true"]:not([hidden]):not([aria-hidden="true"])'
  );
}

function getActivePlayer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-tv-player]:not([hidden]):not([aria-hidden="true"])'
  );
}

// ── Cache de focusables ───────────────────────────────────────────────────────

let _cachedFocusables: HTMLElement[] = [];
let _cacheValid      = false;
let _invalidateTimer: ReturnType<typeof setTimeout> | null = null;

function invalidateNow(): void {
  _cacheValid = false;
  if (_invalidateTimer) { clearTimeout(_invalidateTimer); _invalidateTimer = null; }
}

function scheduleInvalidate(delay = 120): void {
  if (_invalidateTimer) return;
  _invalidateTimer = setTimeout(() => {
    _cacheValid      = false;
    _invalidateTimer = null;
  }, delay);
}

function getFocusables(): HTMLElement[] {
  if (_cacheValid) return _cachedFocusables;

  // Garantir tabIndex nos cards antes de colectar
  injectTabIndex();

  const modal = getActiveModal();
  const scope = modal ?? document;

  _cachedFocusables = Array.from(
    scope.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)
  ).filter(el => isInDOMAndFocusable(el) && isOnTop(el));

  _cacheValid = true;
  return _cachedFocusables;
}

// ── Geometria ─────────────────────────────────────────────────────────────────

function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function findNearest(from: HTMLElement, dir: Dir, candidates: HTMLElement[]): HTMLElement | null {
  const fc = center(from);
  const fr = from.getBoundingClientRect();

  const inBand: HTMLElement[]  = [];
  const outBand: HTMLElement[] = [];

  for (const el of candidates) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const overlapV = fr.top  < r.bottom && r.top  < fr.bottom;
    const overlapH = fr.left < r.right  && r.left < fr.right;
    const inFaixa  = (dir === 'left' || dir === 'right') ? overlapV : overlapH;
    (inFaixa ? inBand : outBand).push(el);
  }

  function scoreSet(set: HTMLElement[], maxAngle: number): HTMLElement | null {
    let winner: HTMLElement | null = null;
    let winScore = Infinity;

    for (const el of set) {
      const ec = center(el);
      const dx = ec.x - fc.x;
      const dy = ec.y - fc.y;

      let primary: number;
      let cross:   number;
      let angle:   number;

      switch (dir) {
        case 'right':
          if (dx < 1) continue;
          angle = Math.abs(Math.atan2(Math.abs(dy), dx));
          primary = dx; cross = Math.abs(dy);
          break;
        case 'left':
          if (dx > -1) continue;
          angle = Math.abs(Math.atan2(Math.abs(dy), -dx));
          primary = -dx; cross = Math.abs(dy);
          break;
        case 'down':
          if (dy < 1) continue;
          angle = Math.abs(Math.atan2(Math.abs(dx), dy));
          primary = dy; cross = Math.abs(dx);
          break;
        case 'up':
          if (dy > -1) continue;
          angle = Math.abs(Math.atan2(Math.abs(dx), -dy));
          primary = -dy; cross = Math.abs(dx);
          break;
      }

      if (angle > maxAngle) continue;

      const score = primary + (angle / maxAngle) * primary * 0.3 + cross * 0.2;
      if (score < winScore) { winScore = score; winner = el; }
    }
    return winner;
  }

  if (inBand.length > 0) {
    const r = scoreSet(inBand, Math.PI / 4) ?? scoreSet(inBand, (89 * Math.PI) / 180);
    if (r) return r;
  }
  return scoreSet(outBand, Math.PI / 4) ?? scoreSet(outBand, (89 * Math.PI) / 180);
}

// ── Scroll + focus (FIX 3) ────────────────────────────────────────────────────
// Usa dois frames de rAF para garantir reflow antes do focus.
// Invalida o cache DEPOIS do focus estar estável.

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const s = window.getComputedStyle(node);
    if (
      s.overflowX === 'auto' || s.overflowX === 'scroll' ||
      s.overflowY === 'auto' || s.overflowY === 'scroll'
    ) return node;
    node = node.parentElement;
  }
  return null;
}

function scrollToElement(el: HTMLElement): boolean {
  const r   = el.getBoundingClientRect();
  const pad = 100; // generous padding so focus ring is never clipped

  const needsScroll =
    r.top    < pad                        ||
    r.bottom > window.innerHeight - pad   ||
    r.left   < pad                        ||
    r.right  > window.innerWidth  - pad;

  if (!needsScroll) return false;

  const parent = getScrollParent(el);

  if (parent) {
    const pr = parent.getBoundingClientRect();
    const ps = window.getComputedStyle(parent);
    const isHorzCarousel =
      (ps.overflowX === 'auto' || ps.overflowX === 'scroll') &&
       ps.overflowY !== 'auto' && ps.overflowY !== 'scroll';

    if (isHorzCarousel) {
      const elCenter     = r.left  + r.width  / 2;
      const parentCenter = pr.left + pr.width / 2;
      parent.scrollLeft += elCenter - parentCenter;
      return true;
    }
  }

  // Use 'center' so the element is always centred in the viewport — this prevents
  // the "nearest" stall where an element is 1px inside the viewport and no scroll happens.
  // For upward navigation past the first row this is critical.
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  return true;
}

function moveFocus(target: HTMLElement): void {
  const scrolled = scrollToElement(target);

  if (scrolled) {
    // Wait for smooth scroll to finish (~300ms) then focus.
    // Two rAF covers reflow; setTimeout adds buffer for smooth scroll animation.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          invalidateNow();
          target.focus({ preventScroll: true });
          rememberFocus(target);
        }, 160);
      });
    });
  } else {
    target.focus({ preventScroll: true });
    rememberFocus(target);
  }
}

// ── Focus memory ──────────────────────────────────────────────────────────────

const _containerMemory = new WeakMap<Element, HTMLElement>();

function rememberFocus(el: HTMLElement): void {
  const container = el.closest('[data-tv-container]');
  if (container) _containerMemory.set(container, el);
}

// ── Focus ring CSS ────────────────────────────────────────────────────────────

function injectFocusStyles(): void {
  if (document.getElementById('tv-nav-styles')) return;
  const style = document.createElement('style');
  style.id    = 'tv-nav-styles';
  style.textContent = `
    :root {
      --tv-ring-color:  #e50914;
      --tv-ring-width:  3px;
      --tv-ring-offset: 4px;
    }

    /* Anel de foco visível em modo TV */
    .tv-mode *:focus-visible,
    .tv-mode *:focus {
      outline: var(--tv-ring-width) solid var(--tv-ring-color) !important;
      outline-offset: var(--tv-ring-offset) !important;
      box-shadow: 0 0 0 calc(var(--tv-ring-width) + var(--tv-ring-offset))
                  rgba(229, 9, 20, 0.25) !important;
    }

    /* Cards de conteúdo com foco em TV */
    .tv-mode .content-card:focus,
    .tv-mode .content-card:focus-visible,
    .tv-mode [data-tv-card]:focus,
    .tv-mode [data-tv-card]:focus-visible {
      outline: 3px solid #e50914 !important;
      outline-offset: 2px !important;
      transform: translateY(-3px) scale(1.015) !important;
      border-color: rgba(229,9,20,0.6) !important;
      box-shadow: 0 8px 24px rgba(229,9,20,0.3), 0 0 0 5px rgba(229,9,20,0.15) !important;
      z-index: 2;
      position: relative;
    }

    /* Video: foco no elemento nativo sem override agressivo */
    .tv-mode video:focus,
    .tv-mode video:focus-visible {
      outline: 3px solid var(--tv-ring-color) !important;
      outline-offset: 0 !important;
      box-shadow: none !important;
    }

    /* Canal card */
    .tv-mode .channel-card:focus,
    .tv-mode .channel-card:focus-visible {
      outline: 3px solid #e50914 !important;
      outline-offset: 2px !important;
      border-color: rgba(229,9,20,0.6) !important;
      box-shadow: 0 0 0 5px rgba(229,9,20,0.15) !important;
    }
  `;
  document.head.appendChild(style);
}

// ── classifyActive ────────────────────────────────────────────────────────────

function classifyActive(el: HTMLElement | null): InputBehaviour {
  if (!el || el === document.body || el === document.documentElement) return 'none';

  const tag  = el.tagName.toLowerCase();
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? '';

  if (tag === 'video') return 'video';
  if (tag === 'textarea') return 'text';

  if (tag === 'input') {
    const textTypes   = new Set(['text','email','password','search','url','tel']);
    const choiceTypes = new Set(['checkbox','radio','range','number','date','time',
                                  'datetime-local','month','week','color']);
    if (textTypes.has(type) || type === '') return 'text';
    if (choiceTypes.has(type))              return 'choice';
    return 'other';
  }

  if (tag === 'select') return 'choice';
  return 'other';
}

// ── Debounce ──────────────────────────────────────────────────────────────────

const KEY_DEBOUNCE_MS = 80;
let _lastNavAt = 0;

function isDebounced(e: KeyboardEvent): boolean {
  if (!e.repeat) return false;
  const now = Date.now();
  if (now - _lastNavAt < KEY_DEBOUNCE_MS) return true;
  _lastNavAt = now;
  return false;
}

// ── Fullscreen helper (FIX 5) ─────────────────────────────────────────────────

function toggleFullscreen(el: HTMLElement): void {
  if (!document.fullscreenElement) {
    (el.closest('[data-tv-player]') ?? el).requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

// ── Instância global ──────────────────────────────────────────────────────────

let _activeCleanup: (() => void) | null = null;

/**
 * Inicializa a navegação D-pad para TV.
 * Retorna cleanup() para usar como retorno do useEffect.
 *
 * Uso em containers com memória de foco:
 *   <div data-tv-container>...</div>
 *
 * Uso para marcar o player:
 *   <div data-tv-player>
 *     <button data-modal-close>fechar</button>
 *     <video controls />
 *   </div>
 *
 * Uso para cards personalizados:
 *   <div data-tv-focusable tabIndex={0}>...</div>
 *   ou adicionar classe .content-card / .channel-card (tabIndex injectado automaticamente)
 */
export function initTVNavigation(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (_activeCleanup) { _activeCleanup(); _activeCleanup = null; }

  injectFocusStyles();
  // FIX (pedido explícito, mandatório): os efeitos visuais de foco/hover
  // pensados para D-pad de TV (.tv-mode) estavam a ser ligados em TODOS os
  // dispositivos ao montar TVNavigationInit — incluindo telemóvel, onde um
  // toque num card foca o elemento (tabIndex=0) e o destaque ficava "preso"
  // até outro toque, por não haver blur natural como haveria com rato.
  // Agora só liga .tv-mode (a classe que estas regras de CSS exigem —
  // ver globals.css) em dispositivos identificados como TV/set-top
  // (isLikelyTV(): user-agent de TV conhecida, ou sem touch + ponteiro
  // grosseiro/nenhum). O MOTOR de navegação por setas continua activo em
  // qualquer dispositivo logo a seguir (não depende de .tv-mode) — só o
  // destaque visual fica exclusivo de TV.
  if (isLikelyTV()) document.documentElement.classList.add('tv-mode');

  // Injectar tabIndex inicial
  injectTabIndex();

  // OTIMIZAÇÃO (produção): isto corria em TODAS as páginas, TODOS os
  // dispositivos (não só TV), observando `document.body` inteiro com
  // `attributes:true` — ou seja, disparava em CADA classe/estilo/aria-*
  // que qualquer componente da app mudasse (hover, toasts, dropdowns,
  // MUI, animações...), somando jank contínuo ao longo de toda a
  // navegação. `injectTabIndex()` corria de forma síncrona a cada
  // batch de mutações, cada chamada fazendo um `querySelectorAll` no
  // documento inteiro.
  // Agora: já não observamos `attributes` (só precisamos de saber
  // quando aparecem NÓS NOVOS, para lhes injectar tabIndex — mudanças
  // de estilo/aria não interessam a este sistema) e a injeção de
  // tabIndex passa a ser debounced (só corre depois do DOM assentar),
  // em vez de a cada mutação individual.
  let _injectTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { hasNewNodes = true; break; }
    }
    if (hasNewNodes) {
      if (_injectTimer) clearTimeout(_injectTimer);
      _injectTimer = setTimeout(injectTabIndex, 150);
    }
    scheduleInvalidate();
  });

  observer.observe(document.body, {
    childList: true,
    subtree:   true,
  });

  const onResize = () => scheduleInvalidate();
  const onScroll = () => scheduleInvalidate(350); // delay maior — aguarda fim do smooth scroll
  const onMouseDown = (e: MouseEvent) => {
    if ((e as PointerEvent).pointerType === undefined || (e as PointerEvent).pointerType === 'mouse') {
      _keyboardNavActive = false;
    }
  };

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('mousedown', onMouseDown, { passive: true, capture: true });

  // ── Handler principal ─────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ' || DIR_MAP[e.key]) _keyboardNavActive = true;

    const active = document.activeElement as HTMLElement | null;

    const behaviour = classifyActive(active);

    // ── FIX 2: VIDEO — deixar TUDO passar para o browser nativo ──────────
    // O browser nativo trata: setas (seek/volume), Enter (play/pause),
    // Space (pause), M (mute), F (fullscreen) — não interferir.
    if (behaviour === 'video' && e.key !== 'Escape' && e.key !== 'BrowserBack' && e.key !== 'GoBack') {
      // Só tratamos 'f'/'F' para fullscreen em TVs que não o suportam nativamente
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen(active!);
        e.preventDefault();
      }
      // Tudo o resto (Arrow*, Enter, Space, etc.) → browser nativo do <video>
      return;
    }

    // ── Escape / Back ─────────────────────────────────────────────────────
    if (e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack') {

      if (behaviour === 'text' || behaviour === 'choice') {
        active!.blur();
        e.preventDefault(); e.stopPropagation();
        return;
      }

      const player = getActivePlayer();
      if (player) {
        const closeBtn = player.querySelector<HTMLElement>(
          '[data-modal-close], [aria-label*="close" i], [aria-label*="fechar" i]'
        );
        if (closeBtn) { closeBtn.click(); e.preventDefault(); e.stopPropagation(); return; }
      }

      const modal = getActiveModal();
      if (modal) {
        const closeBtn = modal.querySelector<HTMLElement>(
          '[data-modal-close], [aria-label*="close" i], [aria-label*="fechar" i]'
        );
        if (closeBtn) { closeBtn.click(); e.preventDefault(); e.stopPropagation(); return; }
      }

      if (active && active !== document.body) {
        try { active.blur(); } catch { /* sem blur */ }
        e.preventDefault(); e.stopPropagation();
      }
      return;
    }

    // ── Enter ─────────────────────────────────────────────────────────────
    if (e.key === 'Enter') {
      if (!active || active === document.body) return;

      const tag = active.tagName.toLowerCase();
      if (tag === 'input') {
        const t = (active as HTMLInputElement).type;
        if (t === 'submit' || t === 'button') { active.click(); e.preventDefault(); e.stopPropagation(); return; }
        // Campo de texto: deixar o browser tratar (submit implícito do
        // formulário), não disparar click().
        if (behaviour === 'text') return;
      }
      // 🔴 FIX 7 — button/a/role=button/cards: disparamos click()
      // explicitamente em vez de confiar no browser traduzir Enter→click
      // sozinho. Nem todos os browsers embutidos de Smart TV (WebOS,
      // Tizen, browsers mais antigos) fazem essa tradução de forma
      // fiável para elementos focados via JS focus() — ao contrário do
      // Tab manual do utilizador. click() é idempotente aqui porque
      // preventDefault() já suprime a acção nativa correspondente.
      active.click();
      e.preventDefault(); e.stopPropagation();
      return;
    }

    // ── Space ─────────────────────────────────────────────────────────────
    if (e.key === ' ') {
      if (!active || active === document.body) return;

      const tag = active.tagName.toLowerCase();
      if (tag === 'button' || tag === 'select' || tag === 'textarea') return;
      if (tag === 'input') {
        const t = (active as HTMLInputElement).type;
        if (['checkbox','radio','submit','button'].includes(t)) return;
      }
      if (behaviour === 'text') return;
      active.click();
      e.preventDefault(); e.stopPropagation();
      return;
    }

    // ── Fullscreen (f/F) fora do video ────────────────────────────────────
    if (e.key === 'f' || e.key === 'F') {
      const player = getActivePlayer();
      if (player) {
        toggleFullscreen(player);
        e.preventDefault();
        return;
      }
    }

    // ── Navegação direcional ──────────────────────────────────────────────
    const dir = DIR_MAP[e.key];
    if (!dir) return;

    if (behaviour === 'text') {
      if (dir === 'left' || dir === 'right') return;
      if (isDebounced(e)) { e.preventDefault(); return; }
      active!.blur();
      const target = findNearest(active!, dir, getFocusables().filter(el => el !== active));
      if (target) moveFocus(target);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    if (behaviour === 'choice') {
      if (dir === 'up' || dir === 'down') return;
      if (isDebounced(e)) { e.preventDefault(); return; }
      const target = findNearest(active!, dir, getFocusables().filter(el => el !== active));
      if (target) moveFocus(target);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    if (behaviour === 'none') {
      // Preferir o primeiro focusable dentro de um container TV (ex: grelha do catálogo).
      // Se não houver container, usa o primeiro focusable global.
      const all       = getFocusables();
      const container = document.querySelector<HTMLElement>('[data-tv-container]');
      const first     = (container
        ? all.find(el => container.contains(el))
        : null) ?? all[0];
      if (first) moveFocus(first);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    if (isDebounced(e)) { e.preventDefault(); return; }

    const candidates = getFocusables();
    const target = findNearest(active!, dir, candidates);

    const finalTarget = (() => {
      if (!target) return null;
      const targetContainer = target.closest('[data-tv-container]');
      // Só restaurar a memória de foco quando estamos a ENTRAR neste
      // container vindo de fora dele — navegar entre irmãos dentro do
      // MESMO container usa sempre o alvo geométrico real (target).
      const activeContainer = active?.closest('[data-tv-container]') ?? null;
      if (targetContainer && targetContainer !== activeContainer) {
        const mem = _containerMemory.get(targetContainer);
        if (mem && document.contains(mem) && isInDOMAndFocusable(mem) && isOnTop(mem)) return mem;
      }
      return target;
    })();

    if (finalTarget) {
      // Há um próximo elemento focável nesta direcção: navegamos para ele
      // e travamos o comportamento nativo (não queremos scroll duplo).
      moveFocus(finalTarget);
      e.preventDefault();
      e.stopPropagation();
    }
    // 🔴 FIX 6 — Sem candidato focável nesta direcção (ex: fim da grelha,
    // bloco de texto longo sem botões, página Legal, descrição de
    // conteúdo) NÃO prevenimos o default: deixamos o browser fazer o seu
    // scroll nativo da seta, para o utilizador continuar a ver o resto do
    // conteúdo mesmo sem haver mais nada para focar. Antes, o
    // preventDefault() era chamado sempre aqui, travando o scroll assim
    // que se esgotavam os elementos focáveis numa direcção.
  };

  document.addEventListener('keydown', onKeyDown, false);

  const cleanup = (): void => {
    document.removeEventListener('keydown', onKeyDown, false);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('mousedown', onMouseDown, true);
    observer.disconnect();
    if (_invalidateTimer) { clearTimeout(_invalidateTimer); _invalidateTimer = null; }
    if (_injectTimer)     { clearTimeout(_injectTimer);     _injectTimer     = null; }
    document.documentElement.classList.remove('tv-mode');
    _cacheValid = false;
  };

  _activeCleanup = cleanup;
  return cleanup;
}

/** Destrói a instância activa. Idempotente. */
export function destroyTVNavigation(): void {
  if (_activeCleanup) { _activeCleanup(); _activeCleanup = null; }
}

/**
 * Foca o primeiro elemento focusável dentro de [data-tv-container]
 * (ou o primeiro focusável global se não houver container).
 *
 * Chamar no useEffect das páginas com grelha de cards:
 *
 *   useEffect(() => {
 *     if (isLikelyTV()) focusFirstInPage();
 *   }, [items]); // após os items carregarem
 */
export function focusFirstInPage(): void {
  if (typeof window === 'undefined') return;

  // Pequeno delay para garantir que o DOM está estável após render
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      invalidateNow();
      const all       = getFocusables();
      const container = document.querySelector<HTMLElement>('[data-tv-container]');
      const first     = (container
        ? all.find(el => container.contains(el))
        : null) ?? all[0];
      if (first) moveFocus(first);
    });
  });
}

/**
 * Detecta TV ou set-top box.
 */
export function isLikelyTV(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

  const ua = navigator.userAgent.toLowerCase();
  const tvUA = [
    'smart-tv','smarttv','tizen','webos','hbbtv','netcast',
    'viera','bravia','aquos','regza','playstation','xbox',
    'roku','firetv','fire tv','androidtv','googletv','appletv',
    'crkey','nettv','maple',
  ];
  if (tvUA.some(s => ua.includes(s))) return true;

  const noTouch  = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
  const mqCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mqNone   = window.matchMedia?.('(pointer: none)').matches   ?? false;
  return noTouch && (mqCoarse || mqNone);
}