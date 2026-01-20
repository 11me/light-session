/**
 * LightSession Pro - Background Script
 * Manages settings and routes messages between content and popup scripts
 */

import browser from '../shared/browser-polyfill';
import type { RuntimeMessage, RuntimeResponse } from '../shared/types';
import { initializeSettings, loadSettings, updateSettings } from '../shared/storage';
import { setDebugMode, logDebug, logError } from '../shared/logger';
import { createMessageHandler } from '../shared/messages';
import {
  disableActionByDefault,
  ensureDeclarativeActionRules,
  syncActionStateForAllTabs,
  updateActionForTab,
} from './action-state';

/**
 * Initialize background script
 */
async function initialize(): Promise<void> {
  logDebug('Background script initializing...');

  // Initialize settings on first install
  await initializeSettings();

  // Load settings and apply debug mode
  const settings = await loadSettings();
  setDebugMode(settings.debug);

  // Disable action by default, then enable per-tab where applicable
  disableActionByDefault();

  await ensureDeclarativeActionRules();

  // Set initial action state across existing tabs
  await syncActionStateForAllTabs();

  logDebug('Background script initialized');
}

/**
 * Handle runtime messages from content scripts and popup
 */
const messageHandler = createMessageHandler(
  async (message: RuntimeMessage): Promise<RuntimeResponse> => {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await loadSettings();
        return { settings };
      }

      case 'SET_SETTINGS': {
        await updateSettings(message.payload);

        // Update debug mode if changed
        if ('debug' in message.payload) {
          setDebugMode(message.payload.debug ?? false);
        }

        return { ok: true };
      }

      case 'PING': {
        return { type: 'PONG', timestamp: Date.now() };
      }

      default: {
        const _exhaustiveCheck: never = message;
        throw new Error(`Unknown message type: ${(_exhaustiveCheck as RuntimeMessage).type}`);
      }
    }
  }
);

/**
 * Listen for storage changes and propagate debug mode updates
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.ls_settings) {
    const newSettings = changes.ls_settings.newValue as Record<string, unknown> | undefined;
    if (newSettings && typeof newSettings.debug === 'boolean') {
      setDebugMode(newSettings.debug);
      logDebug('Debug mode updated from storage change');
    }
  }
});

browser.runtime.onInstalled.addListener(() => {
  disableActionByDefault();
  void ensureDeclarativeActionRules();
  void syncActionStateForAllTabs();
});

browser.runtime.onStartup.addListener(() => {
  disableActionByDefault();
  void ensureDeclarativeActionRules();
  void syncActionStateForAllTabs();
});

// Enable action only on ChatGPT tabs
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateActionForTab(tabId, changeInfo.url);
    return;
  }
  if (changeInfo.status === 'complete') {
    updateActionForTab(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  void (async () => {
    try {
      const tab = await browser.tabs.get(tabId);
      updateActionForTab(tabId, tab.url);
    } catch {
      // Ignore failures on restricted tabs
    }
  })();
});

// Register message listener
// The handler returns true to indicate async response (required for Chrome)
browser.runtime.onMessage.addListener(messageHandler);

// Initialize on script load
initialize().catch((error) => {
  logError('Background script initialization failed:', error);
});
