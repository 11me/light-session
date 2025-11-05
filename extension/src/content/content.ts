/**
 * LightSession for ChatGPT - Content Script Entry Point
 * Initializes trimmer state machine and wires up event handlers
 */

import '../shared/browser-polyfill';
import '../shared/idle-callback-polyfill';
import type { TrimmerState } from '../shared/types';
import { loadSettings } from '../shared/storage';
import { setDebugMode, logInfo, logError } from '../shared/logger';
import { setupScrollTracking } from './observers';
import { createInitialState, boot, shutdown, scheduleTrim, evaluateTrim } from './trimmer';

// Global state
let state: TrimmerState = createInitialState();
let scrollCleanup: (() => void) | null = null;

/**
 * Initialize content script
 */
async function initialize(): Promise<void> {
  try {
    logInfo('LightSession content script initializing...');

    // Load settings
    const settings = await loadSettings();
    state.settings = settings;
    setDebugMode(settings.debug);

    // Boot trimmer if enabled
    if (settings.enabled) {
      state = boot(state, handleMutation);

      // Setup scroll tracking
      if (state.scrollContainer) {
        scrollCleanup = setupScrollTracking(state.scrollContainer, (isAtBottom) => {
          state.isAtBottom = isAtBottom;

          // If scrolled back to bottom, trigger trim evaluation
          if (isAtBottom && settings.pauseOnScrollUp) {
            handleMutation();
          }
        });
      }

      // Initial trim evaluation
      handleMutation();
    }

    logInfo('LightSession initialized successfully');
  } catch (error) {
    logError('Failed to initialize content script:', error);
  }
}

/**
 * Handle mutation events (debounced)
 */
function handleMutation(): void {
  state = scheduleTrim(state, () => {
    state = evaluateTrim(state);
  });
}

/**
 * Handle storage changes (settings updates from popup)
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.ls_settings) {
    return;
  }

  const newSettings = changes.ls_settings.newValue;
  if (!newSettings) {
    return;
  }

  logInfo('Settings changed, updating state');

  // Update debug mode
  if ('debug' in newSettings) {
    setDebugMode(newSettings.debug);
  }

  // Handle enable/disable toggle
  const wasEnabled = state.settings.enabled;
  const nowEnabled = newSettings.enabled;

  state.settings = newSettings;

  if (!wasEnabled && nowEnabled) {
    // Extension was just enabled
    logInfo('Extension enabled, booting trimmer');
    state = boot(state, handleMutation);

    // Setup scroll tracking
    if (state.scrollContainer && !scrollCleanup) {
      scrollCleanup = setupScrollTracking(state.scrollContainer, (isAtBottom) => {
        state.isAtBottom = isAtBottom;
        if (isAtBottom && newSettings.pauseOnScrollUp) {
          handleMutation();
        }
      });
    }

    // Trigger initial trim
    handleMutation();
  } else if (wasEnabled && !nowEnabled) {
    // Extension was just disabled
    logInfo('Extension disabled, shutting down trimmer');
    state = shutdown(state);

    // Cleanup scroll tracking
    if (scrollCleanup) {
      scrollCleanup();
      scrollCleanup = null;
    }
  } else if (nowEnabled) {
    // Extension still enabled, settings changed
    // Re-evaluate trim with new settings (e.g., keep count changed)
    handleMutation();
  }
});

/**
 * Wait for DOM to be ready, then initialize
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch((error) => {
      logError('Initialization failed:', error);
    });
  });
} else {
  // DOMContentLoaded already fired
  initialize().catch((error) => {
    logError('Initialization failed:', error);
  });
}

/**
 * Global error handler to prevent extension errors from breaking the page
 */
window.addEventListener('error', (event) => {
  // Only handle errors from our extension
  if (event.message?.includes('LS:') || event.filename?.includes('light-session')) {
    logError('Unhandled error:', event.error || event.message);
    event.preventDefault(); // Prevent page break
  }
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent page break
});
