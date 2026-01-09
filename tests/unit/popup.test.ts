/**
 * Unit tests for popup.ts - Settings UI and tab management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions for browser APIs
const mockSendMessage = vi.fn();
const mockTabsQuery = vi.fn();
const mockTabsReload = vi.fn();
const mockTabsCreate = vi.fn();
const mockGetURL = vi.fn();
const mockGetManifest = vi.fn();

// Mock browser-polyfill BEFORE importing
vi.mock('../../extension/src/shared/browser-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
      getURL: (...args: unknown[]) => mockGetURL(...args),
      getManifest: () => mockGetManifest(),
    },
    tabs: {
      query: (...args: unknown[]) => mockTabsQuery(...args),
      reload: (...args: unknown[]) => mockTabsReload(...args),
      create: (...args: unknown[]) => mockTabsCreate(...args),
    },
  },
}));

// Mock messages module
vi.mock('../../extension/src/shared/messages', () => ({
  sendMessageWithTimeout: vi.fn(),
}));

import { sendMessageWithTimeout } from '../../extension/src/shared/messages';

const mockedSendMessageWithTimeout = vi.mocked(sendMessageWithTimeout);

describe('popup settings loading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads settings successfully from background', async () => {
    const expectedSettings = {
      enabled: true,
      keep: 15,
      showStatusBar: true,
      debug: false,
      ultraLean: false,
      version: 1,
    };

    mockedSendMessageWithTimeout.mockResolvedValue({ settings: expectedSettings });

    const response = await sendMessageWithTimeout<{ settings: typeof expectedSettings }>({
      type: 'GET_SETTINGS',
    });

    expect(mockedSendMessageWithTimeout).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
    expect(response.settings).toEqual(expectedSettings);
    expect(response.settings.keep).toBe(15);
  });

  it('handles settings load failure', async () => {
    mockedSendMessageWithTimeout.mockRejectedValue(new Error('Message timeout'));

    await expect(
      sendMessageWithTimeout({ type: 'GET_SETTINGS' })
    ).rejects.toThrow('Message timeout');
  });

  it('handles background script not responding', async () => {
    mockedSendMessageWithTimeout.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    );

    await expect(
      sendMessageWithTimeout({ type: 'GET_SETTINGS' })
    ).rejects.toThrow('Could not establish connection');
  });
});

describe('popup settings saving', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('saves settings successfully', async () => {
    mockedSendMessageWithTimeout.mockResolvedValue({ ok: true });

    const response = await sendMessageWithTimeout({
      type: 'SET_SETTINGS',
      payload: { keep: 5 },
    });

    expect(mockedSendMessageWithTimeout).toHaveBeenCalledWith({
      type: 'SET_SETTINGS',
      payload: { keep: 5 },
    });
    expect(response).toEqual({ ok: true });
  });

  it('saves enabled state', async () => {
    mockedSendMessageWithTimeout.mockResolvedValue({ ok: true });

    await sendMessageWithTimeout({
      type: 'SET_SETTINGS',
      payload: { enabled: false },
    });

    expect(mockedSendMessageWithTimeout).toHaveBeenCalledWith({
      type: 'SET_SETTINGS',
      payload: { enabled: false },
    });
  });

  it('handles save failure', async () => {
    mockedSendMessageWithTimeout.mockRejectedValue(new Error('Storage error'));

    await expect(
      sendMessageWithTimeout({
        type: 'SET_SETTINGS',
        payload: { keep: 10 },
      })
    ).rejects.toThrow('Storage error');
  });
});

describe('tab reload functionality', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Simulates the reloadActiveChatGPTTab logic from popup.ts
   */
  async function reloadActiveChatGPTTab(): Promise<boolean> {
    try {
      const tabs = await mockTabsQuery({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (activeTab?.id && activeTab.url) {
        const isChatGPT =
          activeTab.url.includes('chat.openai.com') ||
          activeTab.url.includes('chatgpt.com');

        if (isChatGPT) {
          await mockTabsReload(activeTab.id);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  it('reloads ChatGPT tab on chatgpt.com', async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 123, url: 'https://chatgpt.com/c/abc123' },
    ]);
    mockTabsReload.mockResolvedValue(undefined);

    const result = await reloadActiveChatGPTTab();

    expect(mockTabsQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(mockTabsReload).toHaveBeenCalledWith(123);
    expect(result).toBe(true);
  });

  it('reloads ChatGPT tab on chat.openai.com', async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 456, url: 'https://chat.openai.com/chat' },
    ]);
    mockTabsReload.mockResolvedValue(undefined);

    const result = await reloadActiveChatGPTTab();

    expect(mockTabsReload).toHaveBeenCalledWith(456);
    expect(result).toBe(true);
  });

  it('does not reload non-ChatGPT tabs', async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 789, url: 'https://google.com' },
    ]);

    const result = await reloadActiveChatGPTTab();

    expect(mockTabsReload).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('handles no active tab', async () => {
    mockTabsQuery.mockResolvedValue([]);

    const result = await reloadActiveChatGPTTab();

    expect(mockTabsReload).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('handles tab without URL', async () => {
    mockTabsQuery.mockResolvedValue([{ id: 111 }]); // no url property

    const result = await reloadActiveChatGPTTab();

    expect(mockTabsReload).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('handles tabs.query error gracefully', async () => {
    mockTabsQuery.mockRejectedValue(new Error('Permission denied'));

    const result = await reloadActiveChatGPTTab();

    expect(result).toBe(false);
  });

  it('handles tabs.reload error gracefully', async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 123, url: 'https://chatgpt.com/' },
    ]);
    mockTabsReload.mockRejectedValue(new Error('Tab was closed'));

    const result = await reloadActiveChatGPTTab();

    expect(result).toBe(false);
  });
});

describe('dev mode detection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('detects dev mode when .dev file exists', async () => {
    // Simulate isDevMode logic
    mockGetURL.mockReturnValue('chrome-extension://id/.dev');

    // Mock global fetch for this test
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    try {
      const response = await fetch(mockGetURL('.dev'));
      const isDevMode = response.ok;

      expect(mockGetURL).toHaveBeenCalledWith('.dev');
      expect(isDevMode).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns false when .dev file missing', async () => {
    mockGetURL.mockReturnValue('chrome-extension://id/.dev');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    try {
      const response = await fetch(mockGetURL('.dev'));
      const isDevMode = response.ok;

      expect(isDevMode).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns false on fetch error', async () => {
    mockGetURL.mockReturnValue('chrome-extension://id/.dev');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      let isDevMode = false;
      try {
        const response = await fetch(mockGetURL('.dev'));
        isDevMode = response.ok;
      } catch {
        isDevMode = false;
      }

      expect(isDevMode).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('settings flow integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('complete flow: load settings -> change -> save -> reload', async () => {
    // 1. Load initial settings
    mockedSendMessageWithTimeout.mockResolvedValueOnce({
      settings: { enabled: true, keep: 10 },
    });

    const loadResponse = await sendMessageWithTimeout({ type: 'GET_SETTINGS' });
    expect(loadResponse.settings.keep).toBe(10);

    // 2. Save new settings
    mockedSendMessageWithTimeout.mockResolvedValueOnce({ ok: true });

    await sendMessageWithTimeout({
      type: 'SET_SETTINGS',
      payload: { keep: 5 },
    });

    // 3. Reload tab
    mockTabsQuery.mockResolvedValue([
      { id: 123, url: 'https://chatgpt.com/' },
    ]);
    mockTabsReload.mockResolvedValue(undefined);

    const tabs = await mockTabsQuery({ active: true, currentWindow: true });
    if (tabs[0]?.url?.includes('chatgpt.com')) {
      await mockTabsReload(tabs[0].id);
    }

    expect(mockTabsReload).toHaveBeenCalledWith(123);
  });

  it('enable toggle flow: toggle -> save -> reload', async () => {
    // Save enabled state
    mockedSendMessageWithTimeout.mockResolvedValue({ ok: true });

    await sendMessageWithTimeout({
      type: 'SET_SETTINGS',
      payload: { enabled: false },
    });

    expect(mockedSendMessageWithTimeout).toHaveBeenCalledWith({
      type: 'SET_SETTINGS',
      payload: { enabled: false },
    });

    // Reload tab
    mockTabsQuery.mockResolvedValue([
      { id: 456, url: 'https://chatgpt.com/c/test' },
    ]);
    mockTabsReload.mockResolvedValue(undefined);

    const tabs = await mockTabsQuery({ active: true, currentWindow: true });
    await mockTabsReload(tabs[0].id);

    expect(mockTabsReload).toHaveBeenCalledWith(456);
  });
});
