/**
 * Tests for action icon state handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../extension/src/shared/browser-polyfill', () => ({
  default: {
    action: {
      enable: vi.fn(),
      disable: vi.fn(),
      setPopup: vi.fn(),
    },
    declarativeContent: {
      onPageChanged: {
        removeRules: vi.fn((_ids, cb) => {
          if (cb) cb();
        }),
        addRules: vi.fn(),
      },
      PageStateMatcher: vi.fn(function PageStateMatcher(this: unknown, options: unknown) {
        return { options };
      }),
      ShowAction: vi.fn(function ShowAction(this: unknown) {
        return {};
      }),
    },
    tabs: {
      query: vi.fn(),
    },
    runtime: {
      getManifest: vi.fn(() => ({ action: { default_popup: 'popup/popup.html' } })),
    },
  },
}));

import browser from '../../extension/src/shared/browser-polyfill';
import {
  disableActionByDefault,
  ensureDeclarativeActionRules,
  updateActionForTab,
  syncActionStateForAllTabs,
} from '../../extension/src/background/action-state';

const mockedBrowser = browser as unknown as {
  action: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    setPopup: ReturnType<typeof vi.fn>;
  };
  tabs: { query: ReturnType<typeof vi.fn> };
  runtime: { getManifest: ReturnType<typeof vi.fn> };
  declarativeContent: {
    onPageChanged: { removeRules: ReturnType<typeof vi.fn>; addRules: ReturnType<typeof vi.fn> };
    PageStateMatcher: ReturnType<typeof vi.fn>;
    ShowAction: ReturnType<typeof vi.fn>;
  };
};

describe('action state', () => {
  beforeEach(() => {
    mockedBrowser.action.enable.mockClear();
    mockedBrowser.action.disable.mockClear();
    mockedBrowser.action.setPopup.mockClear();
    mockedBrowser.tabs.query.mockReset();
    mockedBrowser.declarativeContent.onPageChanged.removeRules.mockClear();
    mockedBrowser.declarativeContent.onPageChanged.addRules.mockClear();
    mockedBrowser.declarativeContent.PageStateMatcher.mockClear();
    mockedBrowser.declarativeContent.ShowAction.mockClear();
  });

  it('enables action on chatgpt.com', () => {
    updateActionForTab(1, 'https://chatgpt.com/');
    expect(mockedBrowser.action.enable).toHaveBeenCalledWith(1);
    expect(mockedBrowser.action.disable).not.toHaveBeenCalled();
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'popup/popup.html' });
  });

  it('enables action on chat.openai.com', () => {
    updateActionForTab(2, 'https://chat.openai.com/chat/abc');
    expect(mockedBrowser.action.enable).toHaveBeenCalledWith(2);
    expect(mockedBrowser.action.disable).not.toHaveBeenCalled();
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'popup/popup.html' });
  });

  it('disables action on non-ChatGPT URLs', () => {
    updateActionForTab(3, 'https://example.com/');
    expect(mockedBrowser.action.disable).toHaveBeenCalledWith(3);
    expect(mockedBrowser.action.enable).not.toHaveBeenCalled();
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: '' });
  });

  it('disables action when URL is missing', () => {
    updateActionForTab(4, undefined);
    expect(mockedBrowser.action.disable).toHaveBeenCalledWith(4);
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
  });

  it('syncs action state across tabs', async () => {
    mockedBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://chatgpt.com/' },
      { id: 2, url: 'https://example.com/' },
    ]);

    await syncActionStateForAllTabs();

    expect(mockedBrowser.action.enable).toHaveBeenCalledWith(1);
    expect(mockedBrowser.action.disable).toHaveBeenCalledWith(2);
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'popup/popup.html' });
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: '' });
  });

  it('falls back to active tab when full query fails', async () => {
    mockedBrowser.tabs.query
      .mockRejectedValueOnce(new Error('query failed'))
      .mockResolvedValueOnce([{ id: 3, url: 'https://chatgpt.com/' }]);

    await syncActionStateForAllTabs();

    expect(mockedBrowser.tabs.query).toHaveBeenNthCalledWith(1, {});
    expect(mockedBrowser.tabs.query).toHaveBeenNthCalledWith(2, { active: true, currentWindow: true });
    expect(mockedBrowser.action.enable).toHaveBeenCalledWith(3);
  });

  it('disables action by default', () => {
    disableActionByDefault();
    expect(mockedBrowser.action.disable).toHaveBeenCalledWith();
    expect(mockedBrowser.action.setPopup).toHaveBeenCalledWith({ popup: '' });
  });

  it('registers declarative rules when available', async () => {
    await ensureDeclarativeActionRules();

    expect(mockedBrowser.declarativeContent.onPageChanged.removeRules).toHaveBeenCalled();
    expect(mockedBrowser.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
    expect(mockedBrowser.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(2);
    expect(mockedBrowser.declarativeContent.ShowAction).toHaveBeenCalledTimes(1);
  });
});
