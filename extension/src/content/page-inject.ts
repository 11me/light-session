/**
 * LightSession for ChatGPT - Page Script Injector
 *
 * This content script runs at document_start to:
 * 1. Sync settings from browser.storage to localStorage (for page-script access)
 * 2. Inject the page script into the page context BEFORE any other scripts run
 *
 * This is critical for patching window.fetch before ChatGPT's code uses it,
 * and ensures page-script has access to correct settings immediately.
 */

import browser from '../shared/browser-polyfill';

const STORAGE_KEY = 'ls_settings';
const LOCAL_STORAGE_KEY = 'ls_config';

/**
 * Sync settings from browser.storage to localStorage.
 * This runs BEFORE page-script injection to ensure localStorage has correct data.
 */
async function syncSettingsToLocalStorage(): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as { enabled?: boolean; keep?: number; debug?: boolean } | undefined;
    
    if (stored) {
      const config = {
        enabled: stored.enabled ?? true,
        limit: stored.keep ?? 10,
        debug: stored.debug ?? false,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Storage access failed - page-script will use defaults or existing localStorage
  }
}

/**
 * Inject the page script into page context.
 */
function injectPageScript(): void {
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('dist/page-script.js');

  const target = document.head || document.documentElement;
  target.insertBefore(script, target.firstChild);

  script.onload = (): void => {
    script.remove();
  };

  script.onerror = (): void => {
    console.error('[LightSession] Failed to load page script');
    script.remove();
  };
}

// Main execution:
// 1. Start syncing settings (async, but fast)
// 2. Inject page script immediately (can't wait - need to patch fetch early)
// The sync will complete and update localStorage, which page-script checks on each fetch.
void syncSettingsToLocalStorage();
injectPageScript();
