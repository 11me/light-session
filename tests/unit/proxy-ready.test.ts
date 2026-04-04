import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProxyReady,
  hasProxyReadyMarker,
  isProxyReadySatisfied,
  markProxyReady,
} from '../../extension/src/shared/proxy-ready';

describe('proxy-ready marker', () => {
  beforeEach(() => {
    clearProxyReady();
  });

  it('marks and clears the durable proxy-ready marker on the document root', () => {
    expect(hasProxyReadyMarker()).toBe(false);
    markProxyReady();
    expect(hasProxyReadyMarker()).toBe(true);
    clearProxyReady();
    expect(hasProxyReadyMarker()).toBe(false);
  });

  it('treats the marker as sufficient even when the postMessage handshake was missed', () => {
    expect(isProxyReadySatisfied(false)).toBe(false);
    markProxyReady();
    expect(isProxyReadySatisfied(false)).toBe(true);
  });

  it('treats an observed postMessage handshake as sufficient without the marker', () => {
    expect(isProxyReadySatisfied(true)).toBe(true);
  });
});
