/**
 * LightSession for ChatGPT - Popup UI Logic
 * Settings interface and interaction handlers
 */

import type { LsSettings } from '../shared/types';
import { sendMessageWithTimeout } from '../shared/messages';

// UI Elements
let enableToggle: HTMLInputElement;
let keepSlider: HTMLInputElement;
let keepValue: HTMLElement;
let debugCheckbox: HTMLInputElement;
let debugGroup: HTMLElement;
let refreshButton: HTMLButtonElement;
let statusElement: HTMLElement;

// Debounce/throttle state for slider persistence
let sliderDebounceTimeout: number | null = null;
let pendingKeepValue: number | null = null;
let lastKeepUpdateTimestamp = 0;
const SLIDER_SAVE_THROTTLE_MS = 150;

/**
 * Schedule updating the keep setting with optional immediate flush
 */
function scheduleKeepUpdate(value: number, immediate: boolean = false): void {
  if (immediate) {
    if (sliderDebounceTimeout !== null) {
      clearTimeout(sliderDebounceTimeout);
      sliderDebounceTimeout = null;
    }
    pendingKeepValue = null;
    lastKeepUpdateTimestamp = performance.now();
    void updateSettings({ keep: value });
    return;
  }

  const now = performance.now();

  // If enough time elapsed since last write, update immediately
  if (now - lastKeepUpdateTimestamp >= SLIDER_SAVE_THROTTLE_MS) {
    if (sliderDebounceTimeout !== null) {
      clearTimeout(sliderDebounceTimeout);
      sliderDebounceTimeout = null;
    }
    pendingKeepValue = null;
    lastKeepUpdateTimestamp = now;
    void updateSettings({ keep: value }, { silent: true });
    return;
  }

  pendingKeepValue = value;

  if (sliderDebounceTimeout !== null) {
    clearTimeout(sliderDebounceTimeout);
  }

  const wait = Math.max(0, SLIDER_SAVE_THROTTLE_MS - (now - lastKeepUpdateTimestamp));
  sliderDebounceTimeout = window.setTimeout(() => {
    sliderDebounceTimeout = null;
    if (pendingKeepValue === null) {
      return;
    }

    lastKeepUpdateTimestamp = performance.now();
    const latestValue = pendingKeepValue;
    pendingKeepValue = null;
    void updateSettings({ keep: latestValue }, { silent: true });
  }, wait);
}

/**
 * Check if running in development mode
 */
async function isDevMode(): Promise<boolean> {
  try {
    // Try to fetch a dev-only file
    const response = await fetch(browser.runtime.getURL('.dev'));
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Initialize popup UI
 */
async function initialize(): Promise<void> {
  // Get UI elements
  enableToggle = document.getElementById('enableToggle') as HTMLInputElement;
  keepSlider = document.getElementById('keepSlider') as HTMLInputElement;
  keepValue = document.getElementById('keepValue') as HTMLElement;
  debugCheckbox = document.getElementById('debugCheckbox') as HTMLInputElement;
  debugGroup = document.getElementById('debugGroup') as HTMLElement;
  refreshButton = document.getElementById('refreshButton') as HTMLButtonElement;
  statusElement = document.getElementById('status') as HTMLElement;

  // Check if dev mode and show debug options
  const devMode = await isDevMode();
  if (devMode && debugGroup) {
    debugGroup.style.display = 'block';
  }

  // Load current settings
  await loadSettings();

  // Setup event listeners
  enableToggle.addEventListener('change', handleEnableToggle);
  keepSlider.addEventListener('input', handleKeepSliderInput);
  keepSlider.addEventListener('change', handleKeepSliderChange);
  if (debugCheckbox) {
    debugCheckbox.addEventListener('change', handleDebugToggle);
  }
  refreshButton.addEventListener('click', handleRefreshClick);
}

/**
 * Load settings from background script and update UI
 */
async function loadSettings(): Promise<void> {
  try {
    const response = await sendMessageWithTimeout<{ settings: LsSettings }>({
      type: 'GET_SETTINGS',
    });

    const settings = response.settings;

    // Update UI
    enableToggle.checked = settings.enabled;
    keepSlider.value = settings.keep.toString();
    keepValue.textContent = settings.keep.toString();
    keepSlider.setAttribute('aria-valuenow', settings.keep.toString());

    if (debugCheckbox) {
      debugCheckbox.checked = settings.debug;
    }

    // Update disabled state
    updateDisabledState(settings.enabled);
  } catch (error) {
    showStatus('Failed to load settings', true);
    console.error('Failed to load settings:', error);
  }
}

/**
 * Update settings in background script
 */
async function updateSettings(
  updates: Partial<Omit<LsSettings, 'version'>>,
  options: { silent?: boolean } = {}
): Promise<void> {
  try {
    await sendMessageWithTimeout({
      type: 'SET_SETTINGS',
      payload: updates,
    });

    if (!options.silent) {
      showStatus('Settings saved');
    }
  } catch (error) {
    showStatus('Failed to save settings', true);
    console.error('Failed to update settings:', error);
  }
}

/**
 * Handle enable/disable toggle
 */
function handleEnableToggle(): void {
  const enabled = enableToggle.checked;
  updateSettings({ enabled });
  updateDisabledState(enabled);
}

/**
 * Handle keep slider input (real-time display update)
 */
function handleKeepSliderInput(): void {
  const value = parseInt(keepSlider.value, 10);
  keepValue.textContent = value.toString();
  keepSlider.setAttribute('aria-valuenow', value.toString());
  scheduleKeepUpdate(value);
}

/**
 * Handle keep slider change (debounced save)
 */
function handleKeepSliderChange(): void {
  const value = parseInt(keepSlider.value, 10);
  scheduleKeepUpdate(value, true);
}

/**
 * Handle debug mode toggle
 */
function handleDebugToggle(): void {
  updateSettings({ debug: debugCheckbox.checked });
}

/**
 * Handle refresh button click
 */
async function handleRefreshClick(): Promise<void> {
  try {
    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      showStatus('No active tab found', true);
      return;
    }

    const tab = tabs[0];

    // Check if it's a ChatGPT tab
    if (tab.url && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
      if (tab.id !== undefined) {
        await browser.tabs.reload(tab.id);
        showStatus('Page refreshed');
      } else {
        showStatus('Invalid tab ID', true);
      }
    } else {
      showStatus('Not a ChatGPT tab', true);
    }
  } catch (error) {
    showStatus('Failed to refresh page', true);
    console.error('Failed to refresh:', error);
  }
}

/**
 * Show status message
 */
function showStatus(message: string, isError: boolean = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle('error', isError);

  // Clear after 3 seconds
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.classList.remove('error');
  }, 3000);
}

/**
 * Update disabled state of settings based on enabled toggle
 */
function updateDisabledState(enabled: boolean): void {
  const settingGroups = document.querySelectorAll('.setting-group');
  for (let i = 1; i < settingGroups.length - 1; i++) {
    // Skip first (toggle) and last (refresh button)
    const group = settingGroups[i];
    if (enabled) {
      group.classList.remove('disabled');
    } else {
      group.classList.add('disabled');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
