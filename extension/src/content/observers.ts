/**
 * LightSession for ChatGPT - Observers
 * MutationObserver and scroll tracking with debouncing/throttling
 */

import { TIMING, DOM } from '../shared/constants';
import { logDebug } from '../shared/logger';
import type { TrimMode } from '../shared/types';

/**
 * Create debounced MutationObserver
 * Batches rapid mutations into single callback invocation
 */
export function createDebouncedObserver(
  callback: () => void,
  debounceMs: number = TIMING.DEBOUNCE_MS
): MutationObserver {
  let timeoutId: number | null = null;

  const debouncedCallback = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback();
    }, debounceMs);
  };

  return new MutationObserver(debouncedCallback);
}

/**
 * Create microtask-based MutationObserver for BOOT mode
 * Uses queueMicrotask to coalesce mutations and execute before next paint
 *
 * Key insight: MutationObserver callback already runs as microtask.
 * Using queueMicrotask inside coalesces multiple synchronous DOM changes
 * into a single trim evaluation, executing BEFORE the browser paints.
 */
export function createMicrotaskObserver(callback: () => void): MutationObserver {
  let scheduled = false;

  const microtaskCallback = (): void => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      callback();
    });
  };

  return new MutationObserver(microtaskCallback);
}

/**
 * Create MutationObserver with adaptive scheduling based on trim mode
 */
export function createAdaptiveObserver(
  callback: () => void,
  mode: TrimMode
): MutationObserver {
  if (mode === 'BOOT') {
    return createMicrotaskObserver(callback);
  }
  return createDebouncedObserver(callback);
}

/**
 * Setup scroll tracking with throttling
 * Updates isAtBottom flag and triggers callback
 */
export function setupScrollTracking(
  scrollContainer: HTMLElement,
  onScrollChange: (isAtBottom: boolean) => void
): () => void {
  let lastCheckTime = 0;
  let rafId: number | null = null;

  const checkScroll = (): void => {
    const now = performance.now();
    if (now - lastCheckTime < TIMING.SCROLL_THROTTLE_MS) {
      return;
    }

    lastCheckTime = now;
    const isAtBottom = checkIsAtBottom(scrollContainer);
    onScrollChange(isAtBottom);
  };

  const throttledScroll = (): void => {
    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      checkScroll();
    });
  };

  scrollContainer.addEventListener('scroll', throttledScroll, { passive: true });

  // Initial check
  checkScroll();

  // Return cleanup function
  return () => {
    scrollContainer.removeEventListener('scroll', throttledScroll);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
}

/**
 * Check if scroll container is at bottom
 */
function checkIsAtBottom(container: HTMLElement): boolean {
  // Handle document.documentElement (window scroll)
  if (container === document.documentElement) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    const isAtBottom = scrollTop + clientHeight + DOM.BOTTOM_THRESHOLD_PX >= scrollHeight;
    logDebug(
      `checkIsAtBottom (window): ${isAtBottom} (${scrollTop + clientHeight} >= ${scrollHeight - DOM.BOTTOM_THRESHOLD_PX})`
    );
    return isAtBottom;
  }

  // Handle regular scrollable elements
  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtBottom = scrollTop + clientHeight + DOM.BOTTOM_THRESHOLD_PX >= scrollHeight;
  logDebug(
    `checkIsAtBottom: ${isAtBottom} (${scrollTop + clientHeight} >= ${scrollHeight - DOM.BOTTOM_THRESHOLD_PX})`
  );
  return isAtBottom;
}
