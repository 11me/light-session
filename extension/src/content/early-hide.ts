/**
 * LightSession - Early Hide Script
 *
 * Runs at document_start (before any paint) to set up pre-trim hiding.
 * The CSS (early-hide.css) uses html[data-ls-pretrim="1"] selector to hide
 * messages before the main content script trims them.
 *
 * Failsafe: attribute auto-removed after 4 seconds if main script fails to clear it.
 */

// Make this file a module for TypeScript global augmentation
export {};

// Type declaration for the global function
declare global {
  interface Window {
    __lsDisablePretrim?: () => void;
  }
}

// Constants for pretrim functionality
const PRETRIM_ATTR = 'data-ls-pretrim';
const FAILSAFE_TIMEOUT_MS = 4000;

/**
 * Set the pretrim attribute to hide messages before first paint.
 * This prevents the browser from rendering messages that will be trimmed.
 * NOTE: Currently disabled due to LCP regression. Kept for future use.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _enablePretrimHide(): void {
  document.documentElement.setAttribute(PRETRIM_ATTR, '1');
}

/**
 * Remove the pretrim attribute to reveal messages.
 * Called by main content script after first trim, or by failsafe timeout.
 */
function disablePretrimHide(): void {
  document.documentElement.removeAttribute(PRETRIM_ATTR);
}

/**
 * Failsafe: automatically remove pretrim attribute after timeout.
 * Prevents empty page if main script fails or is disabled.
 * NOTE: Currently disabled due to LCP regression. Kept for future use.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _setupFailsafe(): void {
  setTimeout(() => {
    if (document.documentElement.hasAttribute(PRETRIM_ATTR)) {
      console.warn('[LS:EARLY] Failsafe triggered - removing pretrim attribute');
      disablePretrimHide();
    }
  }, FAILSAFE_TIMEOUT_MS);
}

// Execute immediately at document_start
// NOTE: Pretrim hide disabled due to LCP regression (+455ms)
// The content-visibility: auto in CSS provides optimization without blocking LCP
// _enablePretrimHide();
// _setupFailsafe();

// Export for main content script to call via window object
window.__lsDisablePretrim = disablePretrimHide;
