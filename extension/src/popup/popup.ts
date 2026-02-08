/**
 * LightSession Pro - Popup UI Logic
 * Settings interface and interaction handlers
 */

import browser from '../shared/browser-polyfill';
import type { LsSettings } from '../shared/types';
import { sendMessageWithTimeout } from '../shared/messages';
import { SUPPORT_URL } from '../shared/constants';

/**
 * Get DOM element by ID with null safety.
 * Throws if element doesn't exist (fail-fast on missing UI elements).
 */
function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} not found`);
  }
  return el as T;
}

/**
 * Get optional DOM element by ID.
 * Returns null if element doesn't exist.
 */
function getOptionalElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

// UI Elements (initialized in initialize())
let enableToggle: HTMLInputElement;
let keepSlider: HTMLInputElement;
let keepValue: HTMLElement;
let sliderTrackFill: HTMLElement;
let showStatusBarCheckbox: HTMLInputElement | null;
let collapseLongUserMessagesCheckbox: HTMLInputElement | null;
let debugCheckbox: HTMLInputElement | null;
let debugGroup: HTMLElement | null;
let statusElement: HTMLElement;
let supportLink: HTMLButtonElement;
let retentionCard: HTMLElement | null;
let optionsCard: HTMLElement | null;

// Debounce/throttle state for slider persistence
let sliderDebounceTimeout: number | null = null;
let pendingKeepValue: number | null = null;
let lastKeepUpdateTimestamp = 0;
const SLIDER_SAVE_THROTTLE_MS = 150;

// Status message timeout state
let statusClearTimeout: number | null = null;

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
 * Update slider track fill width based on current value
 */
function updateSliderTrackFill(): void {
  const min = parseInt(keepSlider.min, 10);
  const max = parseInt(keepSlider.max, 10);
  const value = parseInt(keepSlider.value, 10);
  const percentage = ((value - min) / (max - min)) * 100;
  sliderTrackFill.style.width = `${percentage}%`;
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
 * Reload the active ChatGPT tab to apply settings changes.
 * Settings like message limit require a page reload to take effect
 * because the fetch proxy caches settings at intercept time.
 */
async function reloadActiveChatGPTTab(): Promise<void> {
  try {
    // Query for active tab in current window
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab?.id && activeTab.url) {
      // Only reload if it's a ChatGPT page
      const isChatGPT =
        activeTab.url.includes('chat.openai.com') ||
        activeTab.url.includes('chatgpt.com');

      if (isChatGPT) {
        await browser.tabs.reload(activeTab.id);
      }
    }
  } catch (error) {
    console.error('Failed to reload tab:', error);
  }
}

/**
 * Initialize popup UI
 */
async function initialize(): Promise<void> {
  // Get required UI elements (throw if missing)
  enableToggle = getRequiredElement<HTMLInputElement>('enableToggle');
  keepSlider = getRequiredElement<HTMLInputElement>('keepSlider');
  keepValue = getRequiredElement<HTMLElement>('keepValue');
  sliderTrackFill = getRequiredElement<HTMLElement>('sliderTrackFill');
  statusElement = getRequiredElement<HTMLElement>('status');
  supportLink = getRequiredElement<HTMLButtonElement>('supportLink');

  // Get optional UI elements (may not exist in all configurations)
  showStatusBarCheckbox = getOptionalElement<HTMLInputElement>('showStatusBarCheckbox');
  collapseLongUserMessagesCheckbox = getOptionalElement<HTMLInputElement>(
    'collapseLongUserMessagesCheckbox'
  );
  debugCheckbox = getOptionalElement<HTMLInputElement>('debugCheckbox');
  debugGroup = getOptionalElement<HTMLElement>('debugGroup');
  retentionCard = getOptionalElement<HTMLElement>('retentionCard');
  optionsCard = getOptionalElement<HTMLElement>('optionsCard');

  // Check if dev mode and show debug options
  const devMode = await isDevMode();
  if (devMode && debugGroup) {
    debugGroup.style.display = 'block';
  }

  // Display version from manifest
  const versionElement = getOptionalElement<HTMLElement>('version');
  if (versionElement) {
    const manifest = browser.runtime.getManifest();
    versionElement.textContent = `v${manifest.version}`;
  }

  // Load current settings
  await loadSettings();

  // Setup event listeners
  // Wrap async handlers to satisfy ESLint no-misused-promises rule
  enableToggle.addEventListener('change', () => void handleEnableToggle());
  keepSlider.addEventListener('input', handleKeepSliderInput);
  keepSlider.addEventListener('change', () => void handleKeepSliderChange());

  // Slider visual feedback
  keepSlider.addEventListener('mousedown', () => {
    keepValue.classList.add('is-dragging');
  });
  keepSlider.addEventListener('mouseup', () => {
    keepValue.classList.remove('is-dragging');
  });

  if (showStatusBarCheckbox) {
    showStatusBarCheckbox.addEventListener('change', handleShowStatusBarToggle);
  }
  if (collapseLongUserMessagesCheckbox) {
    collapseLongUserMessagesCheckbox.addEventListener('change', handleCollapseLongUserMessagesToggle);
  }
  if (debugCheckbox) {
    debugCheckbox.addEventListener('change', handleDebugToggle);
  }
  supportLink.addEventListener('click', handleSupportClick);
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
    updateSliderTrackFill();

    if (showStatusBarCheckbox) {
      showStatusBarCheckbox.checked = settings.showStatusBar;
    }
    if (collapseLongUserMessagesCheckbox) {
      collapseLongUserMessagesCheckbox.checked = settings.collapseLongUserMessages;
    }
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
async function handleEnableToggle(): Promise<void> {
  const enabled = enableToggle.checked;
  await updateSettings({ enabled });
  updateDisabledState(enabled);
  // Reload page to apply the change
  await reloadActiveChatGPTTab();
}

/**
 * Handle keep slider input (real-time display update)
 */
function handleKeepSliderInput(): void {
  const value = parseInt(keepSlider.value, 10);
  keepValue.textContent = value.toString();
  keepSlider.setAttribute('aria-valuenow', value.toString());
  updateSliderTrackFill();
  scheduleKeepUpdate(value);
}

/**
 * Handle keep slider change (final value when user releases slider)
 */
async function handleKeepSliderChange(): Promise<void> {
  const value = parseInt(keepSlider.value, 10);

  // Clear any pending debounced updates
  if (sliderDebounceTimeout !== null) {
    clearTimeout(sliderDebounceTimeout);
    sliderDebounceTimeout = null;
  }
  pendingKeepValue = null;

  // Save immediately and reload page
  await updateSettings({ keep: value });
  await reloadActiveChatGPTTab();
}

/**
 * Handle show status bar toggle
 */
function handleShowStatusBarToggle(): void {
  if (showStatusBarCheckbox) {
    void updateSettings({ showStatusBar: showStatusBarCheckbox.checked });
  }
}

/**
 * Handle collapse long user messages toggle
 */
function handleCollapseLongUserMessagesToggle(): void {
  if (collapseLongUserMessagesCheckbox) {
    void updateSettings({ collapseLongUserMessages: collapseLongUserMessagesCheckbox.checked });
  }
}

/**
 * Handle debug mode toggle
 */
function handleDebugToggle(): void {
  if (debugCheckbox) {
    void updateSettings({ debug: debugCheckbox.checked });
  }
}

/**
 * Handle support button click
 */
function handleSupportClick(): void {
  void browser.tabs.create({ url: SUPPORT_URL });
}

/**
 * Show status message
 */
function showStatus(message: string, isError: boolean = false): void {
  // Clear previous timeout to prevent race conditions
  if (statusClearTimeout !== null) {
    clearTimeout(statusClearTimeout);
  }

  statusElement.textContent = message;
  statusElement.classList.toggle('error', isError);

  // Clear after 3 seconds
  statusClearTimeout = window.setTimeout(() => {
    statusClearTimeout = null;
    statusElement.textContent = '';
    statusElement.classList.remove('error');
  }, 3000);
}

/**
 * Update disabled state of settings based on enabled toggle
 */
function updateDisabledState(enabled: boolean): void {
  // Toggle disabled class on cards
  const cards = [retentionCard, optionsCard];
  for (const card of cards) {
    if (!card) continue;
    if (enabled) {
      card.classList.remove('disabled');
    } else {
      card.classList.add('disabled');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initialize());
} else {
  void initialize();
}
