/**
 * Unit tests for user-collapse.ts (Vitest + happy-dom)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { installUserCollapse } from '../../extension/src/content/user-collapse';

type MockMutation = {
  type: string;
  addedNodes: Node[];
  target?: Node;
};

class MockMutationObserver {
  static instances: MockMutationObserver[] = [];
  cb: MutationCallback;
  disconnected = false;
  observed: Array<{ target: Node; options?: MutationObserverInit }> = [];

  constructor(cb: MutationCallback) {
    this.cb = cb;
    MockMutationObserver.instances.push(this);
  }

  observe(target: Node, options?: MutationObserverInit): void {
    this.observed.push({ target, options });
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(mutations: MockMutation[]): void {
    this.cb(mutations as unknown as MutationRecord[], this as unknown as MutationObserver);
  }
}

function mockLayout(el: HTMLElement, opts: { scrollHeight?: number; clientHeight?: number; rectHeight?: number }) {
  if (typeof opts.scrollHeight === 'number') {
    Object.defineProperty(el, 'scrollHeight', {
      value: opts.scrollHeight,
      configurable: true,
    });
  }
  if (typeof opts.clientHeight === 'number') {
    Object.defineProperty(el, 'clientHeight', {
      value: opts.clientHeight,
      configurable: true,
    });
  }
  if (typeof opts.rectHeight === 'number') {
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: opts.rectHeight!,
        top: 0,
        left: 0,
        right: 100,
        bottom: opts.rectHeight!,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

describe('user-collapse', () => {
  const originalMO = globalThis.MutationObserver;
  let lastCtrl: { teardown: () => void } | null = null;

  function getObserverForContainer(container: HTMLElement): MockMutationObserver {
    const mo = MockMutationObserver.instances.find((x) =>
      x.observed.some((o) => o.target === container)
    );
    if (!mo) {
      throw new Error('Expected a MutationObserver to be attached to the container');
    }
    return mo;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    MockMutationObserver.instances = [];
    lastCtrl = null;

    // Ensure module considers this a supported host.
    window.location.href = 'https://chatgpt.com/';

    // Stub MutationObserver + rAF (run immediately).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.MutationObserver = MockMutationObserver as any;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    lastCtrl?.teardown();
    lastCtrl = null;
    globalThis.MutationObserver = originalMO;
    vi.restoreAllMocks();
  });

  it('adds toggle + collapses by default for long user messages', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns">
          <div data-message-author-role="user" data-message-id="m1">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Hello</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 2000, clientHeight: 800 });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 1200, clientHeight: 120, rectHeight: 1200 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    const btn = bubble.querySelector('button.ls-uc-toggle') as HTMLButtonElement;

    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(bubble.getAttribute('data-ls-uc-state')).toBe('collapsed');
    expect(btn.getAttribute('aria-controls')).toBe(text.id);
    expect(text.classList.contains('ls-uc-text')).toBe(true);
  });

  it('does not add toggle for short user messages', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns">
          <div data-message-author-role="user" data-message-id="m2">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Short</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 1200, clientHeight: 800 });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 160, clientHeight: 160, rectHeight: 160 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    expect(bubble.querySelector('button.ls-uc-toggle')).toBeNull();
  });

  it('toggle flips aria-expanded + state attribute', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns">
          <div data-message-author-role="user" data-message-id="m3">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Long</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 2000, clientHeight: 800 });
    Object.defineProperty(main, 'scrollTop', { value: 100, writable: true, configurable: true });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 1200, clientHeight: 120, rectHeight: 1200 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    const btn = bubble.querySelector('button.ls-uc-toggle') as HTMLButtonElement;

    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(bubble.getAttribute('data-ls-uc-state')).toBe('expanded');

    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(bubble.getAttribute('data-ls-uc-state')).toBe('collapsed');
  });

  it('does not duplicate toggles when processing the same message again', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns" id="turns">
          <div data-message-author-role="user" data-message-id="m4" id="root">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Long</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 2000, clientHeight: 800 });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 1200, clientHeight: 120, rectHeight: 1200 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    expect(bubble.querySelectorAll('button.ls-uc-toggle').length).toBe(1);

    const turns = document.getElementById('turns') as HTMLElement;
    const mo = getObserverForContainer(turns);
    const root = document.getElementById('root') as HTMLElement;
    mo.trigger([{ type: 'childList', addedNodes: [root] }]);

    expect(bubble.querySelectorAll('button.ls-uc-toggle').length).toBe(1);
  });

  it('teardown disconnects observer and removes toggles', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns">
          <div data-message-author-role="user" data-message-id="m5">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Long</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 2000, clientHeight: 800 });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 1200, clientHeight: 120, rectHeight: 1200 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    expect(bubble.querySelector('button.ls-uc-toggle')).not.toBeNull();

    const turns = document.querySelector('[data-testid="conversation-turns"]') as HTMLElement;
    const mo = getObserverForContainer(turns);
    ctrl.teardown();
    lastCtrl = null;

    expect(mo.disconnected).toBe(true);
    expect(bubble.querySelector('button.ls-uc-toggle')).toBeNull();
    expect(document.getElementById('lightsession-user-collapse-styles')).toBeNull();
  });

  it('processes user roots that become eligible via attribute changes (SPA recycling)', () => {
    document.body.innerHTML = `
      <main style="overflow-y:auto">
        <div data-testid="conversation-turns">
          <div data-message-author-role="user" id="root">
            <div class="user-message-bubble-color">
              <div class="whitespace-pre-wrap">Long</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const main = document.querySelector('main') as HTMLElement;
    mockLayout(main, { scrollHeight: 2000, clientHeight: 800 });

    const text = document.querySelector('.whitespace-pre-wrap') as HTMLElement;
    mockLayout(text, { scrollHeight: 1200, clientHeight: 120, rectHeight: 1200 });

    const ctrl = installUserCollapse();
    ctrl.enable();
    lastCtrl = ctrl;

    const bubble = document.querySelector('.user-message-bubble-color') as HTMLElement;
    expect(bubble.querySelector('button.ls-uc-toggle')).toBeNull();

    // Simulate SPA updating attributes after initial DOM insertion.
    const root = document.getElementById('root') as HTMLElement;
    root.setAttribute('data-message-id', 'm6');

    const turns = document.querySelector('[data-testid="conversation-turns"]') as HTMLElement;
    const mo = getObserverForContainer(turns);
    mo.trigger([{ type: 'attributes', addedNodes: [], target: root }]);

    expect(bubble.querySelector('button.ls-uc-toggle')).not.toBeNull();
    expect(bubble.getAttribute('data-ls-uc-state')).toBe('collapsed');
  });
});
