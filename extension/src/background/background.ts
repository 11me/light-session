/**
 * LightSession Pro - Background Script
 * Manages settings and routes messages between content and popup scripts
 */

import browser from '../shared/browser-polyfill';
import type { RuntimeMessage, RuntimeResponse } from '../shared/types';
import { initializeSettings, loadSettings, updateSettings } from '../shared/storage';
import { setDebugMode, logDebug, logError } from '../shared/logger';
import { createMessageHandler } from '../shared/messages';

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

// Register message listener
// The handler returns true to indicate async response (required for Chrome)
browser.runtime.onMessage.addListener(messageHandler);

// Initialize on script load
initialize().catch((error) => {
  logError('Background script initialization failed:', error);
});
