/**
 * Unit tests for constants.ts - Validate configuration values
 */

import { describe, it, expect } from 'vitest';
import { TIMING, DOM, VALIDATION, DEFAULT_SETTINGS } from '../../extension/src/shared/constants';

describe('TIMING constants', () => {
  it('DEBOUNCE_MS is a reasonable debounce value', () => {
    // Should be between 50-200ms for good UX
    expect(TIMING.DEBOUNCE_MS).toBeGreaterThanOrEqual(50);
    expect(TIMING.DEBOUNCE_MS).toBeLessThanOrEqual(200);
  });

  it('BATCH_BUDGET_MS fits within one frame at 60fps', () => {
    // 60fps = 16.67ms per frame
    expect(TIMING.BATCH_BUDGET_MS).toBeLessThanOrEqual(16);
    expect(TIMING.BATCH_BUDGET_MS).toBeGreaterThan(0);
  });

  it('NODES_PER_BATCH is positive and reasonable', () => {
    expect(TIMING.NODES_PER_BATCH).toBeGreaterThan(0);
    expect(TIMING.NODES_PER_BATCH).toBeLessThanOrEqual(50);
  });

  it('SCROLL_THROTTLE_MS is a reasonable throttle value', () => {
    expect(TIMING.SCROLL_THROTTLE_MS).toBeGreaterThanOrEqual(50);
    expect(TIMING.SCROLL_THROTTLE_MS).toBeLessThanOrEqual(500);
  });

  it('MESSAGE_TIMEOUT_MS allows for slow responses', () => {
    expect(TIMING.MESSAGE_TIMEOUT_MS).toBeGreaterThanOrEqual(100);
    expect(TIMING.MESSAGE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});

describe('DOM constants', () => {
  it('MIN_CANDIDATES is at least 2', () => {
    expect(DOM.MIN_CANDIDATES).toBeGreaterThanOrEqual(2);
  });

  it('BOTTOM_THRESHOLD_PX is positive', () => {
    expect(DOM.BOTTOM_THRESHOLD_PX).toBeGreaterThan(0);
  });

  it('Y_TOLERANCE_PX is small but positive', () => {
    expect(DOM.Y_TOLERANCE_PX).toBeGreaterThan(0);
    expect(DOM.Y_TOLERANCE_PX).toBeLessThanOrEqual(10);
  });

  it('REMOVAL_MARKER is a non-empty string', () => {
    expect(DOM.REMOVAL_MARKER).toBeTruthy();
    expect(typeof DOM.REMOVAL_MARKER).toBe('string');
  });
});

describe('VALIDATION constants', () => {
  it('MIN_KEEP is at least 1', () => {
    expect(VALIDATION.MIN_KEEP).toBeGreaterThanOrEqual(1);
  });

  it('MAX_KEEP is greater than MIN_KEEP', () => {
    expect(VALIDATION.MAX_KEEP).toBeGreaterThan(VALIDATION.MIN_KEEP);
  });

  it('MAX_KEEP is reasonable (not too high)', () => {
    expect(VALIDATION.MAX_KEEP).toBeLessThanOrEqual(1000);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has version 1', () => {
    expect(DEFAULT_SETTINGS.version).toBe(1);
  });

  it('enabled is a boolean', () => {
    expect(typeof DEFAULT_SETTINGS.enabled).toBe('boolean');
  });

  it('keep is within validation range', () => {
    expect(DEFAULT_SETTINGS.keep).toBeGreaterThanOrEqual(VALIDATION.MIN_KEEP);
    expect(DEFAULT_SETTINGS.keep).toBeLessThanOrEqual(VALIDATION.MAX_KEEP);
  });

  it('showStatusBar is a boolean', () => {
    expect(typeof DEFAULT_SETTINGS.showStatusBar).toBe('boolean');
  });

  it('debug is a boolean', () => {
    expect(typeof DEFAULT_SETTINGS.debug).toBe('boolean');
  });
});
