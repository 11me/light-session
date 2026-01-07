/**
 * LightSession for ChatGPT - Content Script
 *
 * Simplified content script that works with the Fetch Proxy (page-script.ts).
 * Responsibilities:
 * - Load and dispatch settings to the page script
 * - Listen for trim status from the page script
 * - Manage the status bar UI
 * - Handle settings changes from popup/storage
 */

import browser from '../shared/browser-polyfill';
import type { LsSettings } from '../shared/types';
import { loadSettings, validateSettings } from '../shared/storage';
import { TIMING } from '../shared/constants';
import { setDebugMode, logDebug, logInfo, logWarn, logError } from '../shared/logger';
import {
  updateStatusBar,
  resetAccumulatedTrimmed,
  setStatusBarVisibility,
} from './status-bar';

// ============================================================================
// Types for Page Script Communication
// ============================================================================

interface PageScriptConfig {
  enabled: boolean;
  limit: number;
  debug: boolean;
}

interface TrimStatus {
  totalBefore: number;
  keptAfter: number;
  removed: number;
  limit: number;
}

// ============================================================================
// Global State
// ============================================================================

let currentSettings: LsSettings | null = null;
let proxyReady = false;

// ============================================================================
// Page Script Communication
// ============================================================================

/**
 * Dispatch configuration to the page script via CustomEvent.
 * The page script listens for 'lightsession-config' events.
 *
 * In Firefox, content scripts run in an isolated sandbox. Objects created
 * in this sandbox are not accessible from page context due to Xray vision.
 * We use cloneInto() to clone the config object into the page context,
 * making it accessible to the page script.
 *
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts
 */
function dispatchConfig(settings: LsSettings): void {
  const config: PageScriptConfig = {
    enabled: settings.enabled,
    limit: settings.keep,
    debug: settings.debug,
  };

  // Clone config into page context for Firefox (Xray vision workaround)
  // cloneInto is a Firefox-specific API, check for availability
  const detail =
    typeof cloneInto === 'function' ? cloneInto(config, window) : config;

  window.dispatchEvent(new CustomEvent('lightsession-config', { detail }));

  logDebug('Dispatched config to page script:', config);
}

/**
 * Handle trim status from the page script.
 * Updates the status bar with trim statistics.
 */
function handleTrimStatus(event: CustomEvent<TrimStatus>): void {
  const status = event.detail;

  if (!status || typeof status !== 'object') {
    return;
  }

  logDebug('Received trim status:', status);

  // Convert page script status format to status bar format
  updateStatusBar({
    totalMessages: status.totalBefore,
    visibleMessages: status.keptAfter,
    trimmedMessages: status.removed,
    keepLastN: status.limit,
  });
}

/**
 * Handle proxy ready message from page script.
 * Called when the page script has successfully patched window.fetch.
 */
function handleProxyReady(): void {
  proxyReady = true;
  logInfo('Fetch proxy is ready');

  // Dispatch current config now that proxy is ready
  if (currentSettings) {
    dispatchConfig(currentSettings);
  }
}

/**
 * Check if the proxy was successfully installed.
 * Shows a warning in the status bar if not.
 */
function checkProxyStatus(): void {
  if (!proxyReady) {
    logWarn('Fetch proxy did not signal ready within timeout');
    // Don't show warning to user - proxy may still work, just didn't send ready message
  }
}

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Apply settings changes.
 * Dispatches config to page script and updates status bar visibility.
 */
function applySettings(settings: LsSettings): void {
  const prevSettings = currentSettings;
  currentSettings = settings;

  // Update debug mode
  setDebugMode(settings.debug);

  // Dispatch config to page script
  dispatchConfig(settings);

  // Handle status bar visibility
  setStatusBarVisibility(settings.showStatusBar && settings.enabled);

  // Reset accumulated count on enable toggle
  if (prevSettings && prevSettings.enabled !== settings.enabled) {
    resetAccumulatedTrimmed();
  }

  // Apply Ultra Lean CSS mode (works independently of trimmer)
  setUltraLeanMode(settings.ultraLean);

  logDebug('Settings applied:', settings);
}

/**
 * Apply or remove Ultra Lean CSS class based on setting.
 * This enables/disables aggressive performance optimizations.
 */
function setUltraLeanMode(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('ls-ultra-lean');
  } else {
    document.documentElement.classList.remove('ls-ultra-lean');
  }
}

/**
 * Handle storage changes (settings updated from popup or another tab).
 */
function handleStorageChange(
  changes: Record<string, browser.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'local') {
    return;
  }

  if (!changes.ls_settings?.newValue) {
    return;
  }

  // Validate settings to ensure proper types and ranges
  const newSettings = validateSettings(changes.ls_settings.newValue as Partial<LsSettings>);
  logInfo('Settings changed via storage:', newSettings);
  applySettings(newSettings);
}

// ============================================================================
// Navigation Detection
// ============================================================================

/**
 * Detect SPA navigation within ChatGPT.
 * Resets accumulated trim count on chat changes.
 */
function setupNavigationDetection(): void {
  let lastPath = location.pathname;

  // Listen for popstate events
  window.addEventListener('popstate', () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      logDebug('Popstate navigation:', lastPath);
      resetAccumulatedTrimmed();
    }
  });

  // Patch history methods for SPA navigation detection
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState(...args);
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      logDebug('PushState navigation:', lastPath);
      resetAccumulatedTrimmed();
    }
    return result;
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState(...args);
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      logDebug('ReplaceState navigation:', lastPath);
      resetAccumulatedTrimmed();
    }
    return result;
  };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Set up event listeners for page script communication.
 */
function setupEventListeners(): void {
  // Listen for trim status from page script
  window.addEventListener('lightsession-status', ((event: CustomEvent<TrimStatus>) => {
    handleTrimStatus(event);
  }) as EventListener);

  // Listen for proxy ready signal
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    // Validate origin to prevent spoofing from other scripts
    if (event.origin !== location.origin) return;

    const data = event.data as { type?: string } | null;
    if (data?.type === 'lightsession-proxy-ready') {
      handleProxyReady();
    }
  });

  // Listen for config request from page script (handles race condition)
  window.addEventListener('lightsession-request-config', () => {
    if (currentSettings) {
      dispatchConfig(currentSettings);
    }
  });

  // Listen for storage changes
  browser.storage.onChanged.addListener(handleStorageChange);
}

/**
 * Main initialization function.
 */
async function initialize(): Promise<void> {
  try {
    logInfo('LightSession content script initializing...');

    // Set up event listeners first (before settings load)
    setupEventListeners();

    // Load initial settings
    const settings = await loadSettings();
    logInfo('Loaded settings:', settings);

    // Apply settings
    applySettings(settings);

    // Set up navigation detection
    setupNavigationDetection();

    // Check proxy status after a short delay
    setTimeout(checkProxyStatus, TIMING.PROXY_READY_TIMEOUT_MS);

    logInfo('LightSession content script initialized');
  } catch (error) {
    logError('Failed to initialize:', error);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch((error) => {
      logError('Initialization failed:', error);
    });
  });
} else {
  initialize().catch((error) => {
    logError('Initialization failed:', error);
  });
}

// ============================================================================
// Error Handlers
// ============================================================================

/**
 * Global error handler to prevent extension errors from breaking the page
 */
window.addEventListener('error', (event) => {
  if (event.message?.includes('LS:') || event.filename?.includes('light-session')) {
    logError('Unhandled error:', event.error || event.message);
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});
