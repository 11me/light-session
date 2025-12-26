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
import { createInitialState, boot, shutdown, scheduleTrim, evaluateTrim, setOnTrimComplete } from './trimmer';
import { setStatusBarVisibility, removeStatusBar, resetAccumulatedTrimmed, showLayoutNotRecognized } from './status-bar';

// Global state
let state: TrimmerState = createInitialState();
let pageObserver: MutationObserver | null = null;
let navigationCleanup: (() => void) | null = null;
let pendingRootSync = false;
let pendingRootSyncReason: string | null = null;

// Store original history methods at module level to prevent memory leak
// from chained wrappers when navigation watcher is reinstalled
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;

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
 * Uses module-level storage for original history methods to prevent memory leak
 * from chained wrappers when reinstalled.
 */
function installNavigationWatcher(onChange: (reason: string) => void): () => void {
  let lastUrl = window.location.href;

  const scheduleCheck = (reason: string): void => {
    void Promise.resolve().then(() => {
      const current = window.location.href;
      if (current === lastUrl) {
        return;
      }

      lastUrl = current;
      onChange(reason);
    });
  };

  const handlePopState = (): void => scheduleCheck('popstate');
  const handleHashChange = (): void => scheduleCheck('hashchange');

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('hashchange', handleHashChange);

  // Only capture original methods on first installation to prevent
  // saving already-wrapped versions and creating a chain of wrappers
  if (!originalPushState) {
    originalPushState = history.pushState.bind(history);
  }
  if (!originalReplaceState) {
    originalReplaceState = history.replaceState.bind(history);
  }

  // Create typed references for use in wrapper functions
  const boundPushState = originalPushState;
  const boundReplaceState = originalReplaceState;

  history.pushState = function (
    ...args: Parameters<typeof history.pushState>
  ): ReturnType<typeof history.pushState> {
    const result = boundPushState(...args);
    scheduleCheck('pushstate');
    return result;
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ): ReturnType<typeof history.replaceState> {
    const result = boundReplaceState(...args);
    scheduleCheck('replacestate');
    return result;
  };

  return () => {
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);
    // Always restore to true originals stored at module level
    if (originalPushState) {
      history.pushState = originalPushState;
    }
    if (originalReplaceState) {
      history.replaceState = originalReplaceState;
    }
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

    // Set up callback to handle potentially missed mutations during trim
    // This ensures DOM is re-evaluated after observer reconnection
    setOnTrimComplete(() => {
      // Only re-evaluate if trimmer is active and not already scheduled
      if (state.current === 'OBSERVING' && !state.trimScheduled) {
        handleMutation();
      }
    });

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

  // Capture settings snapshot at scheduling time to prevent race conditions
  // where settings might change between scheduling and evaluation
  const settingsSnapshot = { ...state.settings };

  state = scheduleTrim(
    state,
    () => {
      state = evaluateTrim(state, { force, settings: settingsSnapshot });
    },
    // onComplete callback ensures trimScheduled is reset even on error
    () => {
      state = { ...state, trimScheduled: false };
    }
  );
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
