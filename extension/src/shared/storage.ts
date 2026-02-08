/**
 * LightSession Pro - Storage Utility
 * Settings persistence and validation
 */

import browser from './browser-polyfill';
import type { LsSettings } from './types';
import { DEFAULT_SETTINGS, VALIDATION } from './constants';
import { logDebug, logError } from './logger';

export const STORAGE_KEY = 'ls_settings';

/**
 * localStorage key for page-script access.
 * Page scripts can't access browser.storage, so we mirror settings here
 * to avoid race conditions on page load.
 */
export const LOCAL_STORAGE_KEY = 'ls_config';

/**
 * Validate and normalize settings object
 * Ensures all fields are present and values are in valid ranges
 */
export function validateSettings(input: Partial<LsSettings>): LsSettings {
  return {
    version: 1, // Always current version
    enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
    keep: Math.max(
      VALIDATION.MIN_KEEP,
      Math.min(VALIDATION.MAX_KEEP, input.keep ?? DEFAULT_SETTINGS.keep)
    ),
    showStatusBar: input.showStatusBar ?? DEFAULT_SETTINGS.showStatusBar,
    collapseLongUserMessages:
      input.collapseLongUserMessages ?? DEFAULT_SETTINGS.collapseLongUserMessages,
    debug: input.debug ?? DEFAULT_SETTINGS.debug,
    ultraLean: input.ultraLean ?? DEFAULT_SETTINGS.ultraLean,
  };
}
/**
 * Sync settings to localStorage for page-script access.
 * Page scripts run in page context and can't access browser.storage,
 * so we mirror the config they need (enabled, limit, debug) to localStorage.
 * This eliminates race conditions on page load.
 */
export function syncToLocalStorage(settings: LsSettings): void {
  // Guard: localStorage unavailable in service worker (Chrome MV3)
  if (typeof localStorage === 'undefined') {
    logDebug('localStorage not available (service worker context)');
    return;
  }

  try {
    const config = {
      enabled: settings.enabled,
      limit: settings.keep,
      debug: settings.debug,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    logDebug('Synced settings to localStorage:', config);
  } catch (error) {
    // localStorage might be unavailable (private browsing, etc.)
    logError('Failed to sync to localStorage:', error);
  }
}


/**
 * Load settings from browser.storage.local
 * Returns validated settings (falls back to defaults on error)
 */
export async function loadSettings(): Promise<LsSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<LsSettings> | undefined;

    if (stored) {
      logDebug('Loaded settings from storage:', stored);
      return validateSettings(stored);
    }

    // No stored settings, return defaults
    logDebug('No stored settings found, using defaults');
    return validateSettings({});
  } catch (error) {
    logError('Failed to load settings:', error);
    return validateSettings({});
  }
}

/**
 * Update settings in browser.storage.local (partial update)
 * Merges provided fields with existing settings
 */
export async function updateSettings(updates: Partial<Omit<LsSettings, 'version'>>): Promise<void> {
  try {
    // Load current settings
    const current = await loadSettings();

    // Merge updates
    const merged = validateSettings({ ...current, ...updates });

    // Save to storage
    await browser.storage.local.set({ [STORAGE_KEY]: merged });

    logDebug('Updated settings:', merged);
  } catch (error) {
    logError('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Initialize settings on extension install
 * Sets defaults if no settings exist
 */
export async function initializeSettings(): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);

    if (!result[STORAGE_KEY]) {
      await browser.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
      logDebug('Initialized default settings');
    }
  } catch (error) {
    logError('Failed to initialize settings:', error);
  }
}
