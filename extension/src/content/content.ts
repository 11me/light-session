/**
 * LightSession for ChatGPT - Content Script Entry Point
 * Initializes trimmer state machine and wires up event handlers
 */

import '../shared/browser-polyfill';
import '../shared/idle-callback-polyfill';
import type { TrimmerState, LsSettings } from '../shared/types';
import { loadSettings } from '../shared/storage';
import { setDebugMode, logInfo, logError } from '../shared/logger';
import { findConversationRoot } from './dom-helpers';
import { createInitialState, boot, shutdown, scheduleTrim, evaluateTrim } from './trimmer';
import { setStatusBarVisibility, removeStatusBar, resetAccumulatedTrimmed, showLayoutNotRecognized } from './status-bar';

// Global state
let state: TrimmerState = createInitialState();
let pageObserver: MutationObserver | null = null;
let navigationCleanup: (() => void) | null = null;
let pendingRootSync = false;
let pendingRootSyncReason: string | null = null;

/**
 * Schedule a root sync operation on the microtask queue.
 * Coalesces multiple triggers to a single ensure step.
 */
function requestRootSync(reason: string): void {
  pendingRootSyncReason = reason;

  if (pendingRootSync) {
    return;
  }

  pendingRootSync = true;

  void Promise.resolve().then(() => {
    pendingRootSync = false;
    const effectiveReason = pendingRootSyncReason || 'mutation';
    pendingRootSyncReason = null;
    ensureConversationBindings(effectiveReason);
  });
}

/**
 * Ensure the trimmer stays attached to the active conversation DOM.
 * Rebinds when ChatGPT replaces the thread container or navigates.
 */
function ensureConversationBindings(reason: string): void {
  if (!state.settings.enabled) {
    return;
  }

  const candidateRoot = findConversationRoot();
  if (!candidateRoot) {
    return;
  }

  const candidateIsFallback = candidateRoot === document.body;
  const currentRoot = state.conversationRoot;
  const rootMissing = !currentRoot || !document.contains(currentRoot);
  const observerMissing = !state.observer;
  const rootChanged = Boolean(candidateRoot && currentRoot && candidateRoot !== currentRoot);

  if (candidateIsFallback) {
    if ((rootMissing || observerMissing) && (state.current !== 'IDLE' || state.observer || currentRoot)) {
      teardownTrimmer();
      resetAccumulatedTrimmed(); // Reset stats so recovery starts fresh
      showLayoutNotRecognized(); // Show warning when layout is not recognized
    }
    return;
  }

  if (rootMissing || observerMissing || rootChanged || state.current === 'IDLE') {
    rebindTrimmer(reason);
  }
}

/**
 * Clean up current trimmer bindings without disabling the feature.
 */
function teardownTrimmer(): void {
  if (state.current !== 'IDLE' || state.observer || state.conversationRoot) {
    state = shutdown(state);
  }
}

/**
 * Reboot the trimmer against the latest conversation DOM.
 */
function rebindTrimmer(reason: string): void {
  logInfo(`Rebinding trimmer (${reason})`);

  // Reset trimmed counter on navigation to new chat
  if (reason.includes('state') || reason.includes('navigation') || reason === 'pushstate' || reason === 'popstate') {
    resetAccumulatedTrimmed();
  }

  state = shutdown(state);

  if (!state.settings.enabled) {
    return;
  }

  state = boot(state, handleMutation);

  if (state.current !== 'OBSERVING' || !state.conversationRoot) {
    return;
  }

  state = evaluateTrim(state, { force: true });
}

/**
 * Start global watchers that detect navigation and major DOM swaps.
 */
function startRootSyncWatchers(): void {
  if (document.body && !pageObserver) {
    let rafId: number | null = null;

    pageObserver = new MutationObserver(() => {
      if (rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        requestRootSync('dom-mutation');
      });
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (!navigationCleanup) {
    navigationCleanup = installNavigationWatcher((navReason) => {
      requestRootSync(navReason);
    });
  }

  requestRootSync('watchers-start');
}

/**
 * Stop global watchers when the extension is disabled.
 */
function stopRootSyncWatchers(): void {
  if (pageObserver) {
    pageObserver.disconnect();
    pageObserver = null;
  }

  if (navigationCleanup) {
    navigationCleanup();
    navigationCleanup = null;
  }
}

/**
 * Listen for SPA navigation changes (pushState/replaceState/popstate/hashchange).
 */
function installNavigationWatcher(onChange: (reason: string) => void): () => void {
  let lastUrl = window.location.href;

  const scheduleCheck = (reason: string) => {
    void Promise.resolve().then(() => {
      const current = window.location.href;
      if (current === lastUrl) {
        return;
      }

      lastUrl = current;
      onChange(reason);
    });
  };

  const handlePopState = () => scheduleCheck('popstate');
  const handleHashChange = () => scheduleCheck('hashchange');

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('hashchange', handleHashChange);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (
    ...args: Parameters<typeof originalPushState>
  ): ReturnType<typeof originalPushState> {
    const result = originalPushState(...args);
    scheduleCheck('pushstate');
    return result;
  };

  history.replaceState = function (
    ...args: Parameters<typeof originalReplaceState>
  ): ReturnType<typeof originalReplaceState> {
    const result = originalReplaceState(...args);
    scheduleCheck('replacestate');
    return result;
  };

  return () => {
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}

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
      startRootSyncWatchers();

      state = boot(state, handleMutation);

      // Initialize status bar visibility
      setStatusBarVisibility(settings.showStatusBar);

      if (state.current === 'OBSERVING') {
        handleMutation();
      } else {
        requestRootSync('initialize');
      }
    } else {
      stopRootSyncWatchers();
      removeStatusBar();
    }

    logInfo('LightSession initialized successfully');
  } catch (error) {
    logError('Failed to initialize content script:', error);
  }
}

/**
 * Handle mutation events (debounced)
 */
function handleMutation(force = false): void {
  ensureConversationBindings(force ? 'forced-trim' : 'mutation');

  state = scheduleTrim(state, () => {
    state = evaluateTrim(state, { force });
  });
}

/**
 * Handle storage changes (settings updates from popup)
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.ls_settings) {
    return;
  }

  const newSettings = changes.ls_settings.newValue as LsSettings | undefined;
  if (!newSettings) {
    return;
  }

  logInfo('Settings changed, updating state');

  // Update debug mode
  setDebugMode(newSettings.debug);

  // Handle enable/disable toggle
  const previousSettings = state.settings;
  const wasEnabled = previousSettings.enabled;
  const nowEnabled = newSettings.enabled;

  state.settings = newSettings;

  if (!wasEnabled && nowEnabled) {
    // Extension was just enabled
    logInfo('Extension enabled, booting trimmer');
    startRootSyncWatchers();
    state = boot(state, handleMutation);
    setStatusBarVisibility(newSettings.showStatusBar);

    if (state.current === 'OBSERVING') {
      handleMutation();
    } else {
      requestRootSync('enable');
    }
  } else if (wasEnabled && !nowEnabled) {
    // Extension was just disabled
    logInfo('Extension disabled, shutting down trimmer');
    stopRootSyncWatchers();
    teardownTrimmer();
    removeStatusBar();
  } else if (nowEnabled) {
    // Extension still enabled, settings changed
    // Re-evaluate trim with new settings (e.g., keep count changed)
    const forceTrim = previousSettings.keep !== newSettings.keep;

    // Handle showStatusBar setting change
    if (previousSettings.showStatusBar !== newSettings.showStatusBar) {
      setStatusBarVisibility(newSettings.showStatusBar);
    }

    requestRootSync('settings-change');
    handleMutation(forceTrim);
  } else {
    // Remain disabled
    stopRootSyncWatchers();
    teardownTrimmer();
    removeStatusBar();
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
