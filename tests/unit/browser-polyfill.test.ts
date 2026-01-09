/**
 * Unit tests for browser-polyfill.ts - Cross-browser API compatibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('browser-polyfill', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('API detection', () => {
    it('uses browser API when available (Firefox)', async () => {
      const mockBrowser = {
        runtime: { id: 'firefox-extension' },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      expect(api).toBe(mockBrowser);
    });

    it('falls back to chrome API when browser is undefined (Chrome)', async () => {
      const mockChrome = {
        runtime: { id: 'chrome-extension' },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', undefined);
      vi.stubGlobal('chrome', mockChrome);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      expect(api).toBe(mockChrome);
    });

    it('prefers browser over chrome when both are available', async () => {
      const mockBrowser = {
        runtime: { id: 'browser-api' },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };
      const mockChrome = {
        runtime: { id: 'chrome-api' },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', mockChrome);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      expect(api).toBe(mockBrowser);
    });
  });

  describe('API functionality', () => {
    it('exposes storage.local.get', async () => {
      const mockGet = vi.fn().mockResolvedValue({ key: 'value' });
      const mockBrowser = {
        storage: { local: { get: mockGet, set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      const result = await api.storage.local.get('key');
      expect(mockGet).toHaveBeenCalledWith('key');
      expect(result).toEqual({ key: 'value' });
    });

    it('exposes storage.local.set', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = {
        storage: { local: { get: vi.fn(), set: mockSet } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      await api.storage.local.set({ key: 'value' });
      expect(mockSet).toHaveBeenCalledWith({ key: 'value' });
    });

    it('exposes runtime.sendMessage', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ response: 'ok' });
      const mockBrowser = {
        runtime: { sendMessage: mockSendMessage },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      const result = await api.runtime.sendMessage({ type: 'TEST' });
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'TEST' });
      expect(result).toEqual({ response: 'ok' });
    });

    it('exposes runtime.getURL', async () => {
      const mockGetURL = vi.fn().mockReturnValue('moz-extension://id/path');
      const mockBrowser = {
        runtime: { getURL: mockGetURL },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      const result = api.runtime.getURL('path');
      expect(mockGetURL).toHaveBeenCalledWith('path');
      expect(result).toBe('moz-extension://id/path');
    });

    it('exposes tabs.create', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockBrowser = {
        tabs: { create: mockCreate },
        storage: { local: { get: vi.fn(), set: vi.fn() } },
      };

      vi.stubGlobal('browser', mockBrowser);
      vi.stubGlobal('chrome', undefined);

      const { default: api } = await import('../../extension/src/shared/browser-polyfill');

      const result = await api.tabs.create({ url: 'https://example.com' });
      expect(mockCreate).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(result).toEqual({ id: 1 });
    });
  });
});
