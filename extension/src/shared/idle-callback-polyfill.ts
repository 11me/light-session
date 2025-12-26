/**
 * LightSession for ChatGPT - requestIdleCallback Polyfill
 * Provides fallback for browsers that don't support requestIdleCallback
 */

/**
 * Extended Window interface for idle callback polyfill.
 * Allows type-safe assignment of polyfilled functions.
 */
interface WindowWithIdleCallback extends Window {
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback: (id: number) => void;
}

// Cast window once at module level for type safety
const windowWithIdle = window as WindowWithIdleCallback;

// Polyfill for requestIdleCallback
if (typeof requestIdleCallback === 'undefined') {
  windowWithIdle.requestIdleCallback = (
    callback: IdleRequestCallback,
    _options?: IdleRequestOptions
  ): number => {
    const start = Date.now();
    return window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  };
}

if (typeof cancelIdleCallback === 'undefined') {
  windowWithIdle.cancelIdleCallback = (id: number): void => {
    clearTimeout(id);
  };
}
