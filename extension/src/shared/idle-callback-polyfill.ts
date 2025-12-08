/**
 * LightSession for ChatGPT - requestIdleCallback Polyfill
 * Provides fallback for browsers that don't support requestIdleCallback
 */

// Polyfill for requestIdleCallback
if (typeof requestIdleCallback === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).requestIdleCallback = (callback: IdleRequestCallback, _options?: IdleRequestOptions) => {
    const start = Date.now();
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  };
}

if (typeof cancelIdleCallback === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).cancelIdleCallback = (id: number) => {
    clearTimeout(id);
  };
}
