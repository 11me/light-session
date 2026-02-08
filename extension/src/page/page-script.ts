/**
 * LightSession for ChatGPT - Page Script (Fetch Proxy)
 *
 * This script runs in the page context (not content script isolated world).
 * It patches window.fetch to intercept ChatGPT API responses and trim
 * conversation data BEFORE React renders it.
 *
 * Benefits over DOM manipulation:
 * - No flash of untrimmed content
 * - No MutationObserver overhead
 * - Simpler, more reliable
 */

// Make this file a module for global augmentation to work
export {};

import {
  trimMapping,
  type ConversationData,
} from '../shared/trimmer';
import type { TrimStatus } from '../shared/types';

// ============================================================================
// Types (Page Context Only)
// ============================================================================

interface LsConfig {
  enabled: boolean;
  limit: number;
  debug: boolean;
}

// ============================================================================
// Global State
// ============================================================================

declare global {
  interface Window {
    __LS_CONFIG__?: LsConfig;
    __LS_PROXY_PATCHED__?: boolean;
    __LS_DEBUG__?: boolean;
  }
}

const DEFAULT_CONFIG: LsConfig = {
  enabled: true,
  limit: 10,
  debug: false,
};

// ============================================================================
// Config Ready Gating
// ============================================================================

/**
 * Promise that resolves when config is ready (from localStorage or CustomEvent).
 * First fetch waits on this to ensure correct config is used.
 */
let resolveConfigReady: (() => void) | null = null;
const configReady = new Promise<void>((resolve) => {
  resolveConfigReady = resolve;
});

/**
 * Resolve the configReady promise (idempotent - only resolves once).
 */
function tryResolveConfigReady(): void {
  if (resolveConfigReady) {
    resolveConfigReady();
    resolveConfigReady = null;
  }
}

/**
 * Wait for config to be ready with timeout.
 * Returns immediately if config already loaded.
 * After timeout, marks config as ready to avoid repeated delays on subsequent fetches.
 * @param timeoutMs Max time to wait (default 50ms)
 */
async function ensureConfigReady(timeoutMs = 50): Promise<void> {
  if (!resolveConfigReady) {
    // Already resolved
    return;
  }
  await Promise.race([
    configReady,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  // After timeout (or config arrived), mark as ready so subsequent fetches don't wait
  tryResolveConfigReady();
}

let configReceived = false;
const CONFIG_FALLBACK_TIMEOUT_MS = 2000;
const configStartTime = Date.now();

/**
 * localStorage key - must match storage.ts LOCAL_STORAGE_KEY
 */
const LOCAL_STORAGE_KEY = 'ls_config';

/**
 * Load config from localStorage (synced by content script).
 * This eliminates race conditions where fetch happens before
 * content script can send config via CustomEvent.
 */
function loadFromLocalStorage(): LsConfig | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<LsConfig>;
      configReceived = true;
      return {
        enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
        limit: Math.max(1, parsed.limit ?? DEFAULT_CONFIG.limit),
        debug: parsed.debug ?? DEFAULT_CONFIG.debug,
      };
    }
  } catch {
    // localStorage unavailable or invalid JSON
  }
  return null;
}

// ============================================================================
// Logging
// ============================================================================

function log(...args: unknown[]): void {
  if (window.__LS_DEBUG__) {
    console.log('[LS:PageScript]', ...args);
  }
}

// ============================================================================
// Status Dispatch
// ============================================================================

/**
 * Dispatch trim status to content script via CustomEvent.
 * Content script listens for this to update the status bar.
 */
function dispatchStatus(status: TrimStatus): void {
  window.dispatchEvent(
    new CustomEvent('lightsession-status', { detail: status })
  );
}

// ============================================================================
// Fetch Proxy
// ============================================================================

/**
 * Get current config (with defaults)
 */
function getConfig(): LsConfig {
  // Always check localStorage first (source of truth, synced by content scripts)
  // This ensures we pick up settings even if they were synced after page-script loaded
  const stored = loadFromLocalStorage();
  if (stored) {
    // Update window cache for consistency
    window.__LS_CONFIG__ = stored;
    return stored;
  }
  
  // Fall back to window config (set by content script events)
  const cfg = window.__LS_CONFIG__;
  if (cfg) {
    configReceived = true;
    return {
      enabled: cfg.enabled ?? DEFAULT_CONFIG.enabled,
      limit: Math.max(1, cfg.limit ?? DEFAULT_CONFIG.limit),
      debug: cfg.debug ?? DEFAULT_CONFIG.debug,
    };
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Check if this is a conversation API request we should intercept
 */
function isConversationRequest(method: string, url: URL): boolean {
  // Only GET requests
  if (method !== 'GET') {
    return false;
  }

  // Only endpoints that return the conversation tree we can trim.
  // ChatGPT performs many GET /backend-api/* requests on load (/me, /models, /settings, etc.).
  // Intercepting those adds unnecessary overhead (clone/json) and config gating delay.
  //
  // Allowed:
  // - /backend-api/conversation/<id>
  // - /backend-api/shared_conversation/<id> (share links)
  //
  // Explicitly excluded by pattern (extra path segments):
  // - /backend-api/conversation/<id>/stream_status
  // - /backend-api/conversation/<id>/textdocs
  const path = url.pathname;
  return /^\/backend-api\/(conversation|shared_conversation)\/[^/]+\/?$/.test(path);
}

/**
 * Check if response is JSON
 */
function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

/**
 * Create a new Response with modified JSON body
 */
function createModifiedResponse(
  originalRes: Response,
  modifiedData: ConversationData
): Response {
  const text = JSON.stringify(modifiedData);

  // Clone headers but remove content-length (will be recalculated)
  const headers = new Headers(originalRes.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/json; charset=utf-8');

  const response = new Response(text, {
    status: originalRes.status,
    statusText: originalRes.statusText,
    headers,
  });

  // Preserve url and type properties
  try {
    if (originalRes.url) {
      Object.defineProperty(response, 'url', { value: originalRes.url });
    }
    if (originalRes.type) {
      Object.defineProperty(response, 'type', { value: originalRes.type });
    }
  } catch {
    // Ignore if properties can't be set
  }

  return response;
}

/**
 * Main fetch interceptor
 */
async function interceptedFetch(
  nativeFetch: typeof fetch,
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  // Extract URL/method BEFORE fetching (handles string, URL, Request)
  // This avoids "Body has already been consumed" error when args[0] is a Request
  const [input, init] = args;
  let urlString: string;
  let method: string;

  if (input instanceof Request) {
    urlString = input.url;
    method = (init?.method ?? input.method).toUpperCase();
  } else if (input instanceof URL) {
    urlString = input.href;
    method = (init?.method ?? 'GET').toUpperCase();
  } else {
    urlString = String(input);
    method = (init?.method ?? 'GET').toUpperCase();
  }

  const url = new URL(urlString, location.href);

  // Early return for non-matching requests - no config wait needed
  if (!isConversationRequest(method, url)) {
    return nativeFetch(...args);
  }

  // Wait for config only for ChatGPT API requests (max 50ms on first request)
  await ensureConfigReady();

  const cfg = getConfig();

  // If config was never received, avoid trimming to prevent incorrect behavior.
  if (!configReceived) {
    if (Date.now() - configStartTime > CONFIG_FALLBACK_TIMEOUT_MS) {
      configReceived = true;
    } else {
      return nativeFetch(...args);
    }
  }

  if (!configReceived) {
    return nativeFetch(...args);
  }

  // Skip if disabled
  if (!cfg.enabled) {
    return nativeFetch(...args);
  }

  // Fetch and process matching requests
  const res = await nativeFetch(...args);

  try {
    if (!isJsonResponse(res)) {
      return res;
    }

    // Clone and parse response
    const clone = res.clone();
    const json = (await clone.json().catch(() => null)) as ConversationData | null;

    if (!json || typeof json !== 'object') {
      return res;
    }

    // Check if this looks like conversation data
    if (!json.mapping || !json.current_node) {
      return res;
    }

    // Trim the mapping
    const trimmed = trimMapping(json, cfg.limit);

    if (!trimmed) {
      return res;
    }

    // Calculate statistics (based on visible messages for user-friendly display)
    const totalBefore = trimmed.visibleTotal;
    const keptAfter = trimmed.visibleKept;
    const removed = Math.max(0, totalBefore - keptAfter);

    log(
      `Trimmed: ${keptAfter}/${totalBefore} nodes (limit: ${cfg.limit}), visible: ${trimmed.visibleKept}/${trimmed.visibleTotal}`
    );

    // Dispatch status to content script
    dispatchStatus({
      totalBefore,
      keptAfter,
      removed,
      limit: cfg.limit,
    });

    // Build modified response data
    const modifiedData: ConversationData = {
      ...json,
      mapping: trimmed.mapping,
      current_node: trimmed.current_node,
    };

    // Always set root - ChatGPT needs this to know where to start rendering
    modifiedData.root = trimmed.root;

    return createModifiedResponse(res, modifiedData);
  } catch (error) {
    // On any error, return original response
    log('Error in fetch interceptor:', error);
    return res;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Patch window.fetch with our interceptor
 */
function patchFetch(): void {
  // Prevent double-patching
  if (window.__LS_PROXY_PATCHED__) {
    log('Already patched, skipping');
    return;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    return interceptedFetch(nativeFetch, ...args);
  };

  window.__LS_PROXY_PATCHED__ = true;
  log('Fetch proxy installed');

  // Notify content script that proxy is ready (use origin for security)
  window.postMessage({ type: 'lightsession-proxy-ready' }, location.origin);

  // Request config from content script (handles race condition where
  // content script may have loaded before page script sent ready signal)
  window.dispatchEvent(new CustomEvent('lightsession-request-config'));
}

/**
 * Listen for config updates from content script.
 * Config is received as JSON string for cross-browser compatibility.
 */
function setupConfigListener(): void {
  window.addEventListener('lightsession-config', ((event: CustomEvent<string>) => {
    const detail = event.detail;

    // Parse JSON string (content script serializes config for Chrome compatibility)
    let config: LsConfig | null = null;

    if (typeof detail === 'string') {
      try {
        config = JSON.parse(detail) as LsConfig;
      } catch {
        // Invalid JSON, ignore
        return;
      }
    } else if (detail && typeof detail === 'object') {
      // Fallback: handle object directly (backwards compatibility)
      config = detail as unknown as LsConfig;
    }

    if (config && typeof config === 'object') {
      configReceived = true;
      // Update debug flag first so logging works immediately
      window.__LS_DEBUG__ = config.debug ?? false;

      window.__LS_CONFIG__ = {
        enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
        limit: Math.max(1, config.limit ?? DEFAULT_CONFIG.limit),
        debug: config.debug ?? DEFAULT_CONFIG.debug,
      };
      log('Config updated:', window.__LS_CONFIG__);

      // Signal that config is ready (unblocks first fetch)
      tryResolveConfigReady();
    }
  }) as EventListener);
}

// ============================================================================
// Entry Point
// ============================================================================

(function init(): void {
  // Initialize debug flag
  if (typeof window.__LS_DEBUG__ === 'undefined') {
    window.__LS_DEBUG__ = false;
  }

  // Check localStorage first - if already synced by page-inject, resolve immediately
  const stored = loadFromLocalStorage();
  if (stored) {
    window.__LS_CONFIG__ = stored;
    window.__LS_DEBUG__ = stored.debug;
    tryResolveConfigReady();
  }

  setupConfigListener();
  patchFetch();

  log('Fetch Proxy loaded');
})();
