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
 * Sync settings from browser.storage to localStorage AND dispatch CustomEvent.
 * Runs in parallel with page-script injection. The CustomEvent signals config ready
 * to page-script, allowing it to gate first fetch until config is available.
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
      // Write to localStorage for page-script access
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      // Dispatch event immediately - faster than waiting for content.ts (document_idle)
      window.dispatchEvent(new CustomEvent('lightsession-config', { detail: JSON.stringify(config) }));
    }
  } catch {
    // Storage access failed - page-script will use defaults after timeout
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
// 1. Inject page script IMMEDIATELY to patch fetch before ChatGPT's code runs
// 2. Sync localStorage in parallel (best effort for first fetch)
// 3. content.ts will dispatch config via CustomEvent as fallback
// Priority is early patching - page-script uses defaults if localStorage not ready.
injectPageScript();
void syncSettingsToLocalStorage();
