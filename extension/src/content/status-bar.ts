/**
 * LightSession for ChatGPT - Status Bar
 * Compact floating pill indicator showing trimming statistics
 */

import { TIMING } from '../shared/constants';

const STATUS_BAR_ID = 'lightsession-status-bar';
const WAITING_TEXT = 'LightSession · waiting for messages…';

export interface StatusBarStats {
  totalMessages: number;
  visibleMessages: number;
  trimmedMessages: number;
  keepLastN: number;
}

type StatusBarState = 'active' | 'waiting' | 'all-visible' | 'unrecognized';

let currentStats: StatusBarStats | null = null;
let isVisible = true;
let accumulatedTrimmed = 0;

// Throttle status bar updates to reduce DOM writes during active chat
let lastUpdateTime = 0;
let pendingStats: StatusBarStats | null = null;
let pendingUpdateTimer: number | null = null;

/**
 * Get or create the status bar element
 */
function getOrCreateStatusBar(): HTMLElement | null {
  let bar = document.getElementById(STATUS_BAR_ID);
  if (bar) {
    return bar;
  }

  bar = document.createElement('div');
  bar.id = STATUS_BAR_ID;
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');

  applyStatusBarStyles(bar);

  document.body.appendChild(bar);

  return bar;
}

/**
 * Apply inline styles to the status bar (compact pill, bottom-right)
 */
function applyStatusBarStyles(bar: HTMLElement): void {
  Object.assign(bar.style, {
    position: 'fixed',
    bottom: '50px',
    right: '24px',
    zIndex: '10000',
    padding: '4px 10px',
    fontSize: '11px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
    color: '#e5e7eb',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(55, 65, 81, 0.9)',
    borderRadius: '9999px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    maxWidth: '60%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease',
  });
}

/**
 * Get status bar text based on current state (short format for pill)
 */
function getStatusText(stats: StatusBarStats): { text: string; state: StatusBarState } {
  if (stats.trimmedMessages > 0) {
    return {
      text: `LightSession · last ${stats.keepLastN} · ${stats.trimmedMessages} trimmed`,
      state: 'active',
    };
  }

  if (stats.totalMessages === 0) {
    return {
      text: 'LightSession · waiting for messages…',
      state: 'waiting',
    };
  }

  if (stats.totalMessages <= stats.keepLastN) {
    return {
      text: `LightSession · all ${stats.totalMessages} visible`,
      state: 'all-visible',
    };
  }

  return {
    text: `LightSession · ${stats.visibleMessages} visible`,
    state: 'active',
  };
}

/**
 * Apply state-specific styling
 */
function applyStateStyles(bar: HTMLElement, state: StatusBarState): void {
  // Reset to default
  bar.style.opacity = '1';
  bar.style.color = '#e5e7eb';
  bar.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
  bar.style.borderColor = 'rgba(55, 65, 81, 0.9)';

  switch (state) {
    case 'active':
      bar.style.color = '#6ee7b7';
      bar.style.backgroundColor = 'rgba(6, 78, 59, 0.9)';
      bar.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      break;
    case 'waiting':
      bar.style.color = '#9ca3af';
      break;
    case 'all-visible':
      // Keep neutral styling
      break;
    case 'unrecognized':
      bar.style.color = '#fcd34d';
      bar.style.backgroundColor = 'rgba(120, 53, 15, 0.9)';
      bar.style.borderColor = 'rgba(217, 119, 6, 0.5)';
      break;
  }
}

/**
 * Check if two stats objects are equal (for change detection)
 */
function statsEqual(a: StatusBarStats | null, b: StatusBarStats | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.totalMessages === b.totalMessages &&
    a.visibleMessages === b.visibleMessages &&
    a.trimmedMessages === b.trimmedMessages &&
    a.keepLastN === b.keepLastN
  );
}

/**
 * Actually render the status bar (internal, bypasses throttle)
 */
function renderStatusBar(displayStats: StatusBarStats): void {
  const bar = getOrCreateStatusBar();
  if (!bar) {
    return;
  }

  const { text, state } = getStatusText(displayStats);
  bar.textContent = text;
  applyStateStyles(bar, state);
  lastUpdateTime = performance.now();
}

function renderWaitingStatusBar(bar: HTMLElement): void {
  bar.textContent = WAITING_TEXT;
  applyStateStyles(bar, 'waiting');
  lastUpdateTime = performance.now();
}

/**
 * Update the status bar with new stats (throttled, with change detection)
 */
export function updateStatusBar(stats: StatusBarStats): void {
  // Reset accumulated count when entering a new/empty chat
  if (stats.totalMessages === 0) {
    accumulatedTrimmed = 0;
  }

  // Accumulate trimmed count
  if (stats.trimmedMessages > 0) {
    accumulatedTrimmed += stats.trimmedMessages;
  }

  // Use accumulated count for display
  const displayStats: StatusBarStats = {
    ...stats,
    trimmedMessages: accumulatedTrimmed,
  };

  // Change detection: skip if stats haven't changed
  if (statsEqual(displayStats, currentStats)) {
    return;
  }

  currentStats = displayStats;

  if (!isVisible) {
    return;
  }

  // Throttle: check if enough time has passed since last update
  const now = performance.now();
  const elapsed = now - lastUpdateTime;

  if (elapsed >= TIMING.STATUS_BAR_THROTTLE_MS) {
    // Enough time passed, render immediately
    if (pendingUpdateTimer !== null) {
      clearTimeout(pendingUpdateTimer);
      pendingUpdateTimer = null;
    }
    pendingStats = null;
    renderStatusBar(displayStats);
  } else {
    // Too soon, schedule pending update
    pendingStats = displayStats;
    if (pendingUpdateTimer === null) {
      const delay = TIMING.STATUS_BAR_THROTTLE_MS - elapsed;
      pendingUpdateTimer = window.setTimeout(() => {
        pendingUpdateTimer = null;
        if (pendingStats && isVisible) {
          renderStatusBar(pendingStats);
          pendingStats = null;
        }
      }, delay);
    }
  }
}

/**
 * Show warning when ChatGPT layout is not recognized
 */
export function showLayoutNotRecognized(): void {
  if (!isVisible) {
    return;
  }

  const bar = getOrCreateStatusBar();
  if (!bar) {
    return;
  }

  bar.textContent = 'LightSession · layout not recognized';
  applyStateStyles(bar, 'unrecognized');
}

/**
 * Show the status bar
 */
export function showStatusBar(): void {
  isVisible = true;
  const bar = getOrCreateStatusBar();
  if (!bar) {
    return;
  }

  bar.style.display = 'block';

  if (currentStats) {
    const { text, state } = getStatusText(currentStats);
    bar.textContent = text;
    applyStateStyles(bar, state);
    lastUpdateTime = performance.now();
    return;
  }

  renderWaitingStatusBar(bar);
}

/**
 * Hide the status bar
 */
export function hideStatusBar(): void {
  isVisible = false;
  const bar = document.getElementById(STATUS_BAR_ID);

  if (bar) {
    bar.style.display = 'none';
  }
}

/**
 * Remove the status bar from DOM
 */
export function removeStatusBar(): void {
  // Clear any pending update timer
  if (pendingUpdateTimer !== null) {
    clearTimeout(pendingUpdateTimer);
    pendingUpdateTimer = null;
  }
  pendingStats = null;

  const bar = document.getElementById(STATUS_BAR_ID);
  if (bar) {
    bar.remove();
  }
  currentStats = null;
  isVisible = false;
  accumulatedTrimmed = 0;
  lastUpdateTime = 0;
}

/**
 * Reset accumulated trimmed counter (call on chat navigation)
 */
export function resetAccumulatedTrimmed(): void {
  accumulatedTrimmed = 0;
  currentStats = null;
  pendingStats = null;
  if (pendingUpdateTimer !== null) {
    clearTimeout(pendingUpdateTimer);
    pendingUpdateTimer = null;
  }

  if (!isVisible) {
    return;
  }

  const bar = getOrCreateStatusBar();
  if (!bar) {
    return;
  }

  renderWaitingStatusBar(bar);
}

/**
 * Refresh status bar after SPA navigation or DOM resets
 */
export function refreshStatusBar(): void {
  if (!isVisible) {
    return;
  }

  const bar = getOrCreateStatusBar();
  if (!bar) {
    return;
  }

  bar.style.display = 'block';

  if (currentStats) {
    const { text, state } = getStatusText(currentStats);
    bar.textContent = text;
    applyStateStyles(bar, state);
    lastUpdateTime = performance.now();
    return;
  }

  renderWaitingStatusBar(bar);
}

/**
 * Set status bar visibility based on settings
 */
export function setStatusBarVisibility(visible: boolean): void {
  if (visible) {
    showStatusBar();
  } else {
    hideStatusBar();
  }
}
