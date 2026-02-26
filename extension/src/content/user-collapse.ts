/**
 * LightSession for ChatGPT - Collapse long chat messages (presentation-only)
 *
 * Constraints:
 * - Do not truncate or rewrite message text content (no innerHTML rewriting).
 * - Clamp only the text container so attachments remain visible.
 * - Target chatgpt.com + chat.openai.com using observed DOM anchors.
 */

import { logDebug, logWarn } from '../shared/logger';

const STYLE_ID = 'lightsession-user-collapse-styles';
const PROCESSED_ATTR = 'data-ls-uc-processed';
const STATE_ATTR = 'data-ls-uc-state'; // "collapsed" | "expanded"

const COLLAPSIBLE_ROOT_SELECTOR =
  '[data-message-author-role="user"][data-message-id], [data-message-author-role="assistant"][data-message-id]';
const ANY_ROLE_ROOT_SELECTOR = '[data-message-author-role][data-message-id]';
const BUBBLE_SELECTOR = '.user-message-bubble-color';
const TEXT_SELECTORS = ['.whitespace-pre-wrap', '.markdown.prose', '.markdown', '.prose'] as const;

const COLLAPSED_MAX_HEIGHT_PX = 240;
const PINNED_TO_BOTTOM_PX = 120;

type TeardownFn = () => void;

function isTargetHost(): boolean {
  const h = location.hostname;
  return h === 'chatgpt.com' || h === 'chat.openai.com';
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* LightSession: chat message collapse */
.ls-uc-bubble { position: relative; }
.ls-uc-text { position: relative; }

.ls-uc-toggle {
  position: absolute;
  right: 10px;
  bottom: 8px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(0,0,0,.14);
  border-radius: 9999px;
  padding: 4px 10px;
  font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: rgba(255,255,255,.92);
  color: rgba(17,24,39,.92);
  backdrop-filter: blur(6px);
  cursor: pointer;
}
.ls-uc-toggle:hover { background: rgba(255,255,255,.98); }
.ls-uc-toggle:focus-visible {
  outline: 2px solid rgba(37, 99, 235, .9);
  outline-offset: 2px;
}

/* Clamp only the text container */
.ls-uc-bubble[${STATE_ATTR}="collapsed"] .ls-uc-text {
  max-height: ${COLLAPSED_MAX_HEIGHT_PX}px;
  overflow: hidden;
}
.ls-uc-bubble[${STATE_ATTR}="expanded"] .ls-uc-text {
  max-height: 99999px; /* large so content isn't truncated; allows transition */
  overflow: visible;
}
.ls-uc-bubble .ls-uc-text { transition: max-height 180ms ease; }
@media (prefers-reduced-motion: reduce) {
  .ls-uc-bubble .ls-uc-text { transition: none; }
}

/* Fade overlay (pseudo-element; pointer-events none) */
.ls-uc-bubble[${STATE_ATTR}="collapsed"] .ls-uc-text::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 54px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0,0,0,0), var(--ls-uc-fade-to, rgba(255,255,255,1)));
}
`;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

function getMain(): HTMLElement | null {
  return document.querySelector('main');
}

function findTextContainer(bubble: Element): HTMLElement | null {
  for (const sel of TEXT_SELECTORS) {
    const el = bubble.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function safeIdFragment(input: string): string {
  const out = input.replace(/[^a-zA-Z0-9_-]/g, '_');
  return out.length > 0 ? out : 'x';
}

function findLca(elements: Element[]): Element | null {
  if (elements.length === 0) return null;
  // noUncheckedIndexedAccess: elements[0] is Element | undefined
  const first = elements[0];
  if (!first) return null;
  let current: Element | null = first;
  while (current) {
    let ok = true;
    // Avoid indexed access to keep types tight under noUncheckedIndexedAccess.
    for (const el of elements.slice(1)) {
      if (!current.contains(el)) {
        ok = false;
        break;
      }
    }
    if (ok) return current;
    current = current.parentElement;
  }
  return null;
}

function deriveMessageListContainer(main: HTMLElement): HTMLElement {
  // Tiered selectors first (fast).
  const byTurns = main.querySelector<HTMLElement>('[data-testid="conversation-turn"]');
  if (byTurns?.parentElement) return byTurns.parentElement;

  const byTurnsContainer = main.querySelector<HTMLElement>('[data-testid="conversation-turns"]');
  if (byTurnsContainer) return byTurnsContainer;

  // LCA fallback using observed anchors.
  const roots = Array.from(main.querySelectorAll<HTMLElement>(ANY_ROLE_ROOT_SELECTOR)).slice(0, 12);
  const lca = findLca(roots);
  if (lca && lca instanceof HTMLElement) return lca;

  // Last resort: main itself.
  return main;
}

function deriveScrollContainer(start: HTMLElement): HTMLElement {
  // Prefer a scrollable ancestor near the message list, otherwise fall back to scrollingElement.
  let el: HTMLElement | null = start;
  while (el && el !== document.body && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const oy = cs.overflowY;
    const scrollable = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    if (scrollable) return el;
    el = el.parentElement;
  }

  const se = document.scrollingElement;
  if (se && se instanceof HTMLElement) return se;
  return document.documentElement;
}

function isPinnedToBottom(scroller: HTMLElement): boolean {
  const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  return remaining < PINNED_TO_BOTTOM_PX;
}

function preserveScrollAfterHeightChange(
  scroller: HTMLElement,
  prevScrollTop: number,
  prevScrollHeight: number,
  wasPinned: boolean
): void {
  const nextScrollHeight = scroller.scrollHeight;
  if (wasPinned) {
    scroller.scrollTop = Math.max(0, nextScrollHeight - scroller.clientHeight);
    return;
  }
  const delta = nextScrollHeight - prevScrollHeight;
  scroller.scrollTop = prevScrollTop + delta;
}

function ensureButton(bubble: HTMLElement, textId: string): HTMLButtonElement {
  let btn = bubble.querySelector<HTMLButtonElement>('button.ls-uc-toggle');
  if (btn) {
    btn.setAttribute('aria-controls', textId);
    return btn;
  }

  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ls-uc-toggle';
  btn.setAttribute('aria-controls', textId);
  bubble.appendChild(btn);
  return btn;
}

function updateButtonUi(btn: HTMLButtonElement, expanded: boolean): void {
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.textContent = expanded ? 'Show less' : 'Show more';
}

function applyFadeColor(bubble: HTMLElement, text: HTMLElement): void {
  // Use the computed background of the bubble to blend the fade overlay.
  const bg = getComputedStyle(bubble).backgroundColor;
  if (bg) {
    text.style.setProperty('--ls-uc-fade-to', bg);
  }
}

function removeCollapseUi(root: HTMLElement, bubble: HTMLElement, text: HTMLElement): void {
  bubble.removeAttribute(STATE_ATTR);
  bubble.classList.remove('ls-uc-bubble');
  bubble.querySelector('button.ls-uc-toggle')?.remove();
  text.classList.remove('ls-uc-text');
  text.style.removeProperty('--ls-uc-fade-to');
  root.removeAttribute(PROCESSED_ATTR);
}

function ensureCollapseUi(root: HTMLElement, bubble: HTMLElement, text: HTMLElement): void {
  root.setAttribute(PROCESSED_ATTR, '1');

  bubble.classList.add('ls-uc-bubble');
  text.classList.add('ls-uc-text');
  applyFadeColor(bubble, text);

  const messageId = root.getAttribute('data-message-id') || '';
  const textId = text.id || `ls-uc-text-${safeIdFragment(messageId)}`;
  text.id = textId;

  if (!bubble.getAttribute(STATE_ATTR)) {
    bubble.setAttribute(STATE_ATTR, 'collapsed');
  }

  const btn = ensureButton(bubble, textId);
  updateButtonUi(btn, bubble.getAttribute(STATE_ATTR) === 'expanded');

  logDebug('Collapse applied for message:', messageId);
}

function deriveBubbleContainer(root: HTMLElement, text: HTMLElement): HTMLElement {
  const knownBubble = root.querySelector<HTMLElement>(BUBBLE_SELECTOR);
  if (knownBubble) return knownBubble;

  // Assistant turns typically don't use the user bubble class.
  // Use the text container's parent so button positioning is localized to the message content.
  return text.parentElement instanceof HTMLElement ? text.parentElement : root;
}

function processCollapsibleMessageRoot(root: HTMLElement): void {
  const text = findTextContainer(root);
  if (!text) return;

  const bubble = deriveBubbleContainer(root, text);

  // Measure for "long" before clamping. Caller batches this in rAF.
  const fullHeight = text.scrollHeight;
  const isLong = fullHeight > COLLAPSED_MAX_HEIGHT_PX + 24;
  const hasUi = root.hasAttribute(PROCESSED_ATTR) || !!bubble.querySelector('button.ls-uc-toggle');

  if (!isLong) {
    if (hasUi) removeCollapseUi(root, bubble, text);
    return;
  }

  ensureCollapseUi(root, bubble, text);
}

function collectCollapsibleRootsFromAddedNode(node: unknown): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return [];

  // Avoid duplicate work; pendingRoots is a Set but array creation can still be expensive on large mutation batches.
  if (node.matches(COLLAPSIBLE_ROOT_SELECTOR)) return [node];

  const out = new Set<HTMLElement>();

  const closest = node.closest<HTMLElement>(COLLAPSIBLE_ROOT_SELECTOR);
  if (closest) out.add(closest);

  for (const r of Array.from(node.querySelectorAll<HTMLElement>(COLLAPSIBLE_ROOT_SELECTOR))) out.add(r);

  return Array.from(out);
}

export interface UserCollapseController {
  enable: () => void;
  teardown: TeardownFn;
}

export function installUserCollapse(): UserCollapseController {
  let enabled = false;
  let observer: MutationObserver | null = null;
  let container: HTMLElement | null = null;
  let scroller: HTMLElement | null = null;
  let mainWaitObserver: MutationObserver | null = null;
  let reattachObserver: MutationObserver | null = null;
  let reattachScheduled = false;
  const pendingRoots = new Set<HTMLElement>();
  let rafScheduled = false;
  let onDocClick: ((ev: MouseEvent) => void) | null = null;

  const scheduleProcess = (): void => {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!enabled) return;
      const wasPinned = scroller ? isPinnedToBottom(scroller) : false;

      for (const root of pendingRoots) {
        processCollapsibleMessageRoot(root);
      }
      pendingRoots.clear();

      if (scroller && wasPinned) {
        // Keep user pinned to bottom if they were pinned before we changed layout.
        scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      }
    });
  };

  const scheduleEnsureAttached = (): void => {
    if (reattachScheduled) return;
    reattachScheduled = true;
    requestAnimationFrame(() => {
      reattachScheduled = false;
      if (!enabled) return;
      try {
        ensureAttached();
      } catch (e) {
        logWarn('Message collapse failed to re-attach:', e);
      }
    });
  };

  const attachObserverTo = (nextContainer: HTMLElement): void => {
    observer?.disconnect();
    observer = null;

    container = nextContainer;
    scroller = deriveScrollContainer(container);

    observer = new MutationObserver((mutations: MutationRecord[]) => {
      // Process added nodes and attribute changes (SPA can recycle DOM nodes across chats).
      for (const m of mutations) {
        if (m.type === 'childList') {
          // Avoid for..of over NodeList (requires DOM iterable lib typings).
          for (let i = 0; i < m.addedNodes.length; i++) {
            const n = m.addedNodes[i];
            const roots = collectCollapsibleRootsFromAddedNode(n);
            for (const r of roots) pendingRoots.add(r);
          }
          continue;
        }

        if (m.type === 'attributes') {
          if (m.target instanceof HTMLElement) {
            // Attribute changes are usually on the root node, but can also happen on wrappers.
            // Include descendants to handle node recycling across chats.
            if (m.target.matches(COLLAPSIBLE_ROOT_SELECTOR)) {
              pendingRoots.add(m.target);
            } else {
              const roots = collectCollapsibleRootsFromAddedNode(m.target);
              for (const r of roots) pendingRoots.add(r);
            }
          }
          continue;
        }
      }
      if (pendingRoots.size > 0) scheduleProcess();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-message-author-role', 'data-message-id'],
    });

    // Initial scan.
    const initial = Array.from(container.querySelectorAll<HTMLElement>(COLLAPSIBLE_ROOT_SELECTOR));
    for (const r of initial) pendingRoots.add(r);
    if (pendingRoots.size > 0) scheduleProcess();
  };

  const ensureAttached = (): void => {
    const main = getMain();
    if (!main) {
      // ChatGPT is a SPA; when enabled early we may not yet have <main>.
      // Attach a short-lived observer to wait for it, then bind to the current container.
      if (!mainWaitObserver) {
        mainWaitObserver = new MutationObserver(() => {
          if (!enabled) return;
          if (getMain()) {
            mainWaitObserver?.disconnect();
            mainWaitObserver = null;
            scheduleEnsureAttached();
          }
        });
        mainWaitObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
      return;
    }

    if (mainWaitObserver) {
      mainWaitObserver.disconnect();
      mainWaitObserver = null;
    }

    const nextContainer = deriveMessageListContainer(main);
    const nextScroller = deriveScrollContainer(nextContainer);

    // Common case: still attached to the current container; just keep scroller fresh.
    if (container === nextContainer && observer && container.isConnected) {
      scroller = nextScroller;
      return;
    }

    attachObserverTo(nextContainer);
  };

  const enableFn = (): void => {
    if (!isTargetHost()) return;

    // Allow repeated calls (e.g. after SPA navigation) to re-attach to the active chat container.
    enabled = true;
    ensureStyles();

    // Watch for React replacing the main/container nodes after navigation.
    // If our current container is detached, proactively re-attach.
    if (!reattachObserver) {
      reattachObserver = new MutationObserver(() => {
        if (!enabled) return;
        if (container && !container.isConnected) {
          scheduleEnsureAttached();
        }
      });
      reattachObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Single delegated click handler for toggles.
    if (!onDocClick) {
      onDocClick = (ev: MouseEvent): void => {
        if (!scroller) return;
        const target = ev.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest<HTMLButtonElement>('button.ls-uc-toggle');
        if (!btn) return;
        const bubble = btn.closest<HTMLElement>('.ls-uc-bubble');
        if (!bubble) return;

        const wasPinned = isPinnedToBottom(scroller);
        const prevScrollTop = scroller.scrollTop;
        const prevScrollHeight = scroller.scrollHeight;

        const expanded = bubble.getAttribute(STATE_ATTR) === 'expanded';
        bubble.setAttribute(STATE_ATTR, expanded ? 'collapsed' : 'expanded');
        updateButtonUi(btn, !expanded);

        requestAnimationFrame(() => {
          preserveScrollAfterHeightChange(scroller!, prevScrollTop, prevScrollHeight, wasPinned);
        });
      };
      document.addEventListener('click', onDocClick, true);
    }

    try {
      ensureAttached();
    } catch (e) {
      logWarn('Message collapse failed to attach:', e);
    }
  };

  const teardownFn = (): void => {
    enabled = false;
    rafScheduled = false;
    pendingRoots.clear();
    reattachScheduled = false;

    if (onDocClick) {
      document.removeEventListener('click', onDocClick, true);
      onDocClick = null;
    }

    if (mainWaitObserver) {
      mainWaitObserver.disconnect();
      mainWaitObserver = null;
    }

    if (reattachObserver) {
      reattachObserver.disconnect();
      reattachObserver = null;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove UI affordances/classes.
    const main = getMain();
    const scope = main || document;
    for (const root of Array.from(scope.querySelectorAll<HTMLElement>(COLLAPSIBLE_ROOT_SELECTOR))) {
      const text = findTextContainer(root);
      if (!text) continue;
      const bubble = deriveBubbleContainer(root, text);
      removeCollapseUi(root, bubble, text);
    }

    container = null;
    scroller = null;

    removeStyles();
  };

  return { enable: enableFn, teardown: teardownFn };
}
