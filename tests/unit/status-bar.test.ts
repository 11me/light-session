/**
 * Tests for status-bar.ts UI behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TIMING } from '../../extension/src/shared/constants';
import {
  showStatusBar,
  updateStatusBar,
  resetAccumulatedTrimmed,
  refreshStatusBar,
  removeStatusBar,
} from '../../extension/src/content/status-bar';

const WAITING_TEXT = 'LightSession · waiting for messages…';

describe('status bar behavior', () => {
  beforeEach(() => {
    removeStatusBar();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    removeStatusBar();
    vi.useRealTimers();
  });

  it('creates a status bar with waiting text when no stats are available', () => {
    showStatusBar();

    const bar = document.getElementById('lightsession-status-bar');
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toBe(WAITING_TEXT);
  });

  it('resets to waiting state after navigation reset', () => {
    vi.useFakeTimers();
    showStatusBar();

    updateStatusBar({
      totalMessages: 5,
      visibleMessages: 3,
      trimmedMessages: 2,
      keepLastN: 3,
    });

    vi.advanceTimersByTime(TIMING.STATUS_BAR_THROTTLE_MS);

    const bar = document.getElementById('lightsession-status-bar');
    expect(bar?.textContent).toBe('LightSession · last 3 · 2 trimmed');

    resetAccumulatedTrimmed();

    const resetBar = document.getElementById('lightsession-status-bar');
    expect(resetBar?.textContent).toBe(WAITING_TEXT);
  });

  it('does not accumulate trimmed messages across repeated status events', () => {
    vi.useFakeTimers();
    showStatusBar();

    updateStatusBar({
      totalMessages: 8,
      visibleMessages: 3,
      trimmedMessages: 5,
      keepLastN: 3,
    });
    vi.advanceTimersByTime(TIMING.STATUS_BAR_THROTTLE_MS);

    const bar = document.getElementById('lightsession-status-bar');
    expect(bar?.textContent).toBe('LightSession · last 3 · 5 trimmed');

    // Repeated status event with the same absolute "currently trimmed" count
    updateStatusBar({
      totalMessages: 8,
      visibleMessages: 3,
      trimmedMessages: 5,
      keepLastN: 3,
    });
    vi.advanceTimersByTime(TIMING.STATUS_BAR_THROTTLE_MS);

    const bar2 = document.getElementById('lightsession-status-bar');
    expect(bar2?.textContent).toBe('LightSession · last 3 · 5 trimmed');
  });

  it('refreshes the status bar if the DOM node is removed', () => {
    vi.useFakeTimers();
    showStatusBar();

    updateStatusBar({
      totalMessages: 4,
      visibleMessages: 2,
      trimmedMessages: 2,
      keepLastN: 2,
    });

    vi.advanceTimersByTime(TIMING.STATUS_BAR_THROTTLE_MS);

    const bar = document.getElementById('lightsession-status-bar');
    expect(bar).not.toBeNull();
    bar?.remove();

    refreshStatusBar();

    const refreshed = document.getElementById('lightsession-status-bar');
    expect(refreshed).not.toBeNull();
    expect(refreshed?.textContent).toBe('LightSession · last 2 · 2 trimmed');
  });
});
